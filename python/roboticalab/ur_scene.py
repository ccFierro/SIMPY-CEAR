"""Movimientos docentes de un UR en CoppeliaSim; no controla un robot físico."""

import math
import re
import time

import numpy as np

from .coppelia import connect_coppelia, leer_articulaciones


def _xyz(values, label="posición"):
    point = np.asarray(values, dtype=float)
    if point.shape != (3,) or not np.all(np.isfinite(point)):
        raise ValueError(f"{label} debe tener tres coordenadas finitas en metros.")
    return point


class Pose(tuple):
    """Destino TCP en World; si no hay rotación, conserva la orientación actual."""

    def __new__(cls, values):
        coordinates = np.asarray(values, dtype=float)
        if coordinates.shape not in ((3,), (6,)) or not np.all(np.isfinite(coordinates)):
            raise ValueError("p[...] necesita x, y, z (opcionalmente rx, ry, rz) finitos.")
        return super().__new__(cls, coordinates.tolist())

    def __repr__(self):
        return "p[" + ", ".join(f"{value:g}" for value in self) + "]"

    __str__ = __repr__

    @property
    def xyz(self):
        return np.asarray(self[:3], dtype=float)

    @property
    def quaternion(self):
        if len(self) == 3:
            return None
        rotation = np.asarray(self[3:], dtype=float)
        angle = np.linalg.norm(rotation)
        if angle < 1e-12:
            return [0.0, 0.0, 0.0, 1.0]
        vector = rotation / angle * np.sin(angle / 2)
        return [*vector.tolist(), float(np.cos(angle / 2))]


class _PoseNotation:
    def __getitem__(self, values):
        return Pose(values)


p = _PoseNotation()


class IKNoSolution(RuntimeError):
    """La postura solicitada no se pudo resolver con la semilla indicada."""


def _rotation_vector(quaternion):
    quat = np.asarray(quaternion, dtype=float)
    quat = quat / np.linalg.norm(quat)
    if quat[3] < 0:
        quat = -quat
    length = np.linalg.norm(quat[:3])
    if length < 1e-12:
        return np.zeros(3)
    return quat[:3] / length * (2 * np.arctan2(length, quat[3]))


def _quaternion_multiply(left, right):
    a = np.asarray(left, dtype=float)
    b = np.asarray(right, dtype=float)
    xyz = a[3] * b[:3] + b[3] * a[:3] + np.cross(a[:3], b[:3])
    return [*xyz.tolist(), float(a[3] * b[3] - np.dot(a[:3], b[:3]))]


def _quaternion_rotate(quaternion, vector):
    q = np.asarray(quaternion, dtype=float)
    v = np.asarray(vector, dtype=float)
    cross = 2 * np.cross(q[:3], v)
    return v + q[3] * cross + np.cross(q[:3], cross)


def _interpolate_quaternion(start, end, fraction):
    a = np.asarray(start, dtype=float)
    b = np.asarray(end, dtype=float)
    a /= np.linalg.norm(a)
    b /= np.linalg.norm(b)
    dot = float(np.dot(a, b))
    if dot < 0:
        b = -b
        dot = -dot
    if dot > 0.9995:
        result = a + fraction * (b - a)
        return (result / np.linalg.norm(result)).tolist()
    angle = np.arccos(np.clip(dot, -1, 1))
    result = (np.sin((1 - fraction) * angle) * a + np.sin(fraction * angle) * b) / np.sin(angle)
    return result.tolist()


