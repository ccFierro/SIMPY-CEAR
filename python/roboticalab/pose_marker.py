"""Referencia cartesiana editable y destino opcional del TCP en CoppeliaSim."""

import math

from .manual_control import next_target_pose
from .ur_scene import Pose, RobotUR, _rotation_vector
from .scene_inventory import scene_inventory


NAME = "CEAR_PoseMarker"
TAG = "customData.CEAR_RoboLab_pose_marker"
DRAWINGS = "customData.CEAR_RoboLab_pose_drawings"


def _handle(sim):
    handle = sim.getObject("/" + NAME, {"noError": True})
    if handle is None or handle == -1:
        return None
    if sim.getObjectType(handle) != sim.object_dummy_type or sim.getBufferProperty(handle, TAG, {"noError": True}) != b"1":
        raise ValueError("El nombre del marcador está ocupado por otro objeto de la escena.")
    return handle


def _remove_axes(sim, handle):
    previous = sim.getBufferProperty(handle, DRAWINGS, {"noError": True})
    if previous:
        for drawing in sim.unpackTable(previous):
            try:
                sim.removeDrawingObject(drawing)
            except Exception:
                pass  # Coppelia puede retirar dibujos al detener la simulación.


def _create(sim):
    handle = sim.createDummy(0.035)
    sim.setObjectAlias(handle, NAME)
    sim.setBufferProperty(handle, TAG, b"1")
    return handle


def _axes(sim, handle):
    _remove_axes(sim, handle)
    drawings = []
    try:
        axes = (
            ([1, 0.12, 0.12], ([0, 0, 0, .09, 0, 0], [.0725, .009, 0, .09, 0, 0], [.0725, -.009, 0, .09, 0, 0])),
            ([.12, .9, .3], ([0, 0, 0, 0, .09, 0], [.009, .0725, 0, 0, .09, 0], [-.009, .0725, 0, 0, .09, 0])),
            ([.18, .45, 1], ([0, 0, 0, 0, 0, .09], [.009, 0, .0725, 0, 0, .09], [-.009, 0, .0725, 0, 0, .09])),
        )
        flags = sim.drawing_lines | sim.drawing_local | sim.drawing_overlay
        for color, segments in axes:
            drawing = sim.addDrawingObject(flags, 7, 0, handle, len(segments), color)
            for segment in segments:
                sim.addDrawingObjectItem(drawing, list(segment))
            drawings.append(drawing)
        sim.setBufferProperty(handle, DRAWINGS, sim.packTable(drawings))
    except Exception:
        for drawing in drawings:
            try:
                sim.removeDrawingObject(drawing)
            except Exception:
                pass
        raise


def _result(sim, handle):
    pose = sim.getObjectPose(handle, sim.handle_world)
    rotation = [float(value) for value in _rotation_vector(pose[3:])]
    values = list(pose[:3]) + rotation
    code = "p[" + ", ".join(f"{value:.5f}".rstrip("0").rstrip(".") if value else "0" for value in values) + "]"
    return {"ok": True, "path": "/" + NAME, "position": pose[:3], "rotation": rotation, "code": code}


def marker_action(sim, action, data, client=None):
    handle = _handle(sim)
    if action == "markerCreate":
        if handle is None:
            handle = _create(sim)
            sim.setObjectPose(handle, [0, 0, 0.35, 0, 0, 0, 1], sim.handle_world)
        _axes(sim, handle)
    elif action == "markerAlignTcp":
        path = data.get("sensorPath")
        if not isinstance(path, str) or not path.startswith("/") or len(path) > 300:
            raise ValueError("Selecciona primero el sensor TCP en la cabecera.")
        sensor = sim.getObject(path, {"noError": True})
        if sensor is None or sensor == -1 or sim.getObjectType(sensor) != sim.object_proximitysensor_type:
            raise ValueError("El sensor TCP seleccionado no está disponible en la escena.")
        if handle is None:
            handle = _create(sim)
        sim.setObjectPose(handle, sim.getObjectPose(sensor, sim.handle_world), sim.handle_world)
        _axes(sim, handle)
    elif action == "markerMoveTcp":
        if handle is None:
            raise ValueError("Crea primero el marcador de coordenadas.")
        path = data.get("sensorPath")
        if not isinstance(path, str) or not path.startswith("/") or len(path) > 300:
            raise ValueError("Selecciona primero el sensor TCP en la cabecera.")
        sensor = sim.getObject(path, {"noError": True})
        if sensor is None or sensor == -1 or sim.getObjectType(sensor) != sim.object_proximitysensor_type:
            raise ValueError("El sensor TCP seleccionado no está disponible en la escena.")
        if client is None:
            raise RuntimeError("No hay una conexión de movimiento con CoppeliaSim.")
        roots = [item["path"] for item in scene_inventory(sim)["robots"]
                 if path.startswith(item["path"].rstrip("/") + "/") and len(item["joints"]) == 6]
        if not roots:
            raise ValueError("El sensor TCP no pertenece a un robot de seis articulaciones reconocido.")
        root = max(roots, key=len)
        robot = RobotUR(client, sim, ruta=root, sensor=path)
        try:
            pose = sim.getObjectPose(handle, sim.handle_world)
            destination = Pose([*pose[:3], *_rotation_vector(pose[3:])])
            robot.movej(destination)
        finally:
            if robot._entorno is not None:
                robot._ik.eraseEnvironment(robot._entorno)
        result = _result(sim, handle)
        result["message"] = "TCP del sensor llegó al marcador con la orientación indicada."
        return result
    elif action == "markerDelete":
        if handle is None:
            return {"ok": True, "deleted": True, "message": "No había un marcador en la escena."}
        _remove_axes(sim, handle)
        sim.removeObjects([handle])
        return {"ok": True, "deleted": True, "message": "Marcador eliminado de la escena."}
    elif handle is None:
        raise ValueError("Crea primero el marcador de coordenadas.")
    elif action == "markerRead":
        _axes(sim, handle)
    elif action == "markerSet":
        position = data.get("position")
        rotation = data.get("rotation")
        if not isinstance(position, list) or not isinstance(rotation, list) or len(position) != 3 or len(rotation) != 3:
            raise ValueError("Ingresa X, Y, Z y rx, ry, rz.")
        values = [float(value) for value in position + rotation]
        if not all(math.isfinite(value) for value in values) or any(abs(value) > 10 for value in values[:3]):
            raise ValueError("La pose debe contener valores finitos y coordenadas entre -10 y 10 m.")
        quaternion = Pose(values).quaternion
        sim.setObjectPose(handle, values[:3] + quaternion, sim.handle_world)
        _axes(sim, handle)
    elif action == "markerJog":
        pose = next_target_pose(sim.getObjectPose(handle, sim.handle_world), data.get("axis"),
                                data.get("direction"), data.get("step"), data.get("frame", "tool"), 90)
        if any(abs(value) > 10 for value in pose[:3]):
            raise ValueError("El marcador debe permanecer entre -10 y 10 m.")
        sim.setObjectPose(handle, pose, sim.handle_world)
        _axes(sim, handle)
    else:
        raise ValueError("Acción de marcador inválida.")
    return _result(sim, handle)
