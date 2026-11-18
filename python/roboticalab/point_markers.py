"""Marcadores pequeños para variables Python creadas con p[...]."""

import ast
import hashlib
import math
import re

from .ur_scene import Pose


LEGACY_PREFIX = "CEAR_Punto_"
TAG = "customData.CEAR_RoboLab_named_point"
DRAWINGS = "customData.CEAR_RoboLab_named_point_drawings"
DIMENSIONS = "customData.CEAR_RoboLab_named_point_dimensions"
MAX_POINTS = 100


def _alias(name):
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,62}", name):
        return name
    safe = re.sub(r"[^A-Za-z0-9_]", "_", name)[:42]
    return safe + "_" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]


def _legacy_alias(name):
    safe = re.sub(r"[^A-Za-z0-9_]", "_", name)[:42]
    if safe != name:
        safe += "_" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    return LEGACY_PREFIX + safe


def _owned(sim, path, name):
    handle = sim.getObject(path, {"noError": True})
    if handle in (None, -1):
        return None
    if (sim.getObjectType(handle) == sim.object_dummy_type and
            sim.getBufferProperty(handle, TAG, {"noError": True}) == name.encode("utf-8")):
        return handle
    return False


def _remove_axes(sim, handle):
    previous = sim.getBufferProperty(handle, DRAWINGS, {"noError": True})
    if previous:
        for drawing in sim.unpackTable(previous):
            try:
                sim.removeDrawingObject(drawing)
            except Exception:
                pass


def _draw_axes(sim, handle):
    _remove_axes(sim, handle)
    axes = (
        ([0.96, 0.23, 0.23], [0, 0, 0, .025, 0, 0]),
        ([0.18, 0.78, 0.34], [0, 0, 0, 0, .025, 0]),
        ([0.20, 0.48, 0.98], [0, 0, 0, 0, 0, .025]),
    )
    drawings = []
    try:
        flags = sim.drawing_lines | sim.drawing_local | sim.drawing_overlay
        for color, segment in axes:
            drawing = sim.addDrawingObject(flags, 3, 0, handle, 1, color)
            drawings.append(drawing)
            sim.addDrawingObjectItem(drawing, segment)
        sim.setBufferProperty(handle, DRAWINGS, sim.packTable(drawings))
    except Exception:
        for drawing in drawings:
            try:
                sim.removeDrawingObject(drawing)
            except Exception:
                pass
        raise


def named_poses(values):
    """Solo variables p[...] directas y finitas; no inspecciona objetos del estudiante."""
    result = {}
    for name, value in values.items():
        if len(result) >= MAX_POINTS:
            break
        if isinstance(name, str) and not name.startswith("_") and type(value) is Pose:
            if all(math.isfinite(number) and abs(number) <= 10 for number in value[:3]):
                result[name] = value
    return result


def sync_named_points(sim, values):
    """Crea o actualiza dummies propios de la app; conserva los demás objetos."""
    result = []
    for name, pose in named_poses(values).items():
        alias = _alias(name)
        handle = _owned(sim, "/" + alias, name)
        if handle is False:
            result.append({"name": name, "status": "name_conflict"})
            continue
        if handle is None:
            handle = _owned(sim, "/" + _legacy_alias(name), name)
            if handle is not None and handle is not False:
                sim.setObjectAlias(handle, alias)
        if handle is None or handle is False:
            handle = sim.createDummy(0.012)
            sim.setObjectAlias(handle, alias)
            sim.setBufferProperty(handle, TAG, name.encode("utf-8"))
            sim.setObjectColor(handle, 0, sim.colorcomponent_ambient_diffuse, [0.98, 0.74, 0.24])
        quaternion = pose.quaternion if len(pose) == 6 else [0, 0, 0, 1]
        sim.setObjectPose(handle, [*pose.xyz.tolist(), *quaternion], sim.handle_world)
        sim.setBufferProperty(handle, DIMENSIONS, str(len(pose)).encode("ascii"))
        if len(pose) == 6:
            _draw_axes(sim, handle)
        else:
            _remove_axes(sim, handle)
            sim.setBufferProperty(handle, DRAWINGS, sim.packTable([]))
        result.append({"name": name, "path": "/" + alias, "status": "updated"})
    return result


def delete_named_points(sim, names):
    """Borra únicamente marcadores etiquetados como propios de la app."""
    deleted = []
    for name in names:
        if not isinstance(name, str) or not name or name.startswith("_"):
            continue
        for alias in (_alias(name), _legacy_alias(name)):
            handle = _owned(sim, "/" + alias, name)
            if handle is not None and handle is not False:
                _remove_axes(sim, handle)
                sim.removeObjects([handle])
                deleted.append(name)
                break
    return deleted


def assigned_names(source):
    """Nombres escritos por asignaciones de nivel superior en una celda ejecutada."""
    names = set()
    for statement in ast.parse(source).body:
        if isinstance(statement, ast.Assign):
            for target in statement.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
        elif isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
            names.add(statement.target.id)
    return names


def reconcile_named_points(sim, values):
    """Retira puntos antiguos o cambiados y coloca la última versión ejecutada."""
    current = named_poses(values)
    removed = []
    for handle in sim.getObjectsInTree(sim.handle_scene, sim.object_dummy_type, 0):
        tagged = sim.getBufferProperty(handle, TAG, {"noError": True})
        if not tagged:
            continue
        try:
            name = tagged.decode("utf-8")
        except UnicodeDecodeError:
            continue
        pose = current.get(name)
        if pose is None:
            changed = True
        else:
            actual = sim.getObjectPose(handle, sim.handle_world)
            wanted = [*pose.xyz.tolist(), *(pose.quaternion if len(pose) == 6 else [0, 0, 0, 1])]
            position_changed = math.dist(actual[:3], wanted[:3]) > 1e-6
            rotation_changed = 1 - abs(sum(a * b for a, b in zip(actual[3:], wanted[3:]))) > 1e-6
            dimensions_changed = sim.getBufferProperty(handle, DIMENSIONS, {"noError": True}) != str(len(pose)).encode("ascii")
            changed = position_changed or rotation_changed or dimensions_changed
        if changed:
            _remove_axes(sim, handle)
            sim.removeObjects([handle])
            removed.append(name)
    return {"deleted": removed, "markers": sync_named_points(sim, current)}
