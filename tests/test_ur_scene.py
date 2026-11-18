"""Verifica que los movimientos docentes interpolan en el espacio correcto."""

import json
from contextlib import redirect_stdout
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from roboticalab.ur_scene import IKNoSolution, Pose, RobotUR, _quaternion_rotate, p


class FakeSim:
    simulation_stopped = 0
    simulation_paused = 2
    handle_world = -1

    def __init__(self):
        self.angles = np.zeros(6)
        self.commands = []
        self.signals = {"DI_01": 1}
        self.state = 17

    def getSimulationState(self):
        return self.state

    def startSimulation(self):
        self.state = 17

    def stopSimulation(self):
        self.state = self.simulation_stopped

    def getJointPosition(self, joint):
        return self.angles[joint]

    def getJointInterval(self, joint):
        return False, [-10, 20]

    def setJointTargetPosition(self, joint, angle):
        self.angles[joint] = angle
        self.commands.append((joint, angle))

    def getObjectPose(self, handle, relative):
        return [*self.angles[:3].tolist(), 0, 0, 0, 1]

    def getInt32Signal(self, name):
        return self.signals.get(name)

    def setInt32Signal(self, name, value):
        self.signals[name] = value

    def setFloatSignal(self, name, value):
        self.signals[name] = value


class RobotSceneTests(unittest.TestCase):
    def make_robot(self):
        robot = object.__new__(RobotUR)
        robot.sim = FakeSim()
        robot.juntas = list(range(6))
        robot.tcp = 10
        robot.tabla_dh = None
        robot._entorno = None
        robot._ik = None
        return robot

    def test_analog_conveyor_output_uses_signed_mm_per_second(self):
        robot = self.make_robot()
        robot.set_analog_output("AO_00", -80)
        self.assertEqual(robot.sim.signals["AO_00"], -80.0)
        robot.set_analog_output("AO_00", 0)
        self.assertEqual(robot.sim.signals["AO_00"], 0.0)
        with self.assertRaisesRegex(ValueError, "-500 y 500"):
            robot.set_analog_output("AO_00", 501)
        with self.assertRaisesRegex(ValueError, "AO_XX"):
            robot.set_analog_output("DO_01", 80)

    def test_dh_api_is_available_in_english_and_legacy_names(self):
        robot = self.make_robot()
        table = [(0, 0, 0)] * 6
        robot.set_dh(table)
        expected = robot.forward_kinematics([0] * 6)
        self.assertTrue(np.allclose(expected, np.eye(4)))
        self.assertTrue(np.allclose(robot.cinematica_directa([0] * 6), expected))
        robot.configurar_dh(table)
        self.assertTrue(np.allclose(robot.forward_kinematics([0] * 6), expected))

    def test_pose_notation_distinguishes_tcp_pose_from_joint_angles(self):
        target = p[0.35, 0, 0.455, np.pi, 0, 0]
        self.assertIsInstance(target, Pose)
        self.assertTrue(repr(target).startswith("p[0.35, 0, 0.455,"))
        self.assertEqual(target.xyz.tolist(), [0.35, 0, 0.455])
        self.assertTrue(np.allclose(np.abs(target.quaternion), [1, 0, 0, 0], atol=1e-10))
        position_only = p[0.35, 0, 0.455]
        self.assertIsNone(position_only.quaternion)
        with self.assertRaisesRegex(ValueError, "x, y, z"):
            p[0.35, 0]

    def test_movej_pose_resolves_ik_before_joint_motion(self):
        robot = self.make_robot()
        requested = []
        def solve(point, semilla=None, orientacion=None):
            requested.append((point.tolist(), semilla.tolist(), orientacion))
            return [0.2, 0, 0, 0, 0, 0]
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movej(p[0.35, 0, 0.455, 0, 0, 0], pasos=3, intervalo=0)
        self.assertEqual(len(requested), 4)
        self.assertTrue(all(np.allclose(item[0], [0.35, 0, 0.455]) and
                            np.allclose(item[2], [0, 0, 0, 1]) for item in requested))
        self.assertAlmostEqual(robot.sim.angles[0], 0.2)

    def test_movej_checks_all_ik_branches_and_chooses_shortest_joint_travel(self):
        robot = self.make_robot()
        seeds = []
        def solve(point, semilla=None, orientacion=None):
            seeds.append(float(semilla[0]))
            return [0.2 if np.isclose(semilla[0], np.pi / 2) else 0.9, 0, 0, 0, 0, 0]
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movej(p[0.35, 0, 0.455, 0, 0, 0], pasos=2, intervalo=0)
        self.assertEqual(len(seeds), 4)
        self.assertAlmostEqual(robot.sim.angles[0], 0.2)

    def test_simulation_start_and_stop_from_python(self):
        robot = self.make_robot()
        robot.sim.state = robot.sim.simulation_stopped
        robot._entorno = 8
        class IK:
            def __init__(self):
                self.erased = []
            def eraseEnvironment(self, handle):
                self.erased.append(handle)
        robot._ik = IK()
        old_ik = robot._ik
        robot.start_simulation()
        self.assertEqual(robot.sim.state, 17)
        self.assertTrue(np.allclose(robot._semilla_ik, [0] * 6))
        self.assertEqual(old_ik.erased, [8])
        self.assertIsNone(robot._entorno)
        robot.stop_simulation()
        self.assertEqual(robot.sim.state, robot.sim.simulation_stopped)

    def test_pose_ik_rejects_large_joint_jump_before_motion(self):
        robot = self.make_robot()
        robot.ik = lambda point, semilla=None, orientacion=None: [3.5, 0, 0, 0, 0, 0]
        with self.assertRaisesRegex(IKNoSolution, "giro articular mayor de 180"):
            robot.movej(p[0.35, 0, 0.45], intervalo=0)
        self.assertEqual(robot.sim.commands, [])

    def test_movej_accepts_reachable_base_turn_over_120_degrees(self):
        robot = self.make_robot()
        robot.ik = lambda point, semilla=None, orientacion=None: [np.radians(149), 0, 0, 0, 0, 0]
        with patch("time.sleep", return_value=None):
            robot.movej(p[-0.35, 0.35, 0.4, 0, -np.pi, 0], pasos=3, intervalo=0)
        self.assertAlmostEqual(robot.sim.angles[0], np.radians(149))

    def test_movel_rejects_branch_jump_before_motion(self):
        robot = self.make_robot()
        robot.ik = lambda point, semilla=None, orientacion=None: [point[0] * 100, 0, 0, 0, 0, 0]
        with self.assertRaisesRegex(IKNoSolution, "bruscamente"):
            robot.movel([0.03, 0, 0], paso=0.01)
        self.assertEqual(robot.sim.commands, [])

    def test_movej_xyz_pose_keeps_current_orientation(self):
        robot = self.make_robot()
        robot.tcp_pose = lambda: [0, 0, 0, 0, 1, 0, 0]
        requested = []
        robot.ik = lambda point, semilla=None, orientacion=None: (requested.append(orientacion) or [0] * 6)
        with patch("time.sleep", return_value=None):
            robot.movej(p[0.35, 0, 0.455], pasos=2, intervalo=0)
        self.assertEqual(requested, [[0, 1, 0, 0]] * 4)

    def test_movej_retries_joint_branches_before_changing_tool_yaw(self):
        robot = self.make_robot()
        calls = []
        def solve(point, semilla=None, orientacion=None):
            calls.append((semilla[0], orientacion))
            if np.isclose(semilla[0], np.pi / 2):
                return [0.2, 0, 0, 0, 0, 0]
            raise IKNoSolution("sin solución")
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movej(p[0.35, 0, 0.455], pasos=2, intervalo=0)
        self.assertEqual(len(calls), 4)
        self.assertTrue(all(np.allclose(item[1], calls[0][1]) for item in calls))

    def test_movej_retries_tool_yaw_only_after_align_z(self):
        robot = self.make_robot()
        robot._aligned_z = 1
        diagonal = np.sqrt(0.5)
        robot.tcp_pose = lambda: [0, 0, 0, -diagonal, diagonal, 0, 0]
        calls = []
        def solve(point, semilla=None, orientacion=None):
            calls.append(orientacion)
            if abs(orientacion[0]) > 0.99:
                return [0.2, 0, 0, 0, 0, 0]
            raise IKNoSolution("sin solución")
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movej(p[-0.35, 0, 0.455], pasos=2, intervalo=0)
        self.assertEqual(len(calls), 16)
        self.assertTrue(np.allclose(calls[0], [-diagonal, diagonal, 0, 0]))
        self.assertTrue(np.allclose(_quaternion_rotate(calls[-1], [0, 0, 1]),
                                    [0, 0, -1], atol=1e-10))

    def test_movej_explicit_orientation_stays_fixed_when_ik_fails(self):
        robot = self.make_robot()
        robot._aligned_z = 1
        calls = []
        def fail(point, semilla=None, orientacion=None):
            calls.append(orientacion)
            raise IKNoSolution("sin solución")
        robot.ik = fail
        with self.assertRaisesRegex(IKNoSolution, "varias posturas"):
            robot.movej(p[-0.35, 0, 0.455, np.pi, 0, 0], intervalo=0)
        self.assertEqual(len(calls), 4)
        self.assertTrue(all(np.allclose(item, calls[0]) for item in calls))

    def test_align_z_uses_world_vertical_and_rejects_other_values(self):
        robot = self.make_robot()
        targets = []
        robot.movel = lambda target: targets.append(target)
        with self.assertRaisesRegex(ValueError, "1 para abajo"):
            robot.align_z(0)
        robot.align_z(-1)
        self.assertEqual(targets, [])
        robot.align_z(1)
        self.assertEqual(len(targets), 1)
        self.assertTrue(np.allclose(targets[0].xyz, [0, 0, 0]))
        self.assertTrue(np.allclose(_quaternion_rotate(targets[0].quaternion, [0, 0, 1]),
                                    [0, 0, -1], atol=1e-10))

    def test_movel_pose_interpolates_tcp_orientation(self):
        robot = self.make_robot()
        orientations = []
        def solve(point, semilla=None, orientacion=None):
            orientations.append(orientacion)
            return [point[0], 0, 0, 0, 0, 0]
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movel(p[0.02, 0, 0, 0, 0, np.pi / 2], paso=0.01)
        self.assertGreater(len(orientations), 2)
        self.assertTrue(np.allclose(orientations[-1], p[0, 0, 0, 0, 0, np.pi / 2].quaternion))
        self.assertNotEqual(orientations[0], orientations[-1])

    def test_movel_xyz_pose_preserves_current_orientation(self):
        robot = self.make_robot()
        orientations = []
        def solve(point, semilla=None, orientacion=None):
            orientations.append(orientacion)
            return [point[0], 0, 0, 0, 0, 0]
        robot.ik = solve
        with patch("time.sleep", return_value=None):
            robot.movel(p[0.02, 0, 0], paso=0.01)
        self.assertEqual(len(orientations), 2)
        for orientation in orientations:
            self.assertTrue(np.allclose(orientation, [0, 0, 0, 1]))

    def test_movej_sends_intermediate_joint_targets(self):
        robot = self.make_robot()
        with patch("time.sleep", return_value=None):
            reached = robot.movej([0.2, 0, 0, 0, 0, 0], pasos=5, intervalo=0.01)
        self.assertEqual(len(robot.sim.commands), 30)
        self.assertAlmostEqual(reached[0], 0.2)
        self.assertAlmostEqual(robot.sim.commands[6][1], 0.05)

    def test_english_io_and_tcp_position(self):
        robot = self.make_robot()
        robot.sim.angles[:3] = [0.1, 0.2, 0.3]
        self.assertEqual(robot.tcp_position().tolist(), [0.1, 0.2, 0.3])
        self.assertEqual(robot.read_input("DI_01"), 1)
        robot.set_output("DO_00", True)
        self.assertEqual(robot.sim.signals["DO_00"], 1)
        robot.wait_input("DI_01", 1)

    def test_movel_solves_each_point_on_tcp_line(self):
        robot = self.make_robot()
        targets = []

        def solve(point, semilla=None, orientacion=None):
            targets.append(np.asarray(point).tolist())
            return [point[0], point[1], point[2], 0, 0, 0]

        robot.ik = solve
        with patch("time.sleep", return_value=None):
            reached = robot.movel([0.03, 0, 0], paso=0.01)
        self.assertEqual(len(targets), 3)
        self.assertAlmostEqual(targets[0][0], 0.01)
        self.assertAlmostEqual(targets[-1][0], 0.03)
        self.assertAlmostEqual(reached[0], 0.03)

    def test_ik_uses_configured_seed_by_default(self):
        robot = self.make_robot()
        robot._semilla_ik = np.array([1, 2, 3, 4, 5, 6], dtype=float)
        robot._entorno = 1
        robot._ik_joints = list(range(6))
        robot._ik_cyclic = [False] * 6
        robot._ik_tip = 10
        robot._ik_target = 11
        robot._ik_group = 12
        robot._ik_orientation = [0, 0, 0, 1]
        robot._prepare_ik = lambda: None

        class IK:
            result_success = 1

            def __init__(self):
                self.angles = {}
                self.target = None

            def setJointPosition(self, env, joint, angle):
                self.angles[joint] = angle

            def setObjectPose(self, env, target, pose):
                self.target = pose

            def handleGroup(self, env, group):
                return [1]

            def getJointPosition(self, env, joint):
                return self.angles[joint]

            def getObjectPose(self, env, tip):
                return self.target

        robot._ik = IK()
        self.assertEqual(robot.ik([0.3, 0, 0.4]).tolist(), [1, 2, 3, 4, 5, 6])

    def test_unreachable_line_does_not_start_motion(self):
        robot = self.make_robot()

        def solve(point, semilla=None, orientacion=None):
            if point[0] > 0.02:
                raise RuntimeError("IK sin solución")
            return [point[0], 0, 0, 0, 0, 0]

        robot.ik = solve
        with self.assertRaisesRegex(RuntimeError, "IK sin solución"):
            robot.movel([0.03, 0, 0], paso=0.01)
        self.assertEqual(robot.sim.commands, [])

    def test_contact_ignores_robot_and_static_shapes(self):
        robot = object.__new__(RobotUR)
        robot.ruta = "/UR3"
        robot.tcp = 10

        class Scene:
            handle_scene = -1
            object_shape_type = 1
            shapeintparam_static = 2

            def getObject(self, route):
                return 100

            def getObjectsInTree(self, root, kind, options):
                return [1] if root == 100 else [1, 2, 3, 4]

            def getObjectInt32Param(self, shape, parameter):
                return int(shape == 2)

            def checkProximitySensor(self, sensor, shape):
                return (1, {3: 0.009, 4: 0.005}[shape])

            def getObjectAlias(self, shape, options):
                return f"/Pieza{shape}"

        robot.sim = Scene()
        self.assertEqual(robot.detect_contact(),
                         {"ruta": "/Pieza4", "distancia": 0.005})
        self.assertIsNone(robot.detect_contact(max_distancia=0.003))

    def test_lower_until_contact_stops_at_contact_or_height_limit(self):
        robot = self.make_robot()
        robot.sim.angles[2] = 0.455
        descents = []

        def move_to(point):
            robot.sim.angles[2] = point[2]
            descents.append(point[2])

        robot.movel = move_to
        robot.detect_contact = lambda distance: ({"ruta": "/Pieza"}
                                                  if robot.sim.angles[2] <= 0.405 else None)
        self.assertEqual(robot.lower_until_contact(0.34), {"ruta": "/Pieza"})
        self.assertAlmostEqual(descents[-1], 0.405)
        self.assertGreater(len(descents), 1)

        robot.sim.angles[2] = 0.455
        descents.clear()
        robot.detect_contact = lambda distance: None
        self.assertIsNone(robot.lower_until_contact(0.44))
        self.assertAlmostEqual(descents[-1], 0.44)

    def test_activity_has_only_student_code(self):
        path = Path(__file__).resolve().parents[1] / "examples" / "06_ur3_movej_movel_pick_place.roboticalab"
        cells = json.loads(path.read_text(encoding="utf-8"))["cells"]
        self.assertEqual(len(cells), 1)
        self.assertFalse(cells[0]["collapsed"])
        for hidden_detail in ("SEMILLA", "semilla_ik", "tcp_rotation_vector", "set_dh", "forward_kinematics"):
            self.assertNotIn(hidden_detail, cells[0]["source"])
        for index, cell in enumerate(cells, 1):
            compile(cell["source"], f"<celda {index}>", "exec")

    def test_activity_descends_and_grips_detected_shape(self):
        path = Path(__file__).resolve().parents[1] / "examples" / "06_ur3_movej_movel_pick_place.roboticalab"
        cells = json.loads(path.read_text(encoding="utf-8"))["cells"]
        actions = []

        class Robot:
            def __init__(self, available=True, held=False):
                self.z = 0.455
                self.available = available
                self.held = held

            def start_simulation(self):
                actions.append(("iniciar",))

            def align_z(self, direction):
                actions.append(("align_z", direction))

            def movej(self, q):
                actions.append(("movej",))

            def movel(self, point):
                self.z = point[2]
                actions.append(("movel", self.z))

            def tcp_position(self):
                return [0.35, 0, self.z]

            def lower_until_contact(self, minimum):
                self.z = 0.405 if self.available else minimum
                actions.append(("descender", self.z))
                return ({"ruta": "/Pieza", "distancia": 0.005}
                        if self.available else None)

            def set_output(self, name, value):
                actions.append(("sujetar" if value else "soltar",))

            def read_input(self, name):
                return int(self.held)

            def wait_input(self, name, value):
                actions.append(("confirmar", value))

        namespace = {"np": np, "p": p, "conectar_ur": lambda *args, **kwargs: Robot()}
        with patch("time.sleep", return_value=None), redirect_stdout(io.StringIO()):
            for index, cell in enumerate(cells, 1):
                exec(compile(cell["source"], f"<celda {index}>", "exec"), namespace)
        self.assertEqual(actions[:4], [("iniciar",), ("soltar",), ("align_z", 1), ("movej",)])
        self.assertIn(("sujetar",), actions)
        self.assertIn(("confirmar", 1), actions)
        self.assertEqual(actions.count(("soltar",)), 1)
        self.assertAlmostEqual(actions[-1][1], 0.455)

        actions.clear()
        namespace = {"np": np, "p": p, "conectar_ur": lambda *args, **kwargs: Robot(False)}
        with patch("time.sleep", return_value=None), redirect_stdout(io.StringIO()):
            for index, cell in enumerate(cells, 1):
                exec(compile(cell["source"], f"<celda {index}>", "exec"), namespace)
        self.assertNotIn(("sujetar",), actions)
        self.assertLessEqual(actions[-1][1], 0.340)

        actions.clear()
        namespace = {"np": np, "p": p, "conectar_ur": lambda *args, **kwargs: Robot(held=True)}
        with patch("time.sleep", return_value=None), redirect_stdout(io.StringIO()):
            for index, cell in enumerate(cells, 1):
                exec(compile(cell["source"], f"<celda {index}>", "exec"), namespace)
        self.assertEqual(actions, [("iniciar",)])


if __name__ == "__main__":
    unittest.main()
