import math
import unittest

from roboticalab.manual_control import jog_joint, jog_target, next_joint_target, next_target_pose, scene_snapshot


class FakeSimulation:
    simulation_stopped = 0
    simulation_paused = 8
    object_joint_type = 1
    object_dummy_type = 4
    joint_revolute = 10
    joint_prismatic = 11
    jointmode_dependent = 20
    handle_scene = -1
    handle_world = -2

    def __init__(self):
        self.state = 16
        self.positions = {1: 0.0, 2: 0.1}
        self.targets = dict(self.positions)
        self.pose = [0.2, 0.0, 0.3, 0.0, 0.0, 0.0, 1.0]

    def getSimulationState(self): return self.state
    def getSimulationStopping(self): return False
    def getObject(self, path): return {"/Robot": 100, "/Robot/joint1": 1, "/Robot/joint2": 2, "/Robot/target": 3}[path]
    def getObjectsInTree(self, root, kind, options): return [1, 2] if root in (self.handle_scene, 100) else []
    def getObjectType(self, handle): return self.object_dummy_type if handle == 3 else self.object_joint_type
    def getObjectAlias(self, handle, options): return {1: "/Robot/joint1", 2: "/Robot/joint2"}[handle]
    def getJointType(self, handle): return self.joint_revolute if handle == 1 else self.joint_prismatic
    def getJointMode(self, handle): return 0
    def getJointPosition(self, handle): return self.positions[handle]
    def getJointTargetPosition(self, handle): return self.targets[handle]
    def getJointInterval(self, handle): return False, [-math.pi, 2 * math.pi] if handle == 1 else [0.0, 0.2]
    def setJointTargetPosition(self, handle, value): self.targets[handle] = value
    def getObjectPose(self, handle, relative): return list(self.pose)
    def setObjectPose(self, handle, pose, relative): self.pose = list(pose)


class ManualControlTests(unittest.TestCase):
    def test_joint_steps_use_radians_or_meters_and_obey_limits(self):
        self.assertAlmostEqual(next_joint_target(0, 1, 5, "revolute", [-math.pi, 2 * math.pi]), math.pi / 36)
        self.assertAlmostEqual(next_joint_target(0.1, -1, 5, "prismatic", [0, 0.2]), 0.095)
        with self.assertRaisesRegex(ValueError, "límite"):
            next_joint_target(0.199, 1, 5, "prismatic", [0, 0.2])
        with self.assertRaises(ValueError):
            next_joint_target(0, 1, float("nan"), "revolute")

    def test_cartesian_world_and_tool_axes(self):
        qz90 = [0, 0, math.sin(math.pi / 4), math.cos(math.pi / 4)]
        pose = [0, 0, 0, *qz90]
        world = next_target_pose(pose, "x", 1, 10, "world")
        tool = next_target_pose(pose, "x", 1, 10, "tool")
        self.assertAlmostEqual(world[0], 0.01)
        self.assertAlmostEqual(world[1], 0)
        self.assertAlmostEqual(tool[0], 0, places=9)
        self.assertAlmostEqual(tool[1], 0.01)
        turned = next_target_pose(pose, "rz", -1, 10, "world")
        self.assertAlmostEqual(sum(value * value for value in turned[3:]), 1)
        with self.assertRaises(ValueError):
            next_target_pose(pose, "x", 1, 100, "world")

    def test_scene_and_jog_are_explicit_and_require_running_simulation(self):
        sim = FakeSimulation()
        snapshot = scene_snapshot(sim, "/Robot", "/Robot/target")
        self.assertEqual(len(snapshot["joints"]), 2)
        self.assertEqual(snapshot["target"]["pose"], sim.pose)
        self.assertAlmostEqual(jog_joint(sim, "/Robot/joint1", 1, 5)["joint"]["target"], math.pi / 36)
        self.assertAlmostEqual(jog_target(sim, "/Robot/target", "z", 1, 5, "world")["target"]["pose"][2], 0.305)
        sim.state = sim.simulation_stopped
        with self.assertRaisesRegex(ValueError, "Inicia"):
            jog_joint(sim, "/Robot/joint1", 1, 5)
        with self.assertRaisesRegex(ValueError, "Inicia"):
            jog_target(sim, "/Robot/target", "x", 1, 5, "world")


if __name__ == "__main__":
    unittest.main()