class RobotUR:
    """Puente con la escena: movej en juntas y movel por puntos TCP con simIK."""

    def __init__(self, client, sim, ruta="/UR3", sensor="/suctionPad/Sensor",
                 semilla_ik=None):
        self.client = client
        self.sim = sim
        self.ruta = ruta
        self.datos = leer_articulaciones(sim, ruta)
        self.juntas = [sim.getObject(item["ruta"]) for item in self.datos]
        sensores = sim.getObjectsInTree(sim.getObject(ruta), sim.object_proximitysensor_type, 0)
        opciones = [handle for handle in sensores
                    if sim.getObjectAlias(handle, 2).endswith(sensor)]
        if len(opciones) != 1:
            raise ValueError(f"No se encontró un único sensor TCP que termine en {sensor}.")
        self.tcp = opciones[0]
        self.tabla_dh = None
        self._semilla_ik = (np.asarray(semilla_ik, dtype=float) if semilla_ik is not None
                            else self.q())
        if self._semilla_ik.shape != (6,) or not np.all(np.isfinite(self._semilla_ik)):
            raise ValueError("La semilla IK debe contener seis ángulos finitos.")
        self._ik = None
        self._entorno = None
        self._aligned_z = None

    def set_dh(self, tabla):
        rows = np.asarray(tabla, dtype=float)
        if rows.shape != (6, 3) or not np.all(np.isfinite(rows)):
            raise ValueError("La tabla DH requiere seis filas (a, d, alpha).")
        self.tabla_dh = rows

    def forward_kinematics(self, q):
        if self.tabla_dh is None:
            raise RuntimeError("Primero configura la tabla DH.")
        q = self._angles(q)
        T = np.eye(4)
        for theta, (a, d, alpha) in zip(q, self.tabla_dh):
            c, s = np.cos(theta), np.sin(theta)
            ca, sa = np.cos(alpha), np.sin(alpha)
            T = T @ np.array([
                [c, -s * ca,  s * sa, a * c],
                [s,  c * ca, -c * sa, a * s],
                [0,       sa,      ca,     d],
                [0,        0,       0,     1],
            ])
        return T

    # Alias para actividades guardadas antes del cambio de nombres.
    configurar_dh = set_dh
    cinematica_directa = forward_kinematics

    @staticmethod
    def _angles(values):
        q = np.asarray(values, dtype=float)
        if q.shape != (6,) or not np.all(np.isfinite(q)):
            raise ValueError("Se necesitan seis ángulos finitos en radianes.")
        return q

    def q(self):
        return np.array([self.sim.getJointPosition(joint) for joint in self.juntas])

    def start_simulation(self, timeout=5):
        """Inicia o reanuda la escena desde el programa Python."""
        state = self.sim.getSimulationState()
        if state == self.sim.simulation_stopped and self._entorno is not None:
            self._ik.eraseEnvironment(self._entorno)
            self._entorno = None
            self._ik = None
        if state in (self.sim.simulation_stopped, self.sim.simulation_paused):
            self.sim.startSimulation()
        limit = time.monotonic() + timeout
        while time.monotonic() < limit:
            if self.sim.getSimulationState() not in (self.sim.simulation_stopped,
                                                      self.sim.simulation_paused):
                self._semilla_ik = self.q()
                return
            time.sleep(0.05)
        raise TimeoutError("CoppeliaSim no inició la simulación.")

    def stop_simulation(self):
        """Solicita detener la simulación; no cierra la conexión Python."""
        if self.sim.getSimulationState() != self.sim.simulation_stopped:
            self.sim.stopSimulation()

    def _running(self):
        if self.sim.getSimulationState() in (self.sim.simulation_stopped,
                                              self.sim.simulation_paused):
            raise RuntimeError("Inicia la simulación desde Python con robot.start_simulation() antes de mover.")

    def _targets(self, target):
        target = self._angles(target)
        origin = self.q()
        adjusted = target.copy()
        cyclic = []
        for index, (joint, angle) in enumerate(zip(self.juntas, target)):
            is_cyclic, interval = self.sim.getJointInterval(joint)
            cyclic.append(is_cyclic)
            if is_cyclic:
                delta = (angle - origin[index] + np.pi) % (2 * np.pi) - np.pi
                adjusted[index] = origin[index] + delta
            else:
                minimum, span = interval
                if not minimum <= angle <= minimum + span:
                    raise ValueError(f"J{index + 1} supera el límite articular.")
        return origin, adjusted, cyclic

    def _command(self, q):
        for joint, angle in zip(self.juntas, q):
            self.sim.setJointTargetPosition(joint, float(angle))

    def _wait_q(self, target, cyclic, timeout=8, tolerance_deg=2):
        limit = time.monotonic() + timeout
        tolerance = np.radians(tolerance_deg)
        while time.monotonic() < limit:
            measured = self.q()
            error = measured - target
            for index, is_cyclic in enumerate(cyclic):
                if is_cyclic:
                    error[index] = (error[index] + np.pi) % (2 * np.pi) - np.pi
            if np.max(np.abs(error)) <= tolerance:
                return measured
            time.sleep(0.05)
        raise TimeoutError("El robot no alcanzó la postura; revisa límites y control de posición.")

    @staticmethod
    def _check_wrist_transition(origin, target):
        """Evita atravesar una singularidad de muñeca con un salto de orientación."""
        origin = np.asarray(origin, dtype=float)
        target = np.asarray(target, dtype=float)
        wrist_delta = np.max(np.abs(target[[3, 5]] - origin[[3, 5]]))
        if abs(np.sin(origin[4])) < np.sin(np.radians(2.5)) and abs(np.sin(target[4])) < np.sin(np.radians(2.5)) and wrist_delta < np.radians(10):
            return
        for fraction in np.linspace(0.05, 1, 20):
            q5 = origin[4] + fraction * (target[4] - origin[4])
            if abs(np.sin(q5)) < np.sin(np.radians(2.5)):
                raise IKNoSolution("La ruta pasa cerca de una singularidad de muñeca. Usa una pose intermedia u otra orientación.")

    def movej(self, q_destino, pasos=35, intervalo=0.04):
        """Interpola las seis articulaciones; la ruta del TCP puede ser curva."""
        self._running()
        if not 2 <= pasos <= 200 or not 0 <= intervalo <= 1:
            raise ValueError("Usa 2 a 200 pasos y un intervalo de 0 a 1 s.")
        if isinstance(q_destino, Pose):
            orientation = q_destino.quaternion
            if orientation is None:
                orientation = self.tcp_pose()[3:]
            q_destino = self._pose_ik(q_destino.xyz, orientation,
                                      allow_tool_yaw=len(q_destino) == 3)
        origin, target, cyclic = self._targets(q_destino)
        self._check_wrist_transition(origin, target)
        for fraction in np.linspace(0, 1, pasos):
            self._command(origin + fraction * (target - origin))
            if intervalo:
                time.sleep(intervalo)
        travel = float(np.max(np.abs(target - origin)))
        return self._wait_q(target, cyclic, timeout=max(8, min(30, 5 + 5 * travel)))

    def _pose_ik(self, point, orientation, allow_tool_yaw=False):
        """Prueba ramas articulares y, tras align_z, giros libres de ventosa."""
        current = self.q()
        orientations = [orientation]
        aligned = getattr(self, "_aligned_z", None)
        if allow_tool_yaw and aligned in (-1, 1):
            tool_z = _quaternion_rotate(orientation, [0, 0, 1])
            if np.dot(tool_z, [0, 0, -aligned]) > 0.999:
                for yaw in (np.pi / 2, -np.pi / 2, np.pi):
                    turn = [0, 0, np.sin(yaw / 2), np.cos(yaw / 2)]
                    orientations.append(_quaternion_multiply(turn, orientation))
        candidates = []
        rejected_path = None
        for candidate_orientation in orientations:
            for base_turn in (0, np.pi / 2, -np.pi / 2, np.pi):
                seed = current.copy()
                seed[0] += base_turn
                try:
                    candidate = self.ik(point, semilla=seed, orientacion=candidate_orientation)
                    _, adjusted, _ = self._targets(candidate)
                    if np.max(np.abs(adjusted - current)) > np.pi:
                        rejected_path = "La pose tiene solución IK, pero requiere un giro articular mayor de 180°. Usa una pose intermedia."
                        continue
                    try:
                        self._check_wrist_transition(current, adjusted)
                    except IKNoSolution as error:
                        rejected_path = str(error)
                        continue
                    travel = adjusted - current
                    score = (float(np.max(np.abs(travel))), float(np.linalg.norm(travel)))
                    candidates.append((score, adjusted))
                except (IKNoSolution, ValueError):
                    continue
        if candidates:
            return min(candidates, key=lambda item: item[0])[1]
        if rejected_path:
            raise IKNoSolution(rejected_path)
        raise IKNoSolution(
            f"IK no encontró una postura de la ventosa para {np.asarray(point).tolist()} "
            "tras probar varias posturas iniciales y orientaciones permitidas. Prueba una pose intermedia."
        )

    def _prepare_ik(self):
        if self._entorno is not None:
            return
        ik = self.client.require("simIK")
        env = ik.createEnvironment()
        try:
            base = ik.createDummy(env)
            base_real = self.sim.getObject(self.ruta)
            ik.setObjectMatrix(env, base, -1, self.sim.getObjectMatrix(base_real, -1))
            parent = base
            ik_joints = []
            cyclic = []
            for real in self.juntas:
                joint = ik.createJoint(env, ik.jointtype_revolute)
                ik.setJointMode(env, joint, ik.jointmode_ik)
                is_cyclic, interval = self.sim.getJointInterval(real)
                ik.setJointInterval(env, joint, is_cyclic, interval)
                ik.setJointPosition(env, joint, self.sim.getJointPosition(real))
                ik.setObjectMatrix(env, joint, -1, self.sim.getObjectMatrix(real, -1))
                ik.setObjectParent(env, joint, parent, True)
                parent = joint
                ik_joints.append(joint)
                cyclic.append(is_cyclic)
            tip = ik.createDummy(env)
            ik.setObjectMatrix(env, tip, -1, self.sim.getObjectMatrix(self.tcp, -1))
            ik.setObjectParent(env, tip, parent, True)
            target = ik.createDummy(env)
            ik.setTargetDummy(env, tip, target)
            group = ik.createGroup(env)
            ik.setGroupCalculation(env, group, ik.method_damped_least_squares, 0.02, 160)
            element = ik.addElement(env, group, tip)
            ik.setElementBase(env, group, element, base)
            ik.setElementConstraints(env, group, element, ik.constraint_pose)
            for joint, angle in zip(ik_joints, self._semilla_ik):
                ik.setJointPosition(env, joint, float(angle))
            orientation = ik.getObjectPose(env, tip)
            self._ik = ik
            self._entorno = env
            self._ik_joints = ik_joints
            self._ik_cyclic = cyclic
            self._ik_tip = tip
            self._ik_target = target
            self._ik_group = group
            self._ik_orientation = list(orientation[3:])
        except Exception:
            ik.eraseEnvironment(env)
            raise

    def ik(self, posicion, semilla=None, orientacion=None):
        """Resuelve una posición TCP en World con orientación fija de herramienta."""
        point = _xyz(posicion)
        self._prepare_ik()
        seed = self._angles(self._semilla_ik if semilla is None else semilla)
        for joint, angle in zip(self._ik_joints, seed):
            self._ik.setJointPosition(self._entorno, joint, float(angle))
        quaternion = self._ik_orientation if orientacion is None else list(orientacion)
        if len(quaternion) != 4 or not np.all(np.isfinite(quaternion)):
            raise ValueError("La orientación debe ser un cuaternión de cuatro valores.")
        self._ik.setObjectPose(self._entorno, self._ik_target,
                               [*point.tolist(), *quaternion])
        result = self._ik.handleGroup(self._entorno, self._ik_group)
        solved = np.array([self._ik.getJointPosition(self._entorno, joint)
                           for joint in self._ik_joints])
        reached_pose = self._ik.getObjectPose(self._entorno, self._ik_tip)
        reached = np.asarray(reached_pose[:3])
        if result[0] != self._ik.result_success or np.linalg.norm(reached - point) > 0.002:
            raise IKNoSolution(f"IK no encontró una postura de la ventosa para {point.tolist()}.")
        tip_quaternion = np.asarray(reached_pose[3:], dtype=float)
        requested_quaternion = np.asarray(quaternion, dtype=float)
        tip_quaternion /= np.linalg.norm(tip_quaternion)
        requested_quaternion /= np.linalg.norm(requested_quaternion)
        orientation_error = 2 * np.arccos(np.clip(abs(np.dot(tip_quaternion, requested_quaternion)), 0, 1))
        if orientation_error > np.radians(3):
            raise IKNoSolution("La IK encontró la posición pero no alcanzó la orientación solicitada.")
        for index, is_cyclic in enumerate(self._ik_cyclic):
            if is_cyclic:
                solved[index] += 2 * np.pi * round((seed[index] - solved[index]) / (2 * np.pi))
        return solved

    def tcp_pose(self):
        return self.sim.getObjectPose(self.tcp, self.sim.handle_world)

    def tcp_position(self):
        """Posición XYZ actual del sensor TCP en World, en metros."""
        return np.asarray(self.tcp_pose()[:3], dtype=float)

    def tcp_rotation_vector(self):
        """Orientación actual del TCP en World, en radianes."""
        return _rotation_vector(self.tcp_pose()[3:])

    def align_z(self, direction):
        """Orienta el eje Z del TCP: 1 hacia abajo, -1 hacia arriba en World."""
        self._running()
        if isinstance(direction, (bool, np.bool_)) or direction not in (-1, 1):
            raise ValueError("align_z usa 1 para abajo o -1 para arriba.")
        current = self.tcp_pose()
        quaternion = np.asarray(current[3:], dtype=float)
        quaternion /= np.linalg.norm(quaternion)
        axis_now = _quaternion_rotate(quaternion, [0, 0, 1])
        axis_goal = np.array([0, 0, -direction], dtype=float)
        cosine = float(np.clip(np.dot(axis_now, axis_goal), -1, 1))
        angle = np.arccos(cosine)
        if angle <= np.radians(1):
            self._aligned_z = direction
            return np.asarray(current[:3], dtype=float)
        axis = np.cross(axis_now, axis_goal)
        norm = np.linalg.norm(axis)
        if norm < 1e-12:
            axis = _quaternion_rotate(quaternion, [1, 0, 0])
        else:
            axis /= norm
        half_turn = [*(axis * np.sin(angle / 2)).tolist(), float(np.cos(angle / 2))]
        target_quaternion = _quaternion_multiply(half_turn, quaternion)
        rotation = _rotation_vector(target_quaternion)
        result = self.movel(Pose([*current[:3], *rotation]))
        self._aligned_z = direction
        return result

    def movel(self, posicion, paso=0.02):
        """Avanza por puntos TCP de una línea, resolviendo IK en cada punto."""
        self._running()
        target = posicion.xyz if isinstance(posicion, Pose) else _xyz(posicion)
        if not 0.002 <= paso <= 0.05:
            raise ValueError("El paso lineal debe estar entre 2 y 50 mm.")
        current_pose = self.tcp_pose()
        start = _xyz(current_pose[:3])
        start_orientation = current_pose[3:]
        end_orientation = start_orientation
        if isinstance(posicion, Pose) and posicion.quaternion is not None:
            end_orientation = posicion.quaternion
        angular_distance = 2 * np.arccos(np.clip(abs(np.dot(start_orientation, end_orientation)), 0, 1))
        segments = max(1, int(np.ceil(np.linalg.norm(target - start) / paso)),
                       int(np.ceil(angular_distance / np.radians(7.5))))
        if segments > 400:
            raise ValueError("La trayectoria lineal supera 400 puntos; divídela en tramos.")
        seed = self.q()
        planned = []
        for fraction in np.linspace(1 / segments, 1, segments):
            point = start + fraction * (target - start)
            orientation = _interpolate_quaternion(start_orientation, end_orientation, fraction)
            q_next = self._angles(self.ik(point, semilla=seed, orientacion=orientation))
            self._targets(q_next)
            if np.max(np.abs(q_next - seed)) > np.radians(45):
                raise IKNoSolution("La IK cambió bruscamente de postura durante MoveL. Usa una pose intermedia u otra orientación.")
            self._check_wrist_transition(seed, q_next)
            planned.append(q_next)
            seed = q_next
        for q_next in planned:
            _, adjusted, cyclic = self._targets(q_next)
            self._command(adjusted)
            self._wait_q(adjusted, cyclic, tolerance_deg=1)
        actual = np.asarray(self.tcp_pose()[:3])
        if np.linalg.norm(actual - target) > 0.01:
            raise RuntimeError("El TCP no llegó al destino lineal esperado.")
        return actual

    def posicion(self, ruta):
        return np.array(self.sim.getObjectPosition(self.sim.getObject(ruta),
                                                    self.sim.handle_world))

    def detect_contact(self, max_distancia=0.007):
        """Devuelve la pieza dinámica más cercana a la ventosa, o None."""
        if not 0 < max_distancia <= 0.05:
            raise ValueError("La distancia de contacto debe estar entre 0 y 50 mm.")
        robot = self.sim.getObject(self.ruta)
        propias = set(self.sim.getObjectsInTree(robot, self.sim.object_shape_type, 0))
        formas = self.sim.getObjectsInTree(self.sim.handle_scene,
                                           self.sim.object_shape_type, 0)
        mejor = None
        for forma in formas:
            if forma in propias or self.sim.getObjectInt32Param(
                    forma, self.sim.shapeintparam_static) != 0:
                continue
            resultado = self.sim.checkProximitySensor(self.tcp, forma)
            if resultado[0] != 1 or resultado[1] > max_distancia:
                continue
            if mejor is None or resultado[1] < mejor["distancia"]:
                mejor = {"ruta": self.sim.getObjectAlias(forma, 2),
                         "distancia": float(resultado[1])}
        return mejor

    detectar_contacto = detect_contact

    def lower_until_contact(self, min_z, step=0.005, max_distance=0.007):
        """Baja en World hasta tocar una pieza dinámica o alcanzar min_z."""
        self._running()
        if not np.isfinite(min_z) or not np.isfinite(step) or not 0.002 <= step <= 0.02:
            raise ValueError("Usa una altura mínima finita y pasos entre 2 y 20 mm.")
        for _ in range(201):
            contact = self.detect_contact(max_distance)
            if contact is not None:
                return contact
            point = self.tcp_position()
            if point[2] <= min_z + 0.0001:
                return None
            next_z = max(min_z, point[2] - step)
            self.movel([point[0], point[1], next_z])
        raise RuntimeError("El descenso superó 200 pasos; revisa la altura mínima.")

    def confirmar_contacto(self, ruta, max_distancia=0.007):
        shape = self.sim.getObject(ruta)
        if self.sim.getObjectInt32Param(shape, self.sim.shapeintparam_static) != 0:
            raise ValueError("La pieza debe ser dinámica.")
        detection = self.sim.checkProximitySensor(self.tcp, shape)
        if detection[0] != 1 or detection[1] > max_distancia:
            raise RuntimeError("La pieza no está tocando la zona de la ventosa.")

    def set_output(self, nombre, estado):
        self.sim.setInt32Signal(nombre, int(bool(estado)))

    def set_analog_output(self, nombre, mm_s):
        """Ordena la velocidad con signo de una cinta CEAR mediante AO_XX."""
        if not isinstance(nombre, str) or re.fullmatch(r"AO_\d{2}", nombre) is None:
            raise ValueError("La salida analógica debe llamarse AO_XX.")
        try:
            velocidad = float(mm_s)
        except (TypeError, ValueError) as exc:
            raise ValueError("La velocidad debe ser un número en mm/s.") from exc
        if not math.isfinite(velocidad) or abs(velocidad) > 500:
            raise ValueError("La velocidad debe estar entre -500 y 500 mm/s.")
        self.sim.setFloatSignal(nombre, velocidad)

    def read_input(self, nombre):
        return self.sim.getInt32Signal(nombre)

    def wait_input(self, nombre, esperado, timeout=3):
        limit = time.monotonic() + timeout
        while time.monotonic() < limit:
            if self.read_input(nombre) == esperado:
                return
            time.sleep(0.05)
        raise TimeoutError(f"{nombre} no cambió a {esperado}.")

    # Alias de actividades anteriores.
    salida = set_output
    entrada = read_input
    esperar_entrada = wait_input

    def close(self):
        if self._entorno is not None:
            self._ik.eraseEnvironment(self._entorno)
            self._entorno = None
            self._ik = None
        if self.client is not None:
            self.client.socket.close(linger=0)
            self.client.context.term()
            self.client = None


def conectar_ur(ruta="/UR3", port=23000, host="127.0.0.1", semilla_ik=None,
               sensor="/suctionPad/Sensor"):
    client, sim = connect_coppelia(host=host, port=port, timeout=15)
    try:
        return RobotUR(client, sim, ruta=ruta, sensor=sensor, semilla_ik=semilla_ik)
    except Exception:
        client.socket.close(linger=0)
        client.context.term()
        raise
