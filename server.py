"""Servidor local de CEAR RoboLab y supervisor de procesos CPython.

Solo escucha loopback. El token y la comprobación de origen evitan que otras
páginas invoquen el intérprete. No es un sandbox para código no confiable.
"""
import argparse
import ast
from collections import deque
import hashlib
import importlib.metadata
import json
import mimetypes
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
import webbrowser

ROOT = Path(__file__).resolve().parent
SERVER_SOURCE_HASH = hashlib.sha256((ROOT / "server.py").read_bytes()).hexdigest()
PYTHON_DIR = ROOT / "python"
sys.path.insert(0, str(PYTHON_DIR))
ASSETS = {"index.html", "styles.css", "storage.js", "editor.js", "execution.js", "workspace.js", "visual-flow.js", "python-runtime.js", "bootstrap.js", "app.js", "coppelia-panel.js", "notifications.js", "pose-marker.js", "robot-jog.js", "point-preview.js", "python-reference.js"}
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class Kernel:
    def __init__(self, working_directory):
        self.cwd = working_directory
        self.condition = threading.Condition(threading.RLock())
        self.restart_lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.events = deque(maxlen=4096)
        self.sequence = 0
        self.active = None
        self.generation = 0
        self.last_seen = time.monotonic()
        self.process = None
        self.ready = threading.Event()
        self.closed = False
        self.start()

    def append(self, event):
        with self.condition:
            self.sequence += 1
            self.events.append({**event, "seq": self.sequence, "generation": self.generation})
            self.condition.notify_all()

    def start(self):
        self.generation += 1
        self.ready.clear()
        environment = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PYTHONNOUSERSITE": "1"}
        environment.pop("PYTHONPATH", None)
        self.process = subprocess.Popen(
            [sys.executable, "-u", str(PYTHON_DIR / "kernel.py")], cwd=self.cwd,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
            env=environment, creationflags=CREATE_NO_WINDOW,
        )
        process = self.process
        threading.Thread(target=self.read_events, args=(process,), daemon=True).start()
        threading.Thread(target=self.read_errors, args=(process,), daemon=True).start()

    def read_errors(self, process):
        with process.stderr:
            for line in process.stderr:
                if process is self.process:
                    self.append({"type": "output", "stream": "stderr", "text": line, "runId": self.active})

    def read_events(self, process):
        for line in process.stdout:
            try:
                event = json.loads(line)
                if not isinstance(event, dict) or "type" not in event:
                    continue
            except ValueError:
                event = {"type": "output", "stream": "stdout", "text": line, "runId": self.active}
            with self.condition:
                if process is not self.process:
                    continue
                if event["type"] == "ready":
                    self.ready.set()
                if event["type"] == "done" and event.get("runId") == self.active:
                    self.active = None
                self.append(event)
        process.stdout.close()
        with self.condition:
            if process is self.process and not self.closed:
                run_id = self.active
                self.active = None
                self.ready.clear()
                self.append({"type": "exit", "runId": run_id, "message": "Python terminó. Reinicia Python para continuar."})

    def send(self, data):
        with self.write_lock:
            if self.closed or self.process.poll() is not None:
                raise ValueError("Python no está disponible. Usa Reiniciar Python.")
            self.process.stdin.write(json.dumps(data, ensure_ascii=True) + "\n")
            self.process.stdin.flush()

    def execute(self, data):
        if not self.ready.wait(30):
            raise ValueError("Python no pudo iniciar. Revisa las dependencias del entorno.")
        with self.condition:
            if self.active:
                raise ValueError("Ya hay una celda ejecutándose.")
            self.active = secrets.token_hex(12)
            try:
                self.send({**data, "action": "execute", "runId": self.active})
            except Exception:
                self.active = None
                raise
            return self.active

    def interrupt(self):
        with self.condition:
            run_id, process = self.active, self.process
            if not run_id:
                return
            self.send({"action": "interrupt"})

        def force_if_blocked():
            time.sleep(2)
            with self.condition:
                blocked = self.active == run_id and self.process is process
            if blocked:
                self.restart()
                self.append({"type": "done", "runId": run_id, "status": "restarted", "variables": {}, "message": "Python no respondió a la interrupción y fue reiniciado; se limpiaron las variables."})
        threading.Thread(target=force_if_blocked, daemon=True).start()

    def restart(self):
        with self.restart_lock:
            with self.condition:
                old = self.process
                self.process = None
                self.active = None
                self.ready.clear()
            self.terminate(old)
            self.start()

    @staticmethod
    def terminate(process):
        if process is None:
            return
        if process.poll() is None:
            try:
                process.stdin.write('{"action":"shutdown"}\n')
                process.stdin.flush()
                process.wait(timeout=1)
            except (OSError, subprocess.TimeoutExpired):
                if os.name == "nt":
                    # A Windows venv launcher can own a second interpreter process.
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                   capture_output=True, creationflags=CREATE_NO_WINDOW)
                else:
                    process.kill()
                process.wait(timeout=5)
        try:
            process.stdin.close()
        except OSError:
            pass  # The interpreter may have exited before flushing its pipe.

    def poll(self, after):
        self.last_seen = time.monotonic()
        with self.condition:
            if self.sequence <= after:
                self.condition.wait(0.5)
            dropped = bool(self.events and after and after < self.events[0]["seq"] - 1)
            return {"events": [event for event in self.events if event["seq"] > after], "cursor": self.sequence, "dropped": dropped}

    def close(self):
        with self.condition:
            self.closed = True
            self.terminate(self.process)


