"""La actividad inicial prepara funciones sin mandar movimientos ni salidas."""

import json
from pathlib import Path
import unittest

import numpy as np


ACTIVITY = Path(__file__).resolve().parents[1] / "examples" / "05_ur3_preparar_toma_entrega.roboticalab"


class ReadOnlyScene:
    def getObject(self, path):
        return path

    def getJointPosition(self, handle):
        return 0.0

    def startSimulation(self):
        raise AssertionError("La actividad no debe iniciar la simulación")

    def setJointTargetPosition(self, *args):
        raise AssertionError("La actividad no debe mover el robot")

    def setInt32Signal(self, *args):
        raise AssertionError("La actividad no debe activar salidas")


class Ur3ActivityTests(unittest.TestCase):
    def test_initial_run_defines_tools_without_motion(self):
        activity = json.loads(ACTIVITY.read_text(encoding="utf-8"))
        sim = ReadOnlyScene()
        paths = ["/UR3/joint" + str(index) for index in range(1, 7)]
        namespace = {
            "np": np,
            "connect_coppelia": lambda **kwargs: (object(), sim),
            "leer_articulaciones": lambda *_: [
                {"ruta": path, "rad": 0.0} for path in paths
            ],
        }
        for index, cell in enumerate(activity["cells"], start=1):
            self.assertTrue(cell["title"])
            exec(compile(cell["source"], f"<celda {index}>", "exec"), namespace)
        self.assertEqual(len(namespace["rutas"]), 6)
        self.assertEqual(namespace["q_prueba"].shape, (6,))
        self.assertIsNone(namespace["q_toma"])
        self.assertIsNone(namespace["q_entrega"])


if __name__ == "__main__":
    unittest.main()
