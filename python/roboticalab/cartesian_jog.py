"""Mando cartesiano manual de una escena CoppeliaSim con controlador SIMPY."""

import math
import uuid

from .scene_inventory import scene_inventory, sensor_pose
from .ur_scene import RobotUR


COMMAND = "SIMPY_motion_command"
STATUS = "SIMPY_motion_status"
HEARTBEAT = "SIMPY_motion_heartbeat"


def _robot(sim, client, sensor_path):
    if not isinstance(sensor_path, str) or not sensor_path.startswith("/"):
        raise ValueError("Selecciona un sensor TCP en la cabecera.")
    roots = [item["path"] for item in scene_inventory(sim)["robots"]
             if sensor_path.startswith(item["path"].rstrip("/") + "/")
             and len(item["joints"]) == 6]
    if not roots:
        raise ValueError("El sensor TCP no pertenece a un robot de seis articulaciones.")
    return RobotUR(client, sim, ruta=max(roots, key=len), sensor=sensor_path)


def _capability(sim):
    capability = sim.readCustomTableData(sim.handle_scene, "SIMPY_motion_v1")
    if not isinstance(capability, dict) or capability.get("version") != 1:
        raise RuntimeError("Esta escena no incluye SIMPY_MotionController. Abre la escena actualizada.")


def cartesian_jog_action(sim, client, action, data):
    if action == "robotJogStart":
        _capability(sim)
        if sim.getSimulationState() in (sim.simulation_stopped, sim.simulation_paused):
            raise RuntimeError("Inicia la simulación de CoppeliaSim antes de mover el robot.")
        axis = data.get("axis")
        direction = data.get("direction")
        frame = data.get("frame")
        speed = data.get("speed")
        if axis not in ("x", "y", "z", "rx", "ry", "rz"):
            raise ValueError("Selecciona un eje X, Y o Z.")
        if direction not in (-1, 1) or frame not in ("tool", "world"):
            raise ValueError("Sentido o referencia inválidos.")
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not math.isfinite(speed) or not 1 <= speed <= 90:
            raise ValueError("Usa una velocidad entre 1 y 90 mm/s o grados/s.")
        status = sim.readCustomTableData(sim.handle_scene, STATUS)
        if isinstance(status, dict) and status.get("state") in ("planning", "running"):
            raise RuntimeError("El robot ya está ejecutando otro movimiento.")
        robot = _robot(sim, client, data.get("sensorPath"))
        command_id = uuid.uuid4().hex
        command = {"id": command_id, "kind": "jog", "root": robot.ruta,
                   "joints": [item["ruta"] for item in robot.datos],
                   "tcp": sim.getObjectAlias(robot.tcp, 2), "axis": axis,
                   "direction": direction, "frame": frame, "speed": float(speed)}
        sim.writeCustomTableData(sim.handle_scene, HEARTBEAT,
                                 {"id": command_id, "time": sim.getSystemTime()})
        sim.writeCustomTableData(sim.handle_scene, COMMAND, command)
        return {"ok": True, "id": command_id, "message": "Mantén pulsado para mover el TCP."}

    command_id = data.get("id")
    if action in ("robotJogHeartbeat", "robotJogStop"):
        if not isinstance(command_id, str) or not 8 <= len(command_id) <= 64:
            raise ValueError("Identificador de movimiento inválido.")
        status = sim.readCustomTableData(sim.handle_scene, STATUS)
        state = status.get("state", "idle") if isinstance(status, dict) and status.get("id") == command_id else "pending"
        if action == "robotJogStop":
            if state in ("planning", "running", "pending"):
                sim.writeCustomTableData(sim.handle_scene, COMMAND,
                                         {"id": command_id, "kind": "cancel"})
            return {"ok": True, "state": state, "message": "Movimiento detenido."}
        if state in ("planning", "running", "pending"):
            sim.writeCustomTableData(sim.handle_scene, HEARTBEAT,
                                     {"id": command_id, "time": sim.getSystemTime()})
        if state == "error":
            raise RuntimeError(status.get("message") or "El movimiento se detuvo.")
        result = sensor_pose(sim, data.get("sensorPath"))
        result["state"] = state
        return result

    if action in ("robotJogRead", "robotJogAlignZ"):
        if action == "robotJogAlignZ":
            _capability(sim)
            robot = _robot(sim, client, data.get("sensorPath"))
            robot.align_z(1)
        return sensor_pose(sim, data.get("sensorPath"))

    raise ValueError("Acción cartesiana desconocida.")
