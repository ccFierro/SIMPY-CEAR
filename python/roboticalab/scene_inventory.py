"""Inventario de solo lectura de una escena CoppeliaSim para el cuaderno."""

import re

from .manual_control import simulation_running
from .ur_scene import _rotation_vector


MANIFEST_TAG = "customData.CEAR_RoboLab"


def _manifest(sim):
    try:
        packed = sim.getBufferProperty(sim.handle_scene, MANIFEST_TAG, {"noError": True})
        data = sim.unpackTable(packed) if packed else {}
    except Exception:
        return {}
    return data if isinstance(data, dict) and data.get("schema") == 1 else {}


def _path(sim, handle):
    return sim.getObjectAlias(handle, 2)


def _signal(sim, name):
    if not isinstance(name, str) or not name or len(name) > 80:
        return None
    try:
        if name.startswith(("AI_", "AO_")):
            return sim.getFloatSignal(name)
        return sim.getInt32Signal(name)
    except Exception:
        return None


def _published_signals(sim):
    """Descubre señales estándar ya publicadas, incluso sin manifiesto de escena."""
    found = []
    try:
        for index in range(128):
            property_name = sim.getPropertyName(sim.handle_scene, index, {"prefix": "signal."})
            if not property_name:
                break
            name = property_name.removeprefix("signal.")
            if re.fullmatch(r"(?:DI|DO|AI|AO)_\d{2}", name):
                found.append(name)
        if found:
            return list(dict.fromkeys(found))
    except (RuntimeError, ValueError):
        if found:
            return list(dict.fromkeys(found))
    except (AttributeError, TypeError):
        pass
    # Compatibilidad con escenas que publican señales mediante la API clásica.
    for index in range(8):
        for prefix in ("DI", "DO", "AI", "AO"):
            name = f"{prefix}_{index:02d}"
            if _signal(sim, name) is not None:
                found.append(name)
    return found


def scene_inventory(sim):
    """Describe objetos y señales sin iniciar ni modificar la simulación."""
    manifest = _manifest(sim)
    joint_type = sim.object_joint_type
    sensor_types = {
        sim.object_proximitysensor_type: "Proximidad",
        sim.object_visionsensor_type: "Visión",
        sim.object_forcesensor_type: "Fuerza",
    }
    robots = {}
    sensors = []
    joint_handles = sim.getObjectsInTree(sim.handle_scene, joint_type, 0)
    for handle in joint_handles[:120]:
        path = _path(sim, handle)
        parent = sim.getObjectParent(handle)
        ancestor = handle
        while parent != sim.handle_scene and parent != -1:
            ancestor = parent
            parent = sim.getObjectParent(parent)
        root = _path(sim, ancestor)
        robots.setdefault(root, {"path": root, "name": root.rsplit("/", 1)[-1], "joints": []})["joints"].append(path)
    sensor_count = 0
    for kind, label in sensor_types.items():
        handles = sim.getObjectsInTree(sim.handle_scene, kind, 0)
        sensor_count += len(handles)
        for handle in handles[:80]:
            path = _path(sim, handle)
            sensors.append({"path": path, "name": path.rsplit("/", 1)[-1], "type": label})
    paths = {item["path"] for item in sensors} | set(robots)
    for declared in manifest.get("robots", []):
        if not isinstance(declared, dict):
            continue
        path = declared.get("path")
        if path in robots:
            robots.setdefault(path, {"path": path, "joints": []})["name"] = str(declared.get("name") or path)
    for declared in manifest.get("sensors", []):
        if not isinstance(declared, dict):
            continue
        path = declared.get("path")
        for sensor in sensors:
            if sensor["path"] == path:
                sensor["name"] = str(declared.get("name") or sensor["name"])
                break
    signals = []
    for declared in manifest.get("signals", []):
        if not isinstance(declared, dict):
            continue
        name = declared.get("name")
        direction = declared.get("direction")
        if isinstance(name, str) and direction in ("input", "output"):
            signals.append({"name": name, "label": str(declared.get("label") or name),
                            "direction": direction, "unit": str(declared.get("unit") or ""),
                            "value": _signal(sim, name)})
    known = {signal["name"] for signal in signals}
    for name in _published_signals(sim):
        if name not in known:
            signals.append({"name": name, "label": name,
                            "direction": "input" if name.startswith(("DI_", "AI_")) else "output",
                            "value": _signal(sim, name)})
            known.add(name)
    # La escena docente UR3 puede estar detenida: su Lua aún no publicó señales.
    if not manifest and "/UR3" in robots and any(path.endswith("/suctionPad/Sensor") for path in paths):
        legacy = [("DI_01", "Ventosa: objeto sujeto", "input"),
                  ("DO_00", "Ventosa: activar", "output")]
        if any(path.endswith("/LaserSensor") for path in paths):
            legacy.append(("DI_00", "Láser: objeto detectado", "input"))
        for name, label, direction in legacy:
            existing = next((signal for signal in signals if signal["name"] == name), None)
            if existing:
                existing["label"] = label
            else:
                signals.append({"name": name, "label": label, "direction": direction,
                                "value": _signal(sim, name)})
    return {"ok": True, "running": simulation_running(sim),
            "paused": sim.getSimulationState() == sim.simulation_paused,
            "declared": bool(manifest),
            "robots": list(robots.values())[:20], "sensors": sensors[:80],
            "signals": signals[:80], "truncated": len(joint_handles) > 120 or sensor_count > 80}


def sensor_pose(sim, path):
    """Lee la pose World de un sensor de proximidad sin alterar la escena."""
    if not isinstance(path, str) or not path.startswith("/") or len(path) > 300:
        raise ValueError("Selecciona un sensor de la escena.")
    handle = sim.getObject(path, {"noError": True})
    if handle is None or handle == -1 or sim.getObjectType(handle) != sim.object_proximitysensor_type:
        raise ValueError("El sensor seleccionado ya no está disponible en la escena.")
    pose = sim.getObjectPose(handle, sim.handle_world)
    return {"ok": True, "path": sim.getObjectAlias(handle, 2),
            "position": [float(value) for value in pose[:3]],
            "rotation": [float(value) for value in _rotation_vector(pose[3:])]}
