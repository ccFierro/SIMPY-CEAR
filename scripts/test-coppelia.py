"""Prueba opcional en una instancia nueva y aislada de CoppeliaSim."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import zmq

from roboticalab import connect_coppelia
from roboticalab.manual_control import jog_joint, jog_target, scene_snapshot


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    args = parser.parse_args()
    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    logs = Path(__file__).resolve().parents[1] / ".test-artifacts"
    logs.mkdir(exist_ok=True)
    client = None
    with (logs / "coppelia-test.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen([str(args.executable), "-h", f"-GzmqRemoteApi.rpcPort={port}", f"-Gpython={sys.executable}"],
                                   cwd=args.executable.parent, stdin=subprocess.PIPE, stdout=log, stderr=log,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(f"CoppeliaSim terminó durante el arranque ({process.returncode}); revisa el log")
                try:
                    client, sim = connect_coppelia(port=port, timeout=1)
                    break
                except ConnectionError:
                    time.sleep(0.3)
            if client is None:
                raise RuntimeError("La instancia de prueba no respondió en 45 segundos")
            client.socket.setsockopt(zmq.RCVTIMEO, 15000)
            version = sim.getInt32Param(sim.intparam_program_version)
            joint = sim.createJoint(sim.joint_revolute, sim.jointmode_kinematic, 0)
            sim.setObjectAlias(joint, "RoboticaLab_test_joint")
            sim.setJointPosition(joint, 0.35)
            assert abs(sim.getJointPosition(joint) - 0.35) < 1e-6
            joints = sim.getObjectsInTree(sim.handle_scene, sim.object_joint_type, 0)
            assert joint in joints
            dummy = sim.createDummy(0.02)
            sim.setObjectAlias(dummy, "RoboticaLab_test_target")
            joint_path = sim.getObjectAlias(joint, 2)
            target_path = sim.getObjectAlias(dummy, 2)
            sim.setStepping(True)
            sim.startSimulation()
            sim.step()
            assert sim.getSimulationTime() > 0
            scene = scene_snapshot(sim, target_path=target_path)
            assert any(item["path"] == joint_path for item in scene["joints"])
            assert scene["target"]["path"] == target_path
            old_target = sim.getJointTargetPosition(joint)
            moved_joint = jog_joint(sim, joint_path, 1, 1)
            assert moved_joint["joint"]["target"] > old_target
            old_pose = sim.getObjectPose(dummy, sim.handle_world)
            moved_target = jog_target(sim, target_path, "x", 1, 1, "world")
            assert abs(moved_target["target"]["pose"][0] - old_pose[0] - 0.001) < 1e-6
            sim.stopSimulation()
            sim.setStepping(False)
            print(json.dumps({"ok": True, "version": version, "port": port,
                              "checks": ["ZeroMQ/CBOR", "articulación genérica", "lectura/escritura", "simulación por pasos", "mandos de articulación y objetivo IK"]}))
            try:
                sim.quitSimulator(True)
            except Exception:
                pass  # The server can close before acknowledging the quit.
            process.wait(timeout=10)
        finally:
            if client:
                client.socket.close(linger=0)
                client.context.term()
            if process.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    process.kill()
                process.wait(timeout=10)
            process.stdin.close()


if __name__ == "__main__":
    main()
