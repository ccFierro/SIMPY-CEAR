"""Prueba el recorrido de la actividad docente con una escena simulada."""

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import numpy as np


ACTIVITY = Path(__file__).resolve().parents[1] / "examples" / "05_ur3_ciclo_completo.roboticalab"


class FakeScene:
    simulation_stopped = 0
    simulation_paused = 2
    object_proximitysensor_type = 5
    shapeintparam_static = 1001
    handle_world = -1

    def __init__(self):
        self.angles = {f"/UR3/joint{index}": 0.0 for index in range(6)}
        self.targets = []
        self.outputs = []
        self.detected = 0
        self.vacuum = None
        self.suction_detected = 1
        self.suction_distance = 0.005
        self.cube_position = [0.35, 0.0, 0.35]

    def getSimulationState(self):
        return 17

    def getObject(self, path):
        return path

    def getObjectsInTree(self, root, kind, options):
        return ["/UR3/suctionPad/Sensor"]

    def getObjectAlias(self, handle, options):
        return handle

    def checkProximitySensor(self, sensor, shape):
        return (self.suction_detected, self.suction_distance, None, None, None)

    def getObjectInt32Param(self, shape, parameter):
        return int(shape == "/Cuboid[0]")

    def setObjectPosition(self, shape, position, relative_to):
        self.cube_position = list(position)

    def resetDynamicObject(self, shape):
        pass

    def getObjectPosition(self, shape, relative_to):
        if shape.endswith("/Sensor"):
            return [0.35, 0.0, 0.405]
        if self.vacuum != 1:
            return list(self.cube_position)
        if self.angles["/UR3/joint0"] > 3.0:
            return [0.0, 0.35, 0.37]
        if self.angles["/UR3/joint2"] > -1.7:
            return [0.35, 0.0, 0.4]
        return list(self.cube_position)

    def getJointPosition(self, handle):
        return self.angles[handle]

    def getJointInterval(self, handle):
        return handle.endswith("joint5"), [-6.28, 12.56]

    def setJointTargetPosition(self, handle, angle):
        self.targets.append((handle, angle))
        if handle.endswith("joint5"):
            angle = (angle + np.pi) % (2 * np.pi) - np.pi
        self.angles[handle] = angle

    def getInt32Signal(self, name):
        return {"DI_00": self.detected, "DI_01": int(self.vacuum == 1),
                "DO_00": self.vacuum}[name]

    def setInt32Signal(self, name, value):
        assert name == "DO_00"
        if self.vacuum == 1 and value == 0:
            self.cube_position = [0.0, 0.35, 0.35]
        self.vacuum = value
        self.outputs.append(value)


class CompleteActivityTests(unittest.TestCase):
    def prepare(self):
        activity = json.loads(ACTIVITY.read_text(encoding="utf-8"))
        sim = FakeScene()
        fake_package = types.ModuleType("roboticalab")
        fake_package.connect_coppelia = lambda **kwargs: (object(), sim)
        fake_package.leer_articulaciones = lambda *_: [
            {"ruta": path, "rad": angle} for path, angle in sim.angles.items()
        ]
        namespace = {}
        with patch.dict(sys.modules, {"roboticalab": fake_package}), patch("time.sleep", return_value=None), redirect_stdout(io.StringIO()):
            for index, cell in enumerate(activity["cells"], 1):
                self.assertTrue(cell["title"])
                if index == 8:
                    # La ruta IK se verificó en Coppelia; aquí probamos el ciclo y sus barreras.
                    namespace["_real_planner"] = namespace["planificar_traslado"]
                    namespace["planificar_traslado"] = lambda *_: {
                        "origen": np.array([0.35, 0.0, 0.35]),
                        "destino": np.array([0.0, 0.35, 0.35]),
                        "q_aproximacion": np.array([1.897, -0.151, -1.603, 0.184, 1.571, 2.598]),
                        "q_toma": np.array([1.897, -0.212, -1.775, 0.416, 1.571, 2.598]),
                        "q_elevada": np.array([1.897, -0.151, -1.603, 0.184, 1.571, 2.598]),
                        "ruta": [np.array([3.468, -0.181, -1.713, 0.324, 1.571, 4.169])],
                        "punto_toma": np.array([0.35, 0.0, 0.405]),
                    }
                exec(compile(cell["source"], f"<celda {index}>", "exec"), namespace)
                if index == 3:
                    namespace["mover_articulaciones"].__defaults__ = (3, 0, 2, 1)
        return sim, namespace

    def test_play_completes_pick_place_and_returns(self):
        sim, namespace = self.prepare()
        self.assertTrue(any(abs(angle) > 0.01 for _, angle in sim.targets))
        self.assertTrue(all(abs(angle) < 1e-9 for angle in sim.angles.values()))
        self.assertEqual(sim.outputs, [0, 1, 0])
        self.assertEqual(namespace["cinematica_directa"](np.zeros(6)).shape, (4, 4))

    def test_pick_place_confirms_both_inputs_and_releases(self):
        sim, namespace = self.prepare()
        sim.outputs.clear()
        sim.cube_position = [0.35, 0.0, 0.35]
        with patch("time.sleep", return_value=None), redirect_stdout(io.StringIO()):
            namespace["trasladar_cuboide"]("/Cuboid[1]", [0.0, 0.35, 0.35])
        self.assertEqual(sim.outputs, [0, 1, 0])

    def test_no_object_prevents_vacuum(self):
        sim, namespace = self.prepare()
        sim.outputs.clear()
        sim.cube_position = [0.35, 0.0, 0.35]
        sim.suction_detected = 0
        with patch("time.sleep", return_value=None), self.assertRaisesRegex(RuntimeError, "cuboide no está tocando"):
            namespace["trasladar_cuboide"]("/Cuboid[1]", [0.0, 0.35, 0.35])
        self.assertNotIn(1, sim.outputs)

    def test_distant_object_does_not_activate_suction(self):
        sim, namespace = self.prepare()
        sim.outputs.clear()
        sim.cube_position = [0.35, 0.0, 0.35]
        sim.suction_distance = 0.02
        with patch("time.sleep", return_value=None), self.assertRaisesRegex(RuntimeError, "cuboide no está tocando"):
            namespace["trasladar_cuboide"]("/Cuboid[1]", [0.0, 0.35, 0.35])
        self.assertNotIn(1, sim.outputs)

    def test_static_table_is_not_accepted_as_pickup_piece(self):
        sim, namespace = self.prepare()
        sim.outputs.clear()
        sim.cube_position = [0.35, 0.0, 0.35]
        with self.assertRaisesRegex(ValueError, "debe ser dinámica"):
            namespace["_real_planner"]("/Cuboid[0]", [0.0, 0.35, 0.35])
        self.assertEqual(sim.outputs, [])

    def test_joint_limit_rejects_target_before_command(self):
        sim, namespace = self.prepare()
        previous = len(sim.targets)
        with self.assertRaisesRegex(ValueError, "limite articular"):
            namespace["mover_articulaciones"](np.array([10, 0, 0, 0, 0, 0]))
        self.assertEqual(len(sim.targets), previous)


if __name__ == "__main__":
    unittest.main()