class Application:
    def __init__(self, data_dir=None):
        self.token = secrets.token_urlsafe(32)
        self.kernels = {}
        self.lock = threading.Lock()
        self.data_dir = Path(data_dir or os.environ.get("ROBOTICALAB_DATA_DIR") or ROOT / ".local-data")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.workspace = self.data_dir / "trabajos"
        self.workspace.mkdir(exist_ok=True)
        self.storage_path = self.data_dir / "browser-storage.json"
        self.storage = self.read_storage()

    def read_storage(self):
        if self.storage_path.exists():
            try:
                value = json.loads(self.storage_path.read_text(encoding="utf-8"))
                return value if isinstance(value, dict) else {}
            except (ValueError, OSError):
                # Preserve an unreadable original instead of overwriting the only copy.
                self.storage_path.rename(self.storage_path.with_name(f"browser-storage-damaged-{time.time_ns()}.json"))
        return {}

    def save_storage(self, values):
        allowed = {"roboticalab.autosave.v1", "roboticalab.history.v1", "roboticalab.editorWidth"}
        if not isinstance(values, dict) or not set(values).issubset(allowed):
            raise ValueError("Almacenamiento inválido")
        if any(not isinstance(value, str) or len(value) > 40_000_000 for value in values.values()):
            raise ValueError("El almacenamiento supera el tamaño admitido")
        with self.lock:
            merged = dict(values)
            temporary = self.storage_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(merged, ensure_ascii=True), encoding="utf-8")
            os.replace(temporary, self.storage_path)
            self.storage = merged

    def create_session(self):
        with self.lock:
            for key, kernel in list(self.kernels.items()):
                if time.monotonic() - kernel.last_seen > 1800:
                    kernel.close()
                    del self.kernels[key]
            if len(self.kernels) >= 8:
                raise ValueError("Hay demasiados cuadernos abiertos. Cierra una ventana e inténtalo otra vez.")
            session = secrets.token_urlsafe(24)
            self.kernels[session] = Kernel(self.workspace)
            return session

    def close(self):
        for kernel in list(self.kernels.values()):
            kernel.close()


def package_versions():
    return {name: importlib.metadata.version(name) for name in ("numpy", "pyzmq", "cbor", "cbor2", "coppeliasim-zmqremoteapi-client", "jedi")}


