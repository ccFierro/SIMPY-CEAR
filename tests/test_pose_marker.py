import math
import unittest
from unittest.mock import MagicMock, patch

from roboticalab.pose_marker import marker_action


class FakeSim:
    object_dummy_type = 4
    object_proximitysensor_type = 7
    drawing_lines = 1
    drawing_local = 2
    drawing_overlay = 4
    handle_world = -1

    def __init__(self):
        self.handle = None
        self.pose = None
        self.data = {}
        self.drawings = {}
        self.next_drawing = 10
        self.sensor_pose = [0.35, 0, 0.45, 1, 0, 0, 0]
        self.drawing_properties = {}

    def getObject(self, path, options):
        if path == "/UR3/suctionPad/Sensor":
            return 2
        return self.handle if path == "/CEAR_PoseMarker" and self.handle is not None else -1

    def getObjectType(self, handle):
        return self.object_proximitysensor_type if handle == 2 else self.object_dummy_type

    def getBufferProperty(self, handle, key, options):
        return self.data.get(key)

    def setBufferProperty(self, handle, key, value):
        self.data[key] = value

    def createDummy(self, size):
        self.handle = 1
        return 1

    def setObjectAlias(self, handle, name):
        self.alias = name

    def setObjectPose(self, handle, pose, reference):
        self.pose = list(pose)

    def getObjectPose(self, handle, reference):
        return self.sensor_pose[:] if handle == 2 else self.pose[:]

    def addDrawingObject(self, kind, size, tolerance, parent, count, color):
        self.next_drawing += 1
        self.drawings[self.next_drawing] = []
        self.drawing_properties[self.next_drawing] = (kind, size, parent, count, color)
        return self.next_drawing

    def addDrawingObjectItem(self, drawing, item):
        self.drawings[drawing].append(item)

    def removeDrawingObject(self, drawing):
        del self.drawings[drawing]

    def removeObjects(self, handles):
        if handles == [self.handle]:
            self.handle = None
            self.pose = None
            self.data.clear()

    def packTable(self, values):
        return values[:]

    def unpackTable(self, values):
        return values[:]


class PoseMarkerTests(unittest.TestCase):
    def test_create_set_jog_and_read_never_move_robot(self):
        sim = FakeSim()
        created = marker_action(sim, "markerCreate", {})
        self.assertEqual(created["code"], "p[0, 0, 0.35, 0, 0, 0]")
        self.assertEqual(len(sim.drawings), 3)
        self.assertTrue(all(len(lines) == 3 for lines in sim.drawings.values()))
        self.assertTrue(all(props[:2] == (7, 7) for props in sim.drawing_properties.values()))
        updated = marker_action(sim, "markerSet", {"position": [0.35, 0, 0.45], "rotation": [0, 0, math.pi / 2]})
        self.assertEqual(updated["position"], [0.35, 0, 0.45])
        self.assertAlmostEqual(updated["rotation"][2], math.pi / 2)
        marker_action(sim, "markerJog", {"axis": "x", "direction": 1, "step": 10})
        self.assertAlmostEqual(sim.pose[0], 0.35)
        self.assertAlmostEqual(sim.pose[1], 0.01)
        marker_action(sim, "markerJog", {"axis": "x", "direction": 1, "step": 10, "frame": "world"})
        self.assertAlmostEqual(sim.pose[0], 0.36)
        self.assertAlmostEqual(sim.pose[1], 0.01)
        rotated = marker_action(sim, "markerJog", {"axis": "rz", "direction": 1, "step": 90})
        self.assertAlmostEqual(rotated["rotation"][2], math.pi, places=5)
        with self.assertRaisesRegex(ValueError, "Giro cartesiano"):
            marker_action(sim, "markerJog", {"axis": "rz", "direction": 1, "step": 91})
        self.assertEqual(len(sim.drawings), 3)
        self.assertIn("p[", marker_action(sim, "markerRead", {})["code"])

    def test_aligns_marker_to_selected_sensor_and_deletes_only_marker(self):
        sim = FakeSim()
        aligned = marker_action(sim, "markerAlignTcp", {"sensorPath": "/UR3/suctionPad/Sensor"})
        self.assertEqual(aligned["position"], sim.sensor_pose[:3])
        self.assertEqual(sim.pose, sim.sensor_pose)
        self.assertEqual(len(sim.drawings), 3)
        deleted = marker_action(sim, "markerDelete", {})
        self.assertTrue(deleted["deleted"])
        self.assertIsNone(sim.handle)
        self.assertEqual(sim.drawings, {})
        self.assertEqual(sim.sensor_pose, [0.35, 0, 0.45, 1, 0, 0, 0])
        with self.assertRaisesRegex(ValueError, "sensor TCP"):
            marker_action(sim, "markerAlignTcp", {"sensorPath": "/other"})

    def test_moves_selected_tcp_to_marker_pose_only_after_ik_preflight(self):
        sim = FakeSim()
        marker_action(sim, "markerCreate", {})
        robot = MagicMock()
        robot._entorno = 9
        with patch("roboticalab.pose_marker.scene_inventory", return_value={"robots": [
                {"path": "/UR3", "joints": list(range(6))}]}), \
             patch("roboticalab.pose_marker.RobotUR", return_value=robot) as factory:
            result = marker_action(sim, "markerMoveTcp",
                                   {"sensorPath": "/UR3/suctionPad/Sensor"}, client=object())
        self.assertTrue(result["ok"])
        self.assertEqual(factory.call_args.kwargs["ruta"], "/UR3")
        self.assertEqual(tuple(robot.movej.call_args.args[0]), (0, 0, 0.35, 0, 0, 0))
        robot._ik.eraseEnvironment.assert_called_once_with(9)

    def test_move_tcp_rejects_missing_marker_before_robot_command(self):
        sim = FakeSim()
        with self.assertRaisesRegex(ValueError, "Crea primero"):
            marker_action(sim, "markerMoveTcp", {"sensorPath": "/UR3/suctionPad/Sensor"}, client=object())

    def test_rejects_unowned_object(self):
        sim = FakeSim()
        sim.handle = 1
        with self.assertRaisesRegex(ValueError, "ocupado"):
            marker_action(sim, "markerCreate", {})


if __name__ == "__main__":
    unittest.main()
