"""Comprueba el destino manual antes de enviar movimiento al robot."""

import unittest
from unittest.mock import MagicMock, patch

from roboticalab.cartesian_jog import cartesian_jog_action
from roboticalab.ur_scene import Pose


class CartesianDestinationTests(unittest.TestCase):
    def test_moves_to_six_value_pose_and_rejects_incomplete_destination(self):
        sim = MagicMock()
        robot = MagicMock()
        robot._entorno = None
        pose = [0.25, -0.1, 0.4, 0, 3.14159, 0]
        with (patch("roboticalab.cartesian_jog._capability"),
              patch("roboticalab.cartesian_jog._robot", return_value=robot),
              patch("roboticalab.cartesian_jog.sensor_pose", return_value={"ok": True})):
            result = cartesian_jog_action(sim, None, "robotJogMovePose",
                                          {"sensorPath": "/UR3/Sensor", "pose": pose})
            self.assertTrue(result["ok"])
            sent = robot.movej.call_args.args[0]
            self.assertIsInstance(sent, Pose)
            self.assertEqual(list(sent), pose)
            with self.assertRaisesRegex(ValueError, "seis|rx"):
                cartesian_jog_action(sim, None, "robotJogMovePose",
                                     {"sensorPath": "/UR3/Sensor", "pose": pose[:3]})
            self.assertEqual(robot.movej.call_count, 1)


if __name__ == "__main__":
    unittest.main()
