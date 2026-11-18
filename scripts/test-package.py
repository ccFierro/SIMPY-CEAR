"""Smoke test the portable Windows launcher and its private Python runtime."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request(url, token=None, payload=None):
    headers = {"X-RoboticaLab-Token": token} if token else {}
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urlopen(Request(url, data=data, headers=headers), timeout=20) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"{url}: HTTP {error.code}: {error.read().decode('utf-8', 'replace')}") from error


def main():
    bundle = Path(sys.argv[1]).resolve()
    launcher = bundle / "SIMPY - CEAR.exe"
    if not launcher.is_file():
        raise FileNotFoundError(launcher)
    with tempfile.TemporaryDirectory(prefix="cear-robolab-", ignore_cleanup_errors=True) as temporary:
        data = Path(temporary)
        pid = None
        try:
            subprocess.run([str(launcher), "--no-browser", "--data-dir", str(data)], check=True, timeout=30)
            state = json.loads((data / "server-port.json").read_text(encoding="utf-8"))
            pid = state["pid"]
            base = f"http://127.0.0.1:{state['port']}"
            bootstrap = request(base + "/api/bootstrap")
            assert bootstrap["workspace"] == str(data / "trabajos")
            assert bootstrap["packages"]["numpy"]
            token = bootstrap["token"]
            session = request(base + "/api/session", token, {})["session"]
            request(base + "/api/execute", token, {
                "session": session, "cellId": "1",
                "source": "import numpy as np\nimport zmq, cbor, cbor2\nfrom roboticalab import connect_coppelia, RobotUR, p\nassert hasattr(RobotUR, 'set_dh')\nassert hasattr(RobotUR, 'forward_kinematics')\nassert hasattr(RobotUR, 'align_z')\nassert str(p[0, 0, 0]).startswith('p[')\nprint(int(np.array([1, 2, 3]).sum()))",
            })
            cursor = 0
            output = ""
            done = False
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline and not done:
                events = request(f"{base}/api/events?session={session}&after={cursor}", token)
                cursor = events["cursor"]
                for event in events["events"]:
                    if event["type"] == "output":
                        output += event.get("text", "")
                    if event["type"] == "done":
                        assert event["status"] == "ok", event
                        done = True
            assert done and "6" in output, output
            completions = request(base + "/api/complete", token, {
                "source": "import math\nmath.sq", "line": 2, "column": 7,
            })
            assert any(item["name"] == "sqrt" for item in completions["items"])
            request(base + "/api/close-session", token, {"session": session})
            print("Paquete Windows: lanzador, servidor y Python privado OK")
        finally:
            if pid:
                subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, check=False)
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                time.sleep(0.5)


if __name__ == "__main__":
    main()
