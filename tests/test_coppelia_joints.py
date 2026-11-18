import sys
from pathlib import Path
import json
import unittest
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from roboticalab import leer_articulaciones


class FakeScene:
    object_joint_type = 4

    def __init__(self):
        self.paths = {"/UR5": 10, **{f"/UR5/joint{i}": i for i in range(1, 7)}}
        self.parent = {10: -1, 1: 10, **{i: i - 1 for i in range(2, 7)}}

    def getObject(self, path):
        return self.paths[path]

    def getObjectsInTree(self, *_):
        return [4, 2, 6, 1, 5, 3]

    def getObjectParent(self, handle):
        return self.parent[handle]

    def getObjectAlias(self, handle, *_):
        return f"/UR5/joint{handle}"

    def getJointPosition(self, handle):
        return handle / 10


class ReadJointsTests(unittest.TestCase):
    def test_orders_six_joints_from_base_to_wrist(self):
        data = leer_articulaciones(FakeScene(), "/UR5")
        self.assertEqual([row["ruta"] for row in data], [f"/UR5/joint{i}" for i in range(1, 7)])
        self.assertEqual([row["rad"] for row in data], [i / 10 for i in range(1, 7)])

    def test_rejects_branch_as_serial_chain(self):
        scene = FakeScene()
        scene.parent[6] = 3
        with self.assertRaisesRegex(ValueError, "cadena ordenada"):
            leer_articulaciones(scene, "/UR5")

    def test_ur_activity_fk_at_zero(self):
        activity_path = Path(__file__).resolve().parents[1] / "examples" / "04_ur3_ur5_lectura_dh.roboticalab"
        activity = json.loads(activity_path.read_text(encoding="utf-8"))
        self.assertEqual(len(activity["cells"]), 3)
        scope = {"np": np}
        exec(activity["cells"][1]["source"], scope)
        ur3_zero = scope["cinematica_directa"](np.zeros(6), scope["tabla_ur3"])
        np.testing.assert_allclose(ur3_zero[:3, 3], [-0.4569, -0.19425, 0.06655], atol=1e-9)
        ur5_zero = scope["cinematica_directa"](np.zeros(6), scope["tabla_ur5"])
        np.testing.assert_allclose(ur5_zero[:3, 3], [-0.81725, -0.19145, -0.005491], atol=1e-9)
        np.testing.assert_allclose(ur5_zero[:3, :3].T @ ur5_zero[:3, :3], np.eye(3), atol=1e-12)


if __name__ == "__main__":
    unittest.main()
