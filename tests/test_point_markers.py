import unittest

from roboticalab.point_markers import TAG, assigned_names, delete_named_points, named_poses, poses_from_sources, reconcile_named_points, sync_named_points
from roboticalab.ur_scene import p


class FakeSim:
    object_dummy_type = 4
    drawing_lines = 1
    drawing_local = 2
    drawing_overlay = 4
    colorcomponent_ambient_diffuse = 0
    handle_world = -1
    handle_scene = -2

    def __init__(self):
        self.objects = {}
        self.properties = {}
        self.poses = {}
        self.drawings = {}
        self.next_object = 0
        self.next_drawing = 100

    def getObject(self, path, options):
        return self.objects.get(path, -1)

    def getObjectType(self, handle):
        return self.object_dummy_type

    def getObjectsInTree(self, scene, kind, options):
        return list(self.objects.values())

    def getObjectPose(self, handle, reference):
        return self.poses[handle]

    def getBufferProperty(self, handle, key, options):
        return self.properties.get((handle, key))

    def setBufferProperty(self, handle, key, value):
        self.properties[handle, key] = value

    def createDummy(self, size):
        self.next_object += 1
        self.size = size
        return self.next_object

    def setObjectAlias(self, handle, alias):
        for path, other in list(self.objects.items()):
            if other == handle:
                del self.objects[path]
        self.objects["/" + alias] = handle

    def removeObjects(self, handles):
        for handle in handles:
            for path, other in list(self.objects.items()):
                if other == handle:
                    del self.objects[path]
            self.poses.pop(handle, None)

    def setObjectColor(self, handle, index, component, color):
        self.color = color

    def setObjectPose(self, handle, pose, reference):
        self.poses[handle] = pose

    def addDrawingObject(self, kind, size, tolerance, parent, count, color):
        self.next_drawing += 1
        self.drawings[self.next_drawing] = []
        self.drawing_size = size
        return self.next_drawing

    def addDrawingObjectItem(self, drawing, segment):
        self.drawings[drawing].append(segment)

    def removeDrawingObject(self, drawing):
        self.drawings.pop(drawing, None)

    def packTable(self, value):
        return value[:]

    def unpackTable(self, value):
        return value[:]


class NamedPointTests(unittest.TestCase):
    def test_only_direct_named_poses_are_selected(self):
        values = {"preToma": p[-0.35, 0.335, 0.45, 0, -3.14159, 0],
                  "otro": p[0, 0, 0], "_interno": p[1, 1, 1], "lista": [p[1, 2, 3]],
                  "numero": 42}
        self.assertEqual(list(named_poses(values)), ["preToma", "otro"])

    def test_create_and_update_named_marker_without_duplicating_it(self):
        sim = FakeSim()
        first = sync_named_points(sim, {"preToma": p[-0.35, 0.335, 0.45, 0, -3.14159, 0]})
        self.assertEqual(first[0]["path"], "/preToma")
        self.assertEqual(sim.size, 0.012)
        self.assertEqual(sim.drawing_size, 3)
        self.assertEqual(len(sim.drawings), 3)
        handle = sim.objects["/preToma"]
        self.assertEqual(sim.properties[handle, TAG], b"preToma")
        self.assertEqual(sim.poses[handle][:3], [-0.35, 0.335, 0.45])
        sync_named_points(sim, {"preToma": p[-0.34, 0.335, 0.45]})
        self.assertEqual(sim.next_object, 1)
        self.assertEqual(sim.poses[handle][:3], [-0.34, 0.335, 0.45])
        self.assertEqual(len(sim.drawings), 0)

    def test_deleting_point_removes_only_owned_marker(self):
        sim = FakeSim()
        sync_named_points(sim, {"preToma": p[1, 2, 3]})
        self.assertEqual(delete_named_points(sim, ["preToma"]), ["preToma"])
        self.assertNotIn("/preToma", sim.objects)
        self.assertEqual(delete_named_points(sim, ["preToma"]), [])

    def test_renames_existing_marker_from_previous_version(self):
        sim = FakeSim()
        sim.objects["/CEAR_Punto_preToma"] = 8
        sim.properties[8, TAG] = b"preToma"
        result = sync_named_points(sim, {"preToma": p[1, 2, 3]})
        self.assertEqual(result[0]["path"], "/preToma")
        self.assertEqual(sim.objects["/preToma"], 8)
        self.assertNotIn("/CEAR_Punto_preToma", sim.objects)

    def test_reconcile_replaces_changed_and_removes_old_points(self):
        sim = FakeSim()
        reconcile_named_points(sim, {"preToma": p[-0.35, 0.335, 0.45, 0, -3.14159, 0]})
        first_handle = sim.objects["/preToma"]
        unchanged = reconcile_named_points(sim, {"preToma": p[-0.35, 0.335, 0.45, 0, -3.14159, 0]})
        self.assertEqual(unchanged["deleted"], [])
        self.assertEqual(sim.objects["/preToma"], first_handle)
        self.assertEqual(unchanged["markers"], [])
        changed = reconcile_named_points(sim, {"preToma": p[-0.34, 0.335, 0.45, 0, -3.14159, 0]})
        self.assertEqual(changed["deleted"], ["preToma"])
        self.assertNotEqual(sim.objects["/preToma"], first_handle)
        renamed = reconcile_named_points(sim, {"preToma2": p[0, 0, 0.45]})
        self.assertEqual(renamed["deleted"], ["preToma"])
        self.assertNotIn("/preToma", sim.objects)
        self.assertIn("/preToma2", sim.objects)

    def test_assigned_names_only_lists_executed_cell_assignments(self):
        self.assertEqual(assigned_names("preToma = p[1, 2, 3]\nx = 4\ndel x"), {"preToma", "x"})

    def test_preview_reads_points_without_executing_code(self):
        sources = ["x = 0.35\npreToma = p[-x, 0.335, 0.45, 0, -np.pi, 0]",
                   "raise RuntimeError('no ejecutar')\nponer = p[x, 0, 0.4]",
                   "incompleto = p[\notro = p[0, 0.1, 0.4]"]
        poses = poses_from_sources(sources)
        self.assertEqual(list(poses), ["preToma", "poner", "otro"])
        self.assertEqual(poses["preToma"][0], -0.35)
        self.assertAlmostEqual(poses["preToma"][4], -3.141592653589793)
        self.assertEqual(poses["otro"], p[0, 0.1, 0.4])

    def test_preview_tracks_renames_and_changed_source(self):
        sim = FakeSim()
        reconcile_named_points(sim, poses_from_sources(["target_1 = p[0, 0, 0.4]"]))
        self.assertIn("/target_1", sim.objects)
        result = reconcile_named_points(sim, poses_from_sources(["target_2 = p[0.1, 0, 0.4]"]))
        self.assertEqual(result["deleted"], ["target_1"])
        self.assertIn("/target_2", sim.objects)
        reconcile_named_points(sim, {})
        self.assertNotIn("/target_2", sim.objects)

    def test_existing_unowned_object_is_not_modified(self):
        sim = FakeSim()
        sim.objects["/preToma"] = 8
        result = sync_named_points(sim, {"preToma": p[1, 2, 3]})
        self.assertEqual(result[0]["status"], "name_conflict")
        self.assertNotIn(8, sim.poses)


if __name__ == "__main__":
    unittest.main()
