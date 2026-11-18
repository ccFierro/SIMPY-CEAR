"""Windows launcher for the portable SIMPY - CEAR distribution."""
import argparse
import ctypes
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
import webbrowser


def show_error(message):
    ctypes.windll.user32.MessageBoxW(None, message, "SIMPY - CEAR", 0x10)


def app_at(port, data):
    try:
        with urlopen(f"http://127.0.0.1:{port}/api/bootstrap", timeout=1) as response:
            info = json.load(response)
            return info.get("application") == "RoboticaLabCoppelia" and Path(info.get("workspace", "")).resolve() == data / "trabajos"
    except (OSError, ValueError, TimeoutError):
        return False


def free_port():
    with socket.socket() as address:
        address.bind(("127.0.0.1", 0))
        return address.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description="Iniciar SIMPY - CEAR")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador; útil para pruebas")
    parser.add_argument("--data-dir", type=Path, help="Directorio de datos alternativo")
    args = parser.parse_args()

    distribution = Path(sys.executable).resolve().parent
    python = distribution / "runtime" / "pythonw.exe"
    server = distribution / "app" / "server.py"
    if not python.is_file() or not server.is_file():
        raise FileNotFoundError("Faltan los archivos de la distribución. Extrae la carpeta completa antes de iniciar.")

    default_data = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "CEAR RoboLab Coppelia"
    data = (args.data_dir or default_data).resolve()
    data.mkdir(parents=True, exist_ok=True)
    port_file = data / "server-port.json"
    try:
        previous_port = int(json.loads(port_file.read_text(encoding="utf-8"))["port"])
    except (OSError, ValueError, KeyError, TypeError):
        previous_port = 0
    port = previous_port if previous_port and app_at(previous_port, data) else free_port()

    if port != previous_port or not app_at(port, data):
        command = [str(python), str(server), "--port", str(port), "--data-dir", str(data), "--no-browser"]
        with (data / "server.log").open("a", encoding="utf-8") as output, (data / "server-error.log").open("a", encoding="utf-8") as errors:
            process = subprocess.Popen(command, cwd=distribution / "app", stdin=subprocess.DEVNULL,
                                       stdout=output, stderr=errors, creationflags=subprocess.CREATE_NO_WINDOW)
        for _ in range(100):
            if app_at(port, data):
                break
            if process.poll() is not None:
                raise RuntimeError(f"Python terminó al iniciar. Revisa {data / 'server-error.log'}")
            time.sleep(0.15)
        else:
            raise RuntimeError(f"Python no respondió al iniciar. Revisa {data / 'server-error.log'}")
        port_file.write_text(json.dumps({"port": port, "pid": process.pid}), encoding="utf-8")

    url = f"http://127.0.0.1:{port}"
    if not args.no_browser:
        webbrowser.open(url)
    return url


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        show_error(str(error))
        sys.exit(1)
