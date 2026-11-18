"""Smoke test the installed-app payload without changing the user's data."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root = Path(sys.argv[1]).resolve()
    executable = root / "SIMPY - CEAR.exe"
    resources = root / "resources"
    assert executable.is_file(), executable
    assert (resources / "robolab" / "runtime" / "python.exe").is_file()
    assert (resources / "robolab" / "app" / "server.py").is_file()
    assert (resources / "robolab" / "app" / "python" / "roboticalab" / "ur_scene.py").is_file()
    assert (resources / "robolab" / "examples" / "06_ur3_movej_movel_pick_place.roboticalab").is_file()
    with tempfile.TemporaryDirectory(prefix="cear-robolab-installer-", ignore_cleanup_errors=True) as temporary:
        environment = os.environ.copy()
        environment.pop("ELECTRON_RUN_AS_NODE", None)
        version = json.loads((Path(__file__).resolve().parent.parent / "package.json").read_text(encoding="utf-8"))["version"]
        for flag in ("--smoke-test", "--startup-smoke-test"):
            data = Path(temporary) / flag.lstrip("-")
            marker = data / "listo.json"
            data.mkdir()
            log = data / "electron.log"
            with log.open("w", encoding="utf-8") as output:
                result = subprocess.run(
                    [str(executable), flag, "--data-dir", str(data), "--smoke-output", str(marker)],
                    timeout=70, check=False, stdout=output, stderr=subprocess.STDOUT, env=environment,
                )
            assert result.returncode == 0, (flag, log.read_text(encoding="utf-8", errors="replace"), result.returncode)
            state = json.loads(marker.read_text(encoding="utf-8"))
            assert state["ready"] and state["titlebar"] and state["version"] == version, state
            assert state["startupChecked"] == (flag == "--startup-smoke-test"), state
            assert (data / "browser-storage.json").is_file() or (data / "trabajos").is_dir()
        print("Instalador: arranque normal, actividad UR3 y Python integrado OK")


if __name__ == "__main__":
    main()