def coppelia_action(data):
    # Separate process: even an unavailable simulator cannot block the notebook/server.
    command = [sys.executable, str(PYTHON_DIR / "probe_coppelia.py")]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, encoding="utf-8",
                               creationflags=CREATE_NO_WINDOW)
    try:
        stdout, stderr = process.communicate(json.dumps(data), timeout=130 if data.get("action") in ("markerMoveTcp", "robotJogAlignAxis", "robotJogMovePose") else 45 if data.get("action") == "previewPoints" else 20)
    except subprocess.TimeoutExpired as error:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           capture_output=True, creationflags=CREATE_NO_WINDOW)
        else:
            process.kill()
        process.communicate()
        raise ValueError("CoppeliaSim no respondió dentro del tiempo de espera.") from error
    if process.returncode:
        raise ValueError(stderr.strip()[-1000:] or "No se pudo consultar CoppeliaSim")
    return json.loads(stdout)


def complete_source(data):
    # Jedi is not thread-safe. Keep its inference work out of the HTTP server.
    process = subprocess.Popen(
        [sys.executable, str(PYTHON_DIR / "complete.py")],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", creationflags=CREATE_NO_WINDOW,
    )
    try:
        stdout, stderr = process.communicate(json.dumps(data), timeout=8)
    except subprocess.TimeoutExpired as error:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           capture_output=True, creationflags=CREATE_NO_WINDOW)
        else:
            process.kill()
        process.communicate()
        raise ValueError("El autocompletado tardó demasiado.") from error
    if process.returncode:
        raise ValueError(stderr.strip()[-1000:] or "No se pudo completar el código")
    return json.loads(stdout)


