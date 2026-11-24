"""Mando cartesiano manual de una escena CoppeliaSim con controlador SIMPY."""

import math
import uuid

from .scene_inventory import scene_inventory, sensor_pose
from .ur_scene import Pose, RobotUR


COMMAND = "SIMPY_motion_command"
STATUS = "SIMPY_motion_status"
HEARTBEAT = "SIMPY_motion_heartbeat"
AXES_TAG = "customData.SIMPY_tcp_jog_axes"


def _remove_tcp_axes(sim, owner=None):
    data = sim.getBufferProperty(sim.handle_scene, AXES_TAG, {"noError": True})
    record = sim.unpackTable(data) if data else {}
    if not isinstance(record, dict):
        record = {}
    if owner is not None and record.get("owner") != owner:
        return
    for drawing in record.get("drawings", []):
        try:
            sim.removeDrawingObject(drawing)
        except Exception:
            pass  # Los dibujos también desaparecen al reiniciar la simulación.
    sim.setBufferProperty(sim.handle_scene, AXES_TAG, sim.packTable({}))


def _show_tcp_axes(sim, path, owner):
    sensor_pose(sim, path)  # Comprueba que la ruta apunta a un sensor existente.
    sensor = sim.getObject(path)
    _remove_tcp_axes(sim)
    drawings = []
    try:
        flags = sim.drawing_lines | sim.drawing_local | sim.drawing_overlay
        for color, segment in (
            ([0.96, 0.23, 0.23], [0, 0, 0, .025, 0, 0]),
            ([0.18, 0.78, 0.34], [0, 0, 0, 0, .025, 0]),
            ([0.20, 0.48, 0.98], [0, 0, 0, 0, 0, .025]),
        ):
            drawing = sim.addDrawingObject(flags, 3, 0, sensor, 1, color)
            drawings.append(drawing)
            sim.addDrawingObjectItem(drawing, segment)
        sim.setBufferProperty(sim.handle_scene, AXES_TAG,
                              sim.packTable({"owner": owner, "drawings": drawings}))
    except Exception:
        for drawing in drawings:
            try:
                sim.removeDrawingObject(drawing)
            except Exception:
                pass
        raise


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
    if action in ("robotJogAxesShow", "robotJogAxesHide"):
        owner = data.get("owner")
        if not isinstance(owner, str) or not 8 <= len(owner) <= 64:
            raise ValueError("Identificador de visualización inválido.")
        if action == "robotJogAxesShow":
            _show_tcp_axes(sim, data.get("sensorPath"), owner)
        else:
            _remove_tcp_axes(sim, owner)
        return {"ok": True}

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

    if action in ("robotJogRead", "robotJogAlignAxis", "robotJogMovePose"):
        if action in ("robotJogAlignAxis", "robotJogMovePose"):
            _capability(sim)
            robot = _robot(sim, client, data.get("sensorPath"))
            try:
                if action == "robotJogMovePose":
                    values = data.get("pose")
                    if (not isinstance(values, list) or len(values) != 6 or
                            any(isinstance(value, bool) or not isinstance(value, (int, float)) or
                                not math.isfinite(value) for value in values) or
                            any(abs(value) > 10 for value in values[:3])):
                        raise ValueError("Ingresa X, Y, Z y rx, ry, rz finitos; la posición debe estar entre -10 y 10 m.")
                    robot.movej(Pose(values))
                else:
                    axis = data.get("axis")
                    if axis == "z":
                        robot.align_z(1)
                    elif axis in ("x", "y"):
                        robot.align_axis(axis)
                    else:
                        raise ValueError("Selecciona un eje X, Y o Z.")
            finally:
                if robot._entorno is not None:
                    robot._ik.eraseEnvironment(robot._entorno)
        return sensor_pose(sim, data.get("sensorPath"))

    raise ValueError("Acción cartesiana desconocida.")
