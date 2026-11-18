import unittest

from roboticalab.scene_objects import EscenaCoppelia


class FakeSim:
    primitiveshape_cuboid = 0
    object_shape_type = 1
    shapeintparam_static = 2
    shapeintparam_respondable = 3
    handle_world = -1
    simulation_stopped = 0

    def __init__(self):
        self.objects = {10: {"name": "Plantilla", "static": 1, "position": [0, 0, 0],
                             "size": [0.1, 0.1, 0.1]}}
        self.next_handle = 11
        self.removed = []
        self.copy_options = None

    def getObject(self, path, options=None):
        for handle, obj in self.objects.items():
            if path == "/" + obj["name"]:
                return handle
        if options and options.get("noError"):
            return -1
        raise RuntimeError("No existe " + path)

    def getObjectType(self, handle):
        return self.object_shape_type

    def createPrimitiveShape(self, primitive, size, options):
        handle = self.next_handle
        self.next_handle += 1
        self.objects[handle] = {"name": "nuevo", "size": size, "position": [0, 0, 0]}
        return handle

    def copyPasteObjects(self, handles, options):
        self.copy_options = options
        handle = self.next_handle
        self.next_handle += 1
        self.objects[handle] = self.objects[handles[0]].copy()
        return [handle]

    def setObjectParent(self, handle, parent, keep):
        self.objects[handle]["parent"] = parent

    def setObjectAlias(self, handle, name):
        self.objects[handle]["name"] = name

    def setObjectPosition(self, handle, position, relative):
        self.objects[handle]["position"] = position

    def getObjectPosition(self, handle, relative):
        return self.objects[handle]["position"]

    def getObjectPose(self, handle, relative):
        return [*self.objects[handle]["position"], 0, 0, 0, 1]

    def getShapeBB(self, handle):
        return self.objects[handle]["size"], [0, 0, 0, 0, 0, 0, 1]

    def computeMassAndInertia(self, handle, density):
        self.objects[handle]["density"] = density
        return 1

    def setObjectInt32Param(self, handle, param, value):
        self.objects[handle]["static" if param == 2 else "respondable"] = value

    def getSimulationState(self):
        return 0

    def removeObjects(self, handles):
        self.removed.extend(handles)
        for handle in handles:
            del self.objects[handle]


class SceneObjectTests(unittest.TestCase):
    def test_cube_and_copy_keep_original_and_delete_only_created_objects(self):
        sim = FakeSim()
        scene = EscenaCoppelia(None, sim)
        cube = scene.create_cube("Cubo_1", [0.35, 0, 0.4], lado=0.1)
        copy = scene.copy_object("/Plantilla", "Cubo_2", [0, 0.35, 0.4])
        self.assertEqual(sim.objects[cube]["static"], 0)
        self.assertEqual(sim.objects[copy]["static"], 0)
        self.assertEqual(sim.objects[copy]["position"], [0, 0.35, 0.4])
        self.assertEqual(sim.copy_options, 14)
        self.assertEqual(sim.objects[10]["static"], 1)
        with self.assertRaises(ValueError):
            scene.delete_object("/Plantilla")
        scene.delete_object(copy)
        scene.delete_object("/Cubo_1")
        self.assertEqual(set(sim.objects), {10})

    def test_copy_can_start_on_horizontal_surface_without_visible_fall(self):
        sim = FakeSim()
        sim.objects[11] = {"name": "Mesa", "static": 1,
                           "position": [0.3, 0.2, 0.3], "size": [1, 1, 0.1]}
        sim.next_handle = 12
        scene = EscenaCoppelia(None, sim)
        copy = scene.copy_object("/Plantilla", "Pieza", [0.3, 0.2], sobre="/Mesa")
        self.assertAlmostEqual(sim.objects[copy]["position"][2], 0.401)
        self.assertEqual(sim.objects[copy]["static"], 0)
        cube = scene.create_cube("Otro", [0, 0], lado=0.1, sobre="/Mesa")
        self.assertAlmostEqual(sim.objects[cube]["position"][2], 0.401)
        with self.assertRaises(ValueError):
            scene.copy_object("/Plantilla", "Mal", [0, 0, 0.4], sobre="/Mesa")
        self.assertEqual(sim.objects[10]["position"], [0, 0, 0])

    def test_copy_can_disable_dynamics_and_response(self):
        sim = FakeSim()
        scene = EscenaCoppelia(None, sim)
        copy = scene.copy_object("/Plantilla", "CuboFijo", [0, 0, 0.4],
                                 dinamico=0, respondable=0)
        self.assertEqual(sim.objects[copy]["static"], 1)
        self.assertEqual(sim.objects[copy]["respondable"], 0)
        self.assertEqual(sim.objects[10]["static"], 1)


if __name__ == "__main__":
    unittest.main()
