"""Pasos manuales acotados para una escena de CoppeliaSim.

Las operaciones cartesianas desplazan un dummy objetivo; la escena debe tener
su propio controlador IK para que el robot siga ese objetivo.
"""

import math


def object_path(value, label):
    if not isinstance(value, str) or not value.startswith("/") or len(value) > 256:
        raise ValueError(f"{label}: escribe una ruta de escena que comience con /.")
    return value


def finite_step(value, maximum, label):
    try:
        step = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label}: paso inválido.") from error
    if not math.isfinite(step) or not 0 < step <= maximum:
        raise ValueError(f"{label}: usa un paso mayor que 0 y hasta {maximum:g}.")
    return step


def direction_value(value):
    if type(value) is not int or value not in (-1, 1):
        raise ValueError("La dirección debe ser -1 o +1.")
    return value


def next_joint_target(current, direction, step, joint_type, interval=None, cyclic=False):
    """Devuelve un objetivo en unidades SI, respetando el intervalo de la articulación."""
    direction = direction_value(direction)
    if joint_type == "revolute":
        delta = math.radians(finite_step(step, 10, "Giro articular"))
    elif joint_type == "prismatic":
        delta = finite_step(step, 50, "Traslación articular") / 1000
    else:
        raise ValueError("El mando manual no admite articulaciones esféricas.")
    current = float(current)
    if not math.isfinite(current):
        raise ValueError("La posición actual no es finita.")
    target = current + direction * delta
    if not cyclic and interval is not None:
        minimum, span = (float(number) for number in interval)
        if not all(math.isfinite(number) for number in (minimum, span)) or span < 0:
            raise ValueError("Los límites de la articulación no son válidos.")
        if target < minimum - 1e-9 or target > minimum + span + 1e-9:
            raise ValueError("El paso supera el límite de la articulación.")
    return target


def multiply_quaternions(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def rotate_vector(quaternion, vector):
    inverse = [-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]]
    rotated = multiply_quaternions(multiply_quaternions(quaternion, [*vector, 0]), inverse)
    return rotated[:3]


def next_target_pose(pose, axis, direction, step, frame="world", max_angular_step=10):
    """Avanza el objetivo IK en ejes globales o del propio objetivo."""
    if axis not in ("x", "y", "z", "rx", "ry", "rz"):
        raise ValueError("Eje cartesiano inválido.")
    if frame not in ("world", "tool"):
        raise ValueError("Referencia cartesiana inválida.")
    direction = direction_value(direction)
    if not isinstance(pose, (list, tuple)) or len(pose) != 7:
        raise ValueError("CoppeliaSim devolvió una pose inválida.")
    values = [float(value) for value in pose]
    if not all(map(math.isfinite, values)):
        raise ValueError("CoppeliaSim devolvió una pose no finita.")
    position, quaternion = values[:3], values[3:]
    magnitude = math.sqrt(sum(value * value for value in quaternion))
    if magnitude < 1e-10:
        raise ValueError("La orientación del objetivo no es válida.")
    quaternion = [value / magnitude for value in quaternion]
    index = "xyz".index(axis[-1])
    if axis.startswith("r"):
        angle = math.radians(finite_step(step, max_angular_step, "Giro cartesiano") * direction)
        delta = [0.0, 0.0, 0.0, math.cos(angle / 2)]
        delta[index] = math.sin(angle / 2)
        rotated = multiply_quaternions(delta, quaternion) if frame == "world" else multiply_quaternions(quaternion, delta)
        norm = math.sqrt(sum(value * value for value in rotated))
        return position + [value / norm for value in rotated]
    distance = finite_step(step, 50, "Desplazamiento cartesiano") * direction / 1000
    offset = [0.0, 0.0, 0.0]
    offset[index] = distance
    if frame == "tool":
        offset = rotate_vector(quaternion, offset)
    return [value + delta for value, delta in zip(position, offset)] + quaternion


def simulation_running(sim):
    state = sim.getSimulationState()
    return state not in (sim.simulation_stopped, sim.simulation_paused) and not sim.getSimulationStopping()


def require_running(sim):
    if not simulation_running(sim):
        raise ValueError("Inicia o reanuda la simulación antes de mover el robot.")


def joint_record(sim, handle):
    kind_id = sim.getJointType(handle)
    kind = "revolute" if kind_id == sim.joint_revolute else "prismatic" if kind_id == sim.joint_prismatic else "spherical"
    current = sim.getJointPosition(handle) if kind != "spherical" else None
    return {"path": sim.getObjectAlias(handle, 2), "type": kind,
            "position": current, "target": sim.getJointTargetPosition(handle) if kind != "spherical" else None}


def scene_snapshot(sim, root_path="", target_path=""):
    if root_path:
        root = sim.getObject(object_path(root_path, "Robot"))
    else:
        root = sim.handle_scene
    handles = sim.getObjectsInTree(root, sim.object_joint_type, 0)
    joints = [joint_record(sim, handle) for handle in handles[:80]]
    target = None
    if target_path:
        handle = sim.getObject(object_path(target_path, "Objetivo IK"))
        if sim.getObjectType(handle) != sim.object_dummy_type:
            raise ValueError("El objetivo IK debe ser un dummy de CoppeliaSim.")
        target = {"path": target_path, "pose": sim.getObjectPose(handle, sim.handle_world)}
    return {"ok": True, "message": "Escena consultada.", "running": simulation_running(sim),
            "joints": joints, "truncated": len(handles) > len(joints), "target": target}


def jog_joint(sim, path, direction, step):
    require_running(sim)
    handle = sim.getObject(object_path(path, "Articulación"))
    if sim.getObjectType(handle) != sim.object_joint_type:
        raise ValueError("La ruta indicada no es una articulación.")
    if sim.getJointMode(handle) == sim.jointmode_dependent:
        raise ValueError("Esta articulación depende de otra y no admite mando individual.")
    kind_id = sim.getJointType(handle)
    kind = "revolute" if kind_id == sim.joint_revolute else "prismatic" if kind_id == sim.joint_prismatic else "spherical"
    if kind == "spherical":
        raise ValueError("Selecciona una articulación rotativa o lineal.")
    cyclic, interval = sim.getJointInterval(handle)
    current_target = sim.getJointTargetPosition(handle)
    target = next_joint_target(current_target, direction, step, kind, interval, cyclic)
    sim.setJointTargetPosition(handle, target)
    return {"ok": True, "message": "Objetivo articular enviado.", "joint": joint_record(sim, handle),
            "running": True}


def jog_target(sim, path, axis, direction, step, frame):
    require_running(sim)
    handle = sim.getObject(object_path(path, "Objetivo IK"))
    if sim.getObjectType(handle) != sim.object_dummy_type:
        raise ValueError("El objetivo IK debe ser un dummy de CoppeliaSim.")
    pose = next_target_pose(sim.getObjectPose(handle, sim.handle_world), axis, direction, step, frame)
    sim.setObjectPose(handle, pose, sim.handle_world)
    return {"ok": True, "message": "Objetivo IK desplazado. La escena debe resolver la cinemática inversa para mover el robot.",
            "target": {"path": path, "pose": pose}, "running": True}
