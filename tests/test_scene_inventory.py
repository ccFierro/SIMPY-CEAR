import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from roboticalab.scene_inventory import scene_inventory, sensor_pose


class FakeSim:
    handle_scene = -1
    handle_all = -2
    object_joint_type = 1
    object_proximitysensor_type = 2
    object_visionsensor_type = 3
    object_forcesensor_type = 4
    simulation_stopped = 0
    simulation_paused = 2

    def getObjectsInTree(self, _, kind, __):
        return {1: [2], 2: [3], 3: [], 4: []}[kind]

    def getObjectAlias(self, handle, *_):
        return {1: "/UR3", 2: "/UR3/joint", 3: "/LaserSensor"}[handle]

    def getObjectType(self, handle):
        return {1: 9, 2: 1, 3: 2, 4: 9}[handle]

    def getObjectParent(self, handle):
        return {2: 1, 1: -1}[handle]

    def getBufferProperty(self, *_):
        return b"manifest"

    def unpackTable(self, *_):
        return {"schema": 1, "robots": [{"path": "/UR3", "name": "Robot de prueba"}],
                "sensors": [{"path": "/LaserSensor", "name": "Láser"}],
                "signals": [{"name": "DI_00", "label": "Presencia", "direction": "input"}]}

    def getInt32Signal(self, name):
        return {"DI_00": 1}.get(name)

    def getSimulationState(self):
        return 0

    def getSimulationStopping(self):
        return False


class SceneInventoryTests(unittest.TestCase):
    def test_manifest_and_scene_objects(self):
        data = scene_inventory(FakeSim())
        self.assertEqual(data["robots"], [{"path": "/UR3", "name": "Robot de prueba", "joints": ["/UR3/joint"]}])
        self.assertEqual(data["sensors"][0]["name"], "Láser")
        self.assertEqual(data["signals"][0]["value"], 1)
        self.assertFalse(data["running"])

    def test_legacy_signals_without_manifest(self):
        sim = FakeSim()
        sim.getBufferProperty = lambda *_: None
        sim.getObjectAlias = lambda handle, *_: {1: "/UR3", 2: "/UR3/joint", 3: "/UR3/suctionPad/Sensor"}[handle]
        data = scene_inventory(sim)
        self.assertFalse(data["declared"])
        self.assertEqual([item["name"] for item in data["signals"]], ["DI_00", "DI_01", "DO_00"])
        self.assertEqual(data["signals"][1]["label"], "Ventosa: objeto sujeto")

    def test_discovers_standard_signals_without_manifest(self):
        sim = FakeSim()
        sim.getBufferProperty = lambda *_: None
        sim.getPropertyName = lambda _target, index, _options: ["signal.DI_02", "signal.DO_03", None][index]
        sim.getInt32Signal = lambda name: {"DI_02": 1, "DO_03": 0}.get(name)
        data = scene_inventory(sim)
        signals = {item["name"]: item for item in data["signals"]}
        self.assertEqual(signals["DI_02"]["direction"], "input")
        self.assertEqual(signals["DO_03"]["direction"], "output")
        self.assertEqual(signals["DO_03"]["value"], 0)

    def test_reads_selected_sensor_pose_in_world(self):
        sim = FakeSim()
        sim.handle_world = -1
        sim.getObject = lambda path, _options: 3 if path == "/UR3/suctionPad/Sensor" else -1
        sim.getObjectAlias = lambda handle, *_: "/UR3/suctionPad/Sensor" if handle == 3 else ""
        sim.getObjectPose = lambda handle, frame: [0.35, 0, 0.4, 1, 0, 0, 0]
        result = sensor_pose(sim, "/UR3/suctionPad/Sensor")
        self.assertEqual(result["position"], [0.35, 0, 0.4])
        self.assertAlmostEqual(result["rotation"][0], 3.141592653589793)
        with self.assertRaisesRegex(ValueError, "disponible"):
            sensor_pose(sim, "/missing")


if __name__ == "__main__":
    unittest.main()