def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, data, content_type="application/json; charset=utf-8"):
            body = json.dumps(data, ensure_ascii=True).encode() if isinstance(data, (dict, list)) else data
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

        def valid_origin(self):
            expected = f"127.0.0.1:{self.server.server_port}"
            if self.headers.get("Host") != expected:
                return False
            origin = self.headers.get("Origin")
            if origin and origin != f"http://{expected}":
                return False
            return self.headers.get("Sec-Fetch-Site", "none") in ("none", "same-origin")

        def authenticated(self):
            token = self.headers.get("X-RoboticaLab-Token", "")
            return self.valid_origin() and secrets.compare_digest(token, app.token)

        def do_GET(self):
            if not self.valid_origin():
                self.reply(403, {"error": "Origen no permitido"})
                return
            url = urlsplit(self.path)
            if url.path == "/api/bootstrap":
                self.reply(200, {"application": "RoboticaLabCoppelia", "token": app.token, "python": sys.version.split()[0], "packages": package_versions(), "storage": app.storage, "workspace": str(app.workspace), "serverPid": os.getpid(), "serverSourceHash": SERVER_SOURCE_HASH})
                return
            if url.path == "/api/events":
                if not self.authenticated():
                    self.reply(403, {"error": "Sesión no autorizada"})
                    return
                try:
                    query = parse_qs(url.query)
                    kernel = app.kernels[query["session"][0]]
                    self.reply(200, kernel.poll(int(query.get("after", ["0"])[0])))
                except (KeyError, ValueError):
                    self.reply(404, {"error": "Sesión no disponible; vuelve a conectar Python."})
                return
            name = "index.html" if url.path == "/" else url.path.lstrip("/")
            if name not in ASSETS:
                self.reply(404, {"error": "No encontrado"})
                return
            mime = "text/javascript" if name.endswith(".js") else mimetypes.guess_type(name)[0] or "application/octet-stream"
            self.reply(200, (ROOT / name).read_bytes(), f"{mime}; charset=utf-8")

        def do_POST(self):
            if not self.authenticated():
                self.reply(403, {"error": "Sesión no autorizada"})
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                if not 0 < length <= 45_000_000:
                    raise ValueError("Solicitud demasiado grande o vacía")
                data = json.loads(self.rfile.read(length))
                endpoint = urlsplit(self.path).path
                if endpoint == "/api/session":
                    self.reply(200, {"session": app.create_session()})
                    return
                if endpoint == "/api/storage":
                    app.save_storage(data["values"])
                    self.reply(200, {"ok": True})
                    return
                if endpoint == "/api/coppelia":
                    if data.get("action") not in ("probe", "stop", "start", "scene", "inventory", "tcpPose", "identifyEquipment", "testConveyor", "jogJoint", "jogTarget", "markerCreate", "markerRead", "markerSet", "markerJog", "markerAlignTcp", "markerMoveTcp", "robotJogAxesShow", "robotJogAxesHide", "robotJogStart", "robotJogHeartbeat", "robotJogStop", "robotJogRead", "robotJogAlignAxis", "robotJogMovePose", "previewPoints"):
                        raise ValueError("Acción de CoppeliaSim inválida")
                    self.reply(200, coppelia_action(data))
                    return
                if endpoint == "/api/export":
                    source = data["source"]
                    if len(source) > 3_000_000:
                        raise ValueError("Código demasiado grande")
                    header = "import numpy as np\nfrom roboticalab import plot, punto, vector, connect, linea, trayectoria, frame, connect_coppelia, leer_articulaciones, PanelControl, RobotUR, conectar_ur, EscenaCoppelia, conectar_escena\n"
                    if data.get("legacyMatmul"):
                        from kernel import LegacyMatmul
                        tree = ast.fix_missing_locations(LegacyMatmul().visit(ast.parse(source)))
                        source = ast.unparse(tree)
                        header += "from roboticalab.visual import legacy_matmul as _roboticalab_matmul\n"
                    self.reply(200, {"source": header + "\n" + source})
                    return
                if endpoint == "/api/complete":
                    self.reply(200, complete_source(data))
                    return
                kernel = app.kernels.get(data.get("session"))
                if not kernel:
                    raise ValueError("La sesión de Python no existe; vuelve a conectar.")
                kernel.last_seen = time.monotonic()
                if endpoint == "/api/execute":
                    if not isinstance(data.get("source"), str) or len(data["source"]) > 200000:
                        raise ValueError("La celda debe contener hasta 200000 caracteres")
                    if not isinstance(data.get("cellId"), str) or not data["cellId"].isdigit():
                        raise ValueError("Identificador de celda inválido")
                    if data.get("extraPath") and not Path(data["extraPath"]).is_dir():
                        raise ValueError("La carpeta local de ZeroMQ no existe")
                    self.reply(200, {"runId": kernel.execute(data)})
                elif endpoint == "/api/control":
                    action = data.get("action")
                    if action == "interrupt":
                        kernel.interrupt()
                    elif action in ("pause", "resume", "step", "input"):
                        kernel.send({"action": action, "value": data.get("value")})
                    else:
                        raise ValueError("Control inválido")
                    self.reply(200, {"ok": True})
                elif endpoint == "/api/widget":
                    widget_id = data.get("id")
                    if not isinstance(widget_id, str) or len(widget_id) != 32 or not all(char in "0123456789abcdef" for char in widget_id):
                        raise ValueError("Identificador de control inválido")
                    value = data.get("value")
                    if value != "press" and (type(value) not in (int, float) or not -1_000_000 <= value <= 1_000_000):
                        raise ValueError("Valor de control inválido")
                    kernel.send({"action": "widget", "id": widget_id, "value": value})
                    self.reply(200, {"ok": True})
                elif endpoint == "/api/reset":
                    kernel.restart()
                    self.reply(200, {"ok": True})
                elif endpoint == "/api/close-session":
                    kernel.close()
                    with app.lock:
                        app.kernels.pop(data["session"], None)
                    self.reply(200, {"ok": True})
                else:
                    self.reply(404, {"error": "No encontrado"})
            except (ValueError, KeyError, TypeError, OSError) as error:
                self.reply(400, {"error": str(error)})
            except Exception as error:
                self.reply(500, {"error": f"Error del servicio local: {type(error).__name__}: {error}"})
    return Handler


def create_server(port=8766, data_dir=None):
    app = Application(data_dir)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(app))
    server.daemon_threads = True
    server.app = app
    return server


def main():
    parser = argparse.ArgumentParser(description="CEAR RoboLab con Python real")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--data-dir")
    args = parser.parse_args()
    package_versions()  # Fail before opening a browser if setup is incomplete.
    server = create_server(args.port, args.data_dir)
    url = f"http://127.0.0.1:{server.server_port}"
    print(json.dumps({"url": url, "python": sys.version.split()[0]}), flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.app.close()
        server.server_close()


if __name__ == "__main__":
    main()
