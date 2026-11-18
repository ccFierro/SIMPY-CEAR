import json
import contextlib
import io
import runpy
import socket
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

import numpy as np
import server
from roboticalab import visual


class KernelTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.kernel = server.Kernel(self.folder.name)
        self.cursor = 0
        self.assertTrue(self.kernel.ready.wait(10))

    def tearDown(self):
        self.kernel.close()
        self.folder.cleanup()

    def wait(self, kind, timeout=10):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            result = self.kernel.poll(self.cursor)
            for event in result["events"]:
                self.cursor = event["seq"]
                if event["type"] == kind:
                    return event
        self.fail(f"No llegó el evento {kind}")

    def run_code(self, source, **settings):
        self.kernel.execute({"source": source, "cellId": "1", **settings})
        return self.wait("done")

    def test_python_complete_and_shared_namespace(self):
        result = self.run_code("import math\nclass Robot:\n    def __init__(self, n):\n        self.n = n\ndef doble(x):\n    return x * 2\nvalores = [doble(i) for i in range(4)]\nnada = None\nrobot = Robot(6)")
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["variables"]["valores"], [0, 2, 4, 6])
        self.assertIsNone(result["variables"]["nada"])
        second = self.run_code("respuesta = doble(robot.n)\nassert respuesta == 12")
        self.assertEqual(second["variables"]["respuesta"], 12)

    def test_named_pose_is_visible_as_coordinates(self):
        result = self.run_code("preToma = p[-0.35, 0.335, 0.45, 0, -3.14159, 0]")
        self.assertEqual(result["variables"]["preToma"], [-0.35, 0.335, 0.45, 0, -3.14159, 0])

    def test_numpy_and_visualization(self):
        self.kernel.execute({"source": "P = np.array([2,1,1])\nT = np.array([[1,0,3],[0,1,2],[0,0,1]])\nPf = T @ P\nplot(Pf, 'Final')\nframe(T)\nprint('Pf:', Pf)", "cellId": "2"})
        self.assertEqual(self.wait("drawing")["drawing"]["point"], [5, 3, 1])
        result = self.wait("done")
        self.assertEqual(result["variables"]["Pf"], [5, 3, 1])

    def test_program_controls_update_during_python_loop(self):
        self.kernel.execute({"source": "import time\npanel = PanelControl()\nvelocidad = panel.deslizador('Velocidad', 0, 100, 10)\niniciar = panel.boton('Iniciar')\npiloto = panel.luz('Activo')\nwhile velocidad.valor < 30 or not iniciar.pulsado():\n    time.sleep(0.01)\npiloto.encender()\nresultado = [velocidad.valor, piloto.encendida]", "cellId": "10"})
        self.assertEqual(self.wait("widget")["action"], "clear")
        slider = self.wait("widget")["widget"]
        button = self.wait("widget")["widget"]
        self.assertEqual(self.wait("widget")["widget"]["type"], "light")
        self.assertEqual((slider["type"], button["type"]), ("slider", "button"))
        self.kernel.send({"action": "widget", "id": slider["id"], "value": 35})
        self.kernel.send({"action": "widget", "id": button["id"], "value": "press"})
        self.assertEqual(self.wait("widget")["action"], "update")
        self.assertEqual(self.wait("done")["variables"]["resultado"], [35, True])

    def test_legacy_matmul_is_explicit(self):
        source = "A = [[1,0],[0,1]]\nx = [3,4]\ny = A @ x"
        self.assertEqual(self.run_code(source)["status"], "error")
        self.assertEqual(self.run_code(source, legacyMatmul=True)["variables"]["y"], [3, 4])

    def test_large_integer_does_not_break_protocol(self):
        result = self.run_code("enorme = 10 ** 10000")
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["variables"]["enorme"]["type"], "int")

    def test_optional_local_client_path(self):
        module = Path(self.folder.name) / "coppeliasim_zmqremoteapi_client.py"
        module.write_text("class RemoteAPIClient:\n    def __init__(self, **kwargs):\n        self.socket = self\n    def setsockopt(self, *args): pass\n    def require(self, name): return 'cliente local'\n", encoding="utf-8")
        result = self.run_code("client, sim = connect_coppelia()", extraPath=self.folder.name)
        self.assertEqual(result["variables"]["sim"], "cliente local")

    def test_line_debugging_in_loop_and_function(self):
        self.kernel.execute({"source": "def f(x):\n    return x + 1\na = 0\nfor i in range(2):\n    a = f(a)", "cellId": "3", "mode": "step"})
        event = self.wait("paused")
        self.assertEqual(event["line"], 1)
        self.assertEqual(event["cellId"], "3")
        self.assertNotIn("a", event["variables"])
        scopes = []
        for _ in range(10):
            self.kernel.send({"action": "step"})
            event = self.wait("paused")
            scopes.append(event["scope"])
            if event["scope"] == "f":
                self.assertEqual(event["variables"]["x"], 0)
                break
        self.assertIn("f", scopes)
        self.kernel.send({"action": "resume"})
        self.assertEqual(self.wait("done")["variables"]["a"], 2)

    def test_running_code_reports_current_line_without_pausing(self):
        self.kernel.execute({"source": "import time\ntime.sleep(0.15)\nvalue = 7", "cellId": "8"})
        event = self.wait("line")
        self.assertEqual(event["cellId"], "8")
        self.assertEqual(event["line"], 1)
        self.assertEqual(self.wait("done")["variables"]["value"], 7)

    def test_input_and_live_output(self):
        self.kernel.execute({"source": "print('antes', flush=True)\nnombre = input('Nombre: ')\nprint(nombre)", "cellId": "4"})
        self.assertIn("antes", self.wait("output")["text"])
        self.assertEqual(self.wait("input")["prompt"], "Nombre: ")
        self.kernel.send({"action": "input", "value": "Ana"})
        self.assertEqual(self.wait("done")["variables"]["nombre"], "Ana")

    def test_errors_point_to_original_cell(self):
        self.kernel.execute({"source": "def falla():\n    return 1 / 0", "cellId": "5"})
        self.wait("done")
        self.kernel.execute({"source": "falla()", "cellId": "6"})
        problem = self.wait("diagnostic")["problem"]
        self.assertEqual(problem["cellId"], "5")
        self.assertEqual(problem["line"], 2)
        self.assertEqual(problem["code"], "ZeroDivisionError")
        self.wait("done")

    def test_interrupt_loop_keeps_session(self):
        self.kernel.execute({"source": "count = 0\nwhile True:\n    count += 1", "cellId": "7"})
        self.wait("started")
        time.sleep(0.05)
        self.kernel.interrupt()
        result = self.wait("done")
        self.assertEqual(result["status"], "interrupted")
        self.assertGreater(result["variables"]["count"], 0)
        self.assertEqual(self.run_code("after = count + 1")["status"], "ok")

    def test_interrupt_native_block_restarts(self):
        self.kernel.execute({"source": "import time\nold = 1\ntime.sleep(30)", "cellId": "8"})
        self.wait("started")
        time.sleep(0.1)
        self.kernel.interrupt()
        result = self.wait("done", timeout=8)
        self.assertEqual(result["status"], "restarted")
        self.assertEqual(result["variables"], {})
        self.assertEqual(self.run_code("fresh = 2")["variables"], {"fresh": 2})

    def test_exit_is_recoverable(self):
        self.kernel.execute({"source": "import os\nos._exit(0)", "cellId": "9"})
        self.wait("exit")
        self.kernel.restart()
        self.assertEqual(self.run_code("x = 1")["status"], "ok")

    def test_inspection_does_not_call_user_repr(self):
        done = self.run_code("class A:\n    def __repr__(self):\n        raise RuntimeError('No debe ejecutarse')\na = A()\nempty = np.array([])\nbig = np.zeros((100,100))")
        self.assertEqual(done["status"], "ok")
        self.assertEqual(done["variables"]["a"]["repr"], "<A>")
        self.assertEqual(done["variables"]["empty"], [])
        self.assertTrue(done["variables"]["big"]["__python__"])


class VisualTests(unittest.TestCase):
    def setUp(self):
        visual._configure(reset=True)

    def test_3d_transformation_and_frames(self):
        T = np.eye(4)
        T[:3, 3] = [4, -1, 2]
        P = np.array([1, 2, 3, 1])
        visual.plot(T @ P)
        visual.vector([1, 2, 3])
        visual.frame(T)
        visual.trayectoria([[0, 0, 0], [1, 2, 3]])
        self.assertEqual(visual.get_drawings()[0]["point"], [5, 1, 5, 1])
        self.assertEqual(len(visual.get_drawings()), 4)
        with self.assertRaises(ValueError):
            visual.plot([np.nan, 2])

    def test_rotation(self):
        theta = np.radians(90)
        R = np.array([[np.cos(theta), -np.sin(theta), 0], [np.sin(theta), np.cos(theta), 0], [0, 0, 1]])
        np.testing.assert_allclose(R @ [1, 0, 1], [0, 1, 1], atol=1e-10)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.server = server.create_server(0, self.folder.name)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.app.close()
        self.server.server_close()
        self.folder.cleanup()

    def post(self, endpoint, value, headers=None):
        request = urllib.request.Request(self.url + endpoint, data=json.dumps(value).encode(), headers=headers or {"Content-Type": "application/json", "X-RoboticaLab-Token": self.server.app.token})
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    def test_auth_origin_and_static_allowlist(self):
        for headers in [{"Content-Type": "application/json"}, {"Content-Type": "application/json", "X-RoboticaLab-Token": self.server.app.token, "Origin": "http://otro-sitio.test"}]:
            with self.assertRaises(urllib.error.HTTPError) as caught:
                self.post("/api/session", {}, headers)
            self.assertEqual(caught.exception.code, 403)
            caught.exception.read()
            caught.exception.close()
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(self.url + "/server.py")
        caught.exception.read()
        caught.exception.close()
        self.assertIn("session", self.post("/api/session", {}))

    def test_durable_storage_and_completion_export(self):
        self.post("/api/storage", {"values": {"roboticalab.autosave.v1": '{"savedAt":"2026-09-25"}'}})
        restored = server.Application(self.folder.name)
        self.assertIn("roboticalab.autosave.v1", restored.storage)
        items = self.post("/api/complete", {"source": "import math\nmath.sq", "line": 2, "column": 7})["items"]
        self.assertTrue(any(item["name"] == "sqrt" for item in items))
        source = self.post("/api/export", {"source": "x = [[1]] @ [2]", "legacyMatmul": True})["source"]
        scope = {}
        exec(source, scope)
        np.testing.assert_equal(scope["x"], [2])



if __name__ == "__main__":
    unittest.main()

class ExampleTests(unittest.TestCase):
    def test_standard_dh_against_elementary_transforms(self):
        visual._configure(reset=True)
        with contextlib.redirect_stdout(io.StringIO()):
            example = runpy.run_path(str(server.ROOT / 'examples/02_dh.py'))
        theta, d, a, alpha = 0.4, 0.7, 1.2, -0.6
        ct, st, ca, sa = np.cos(theta), np.sin(theta), np.cos(alpha), np.sin(alpha)
        rz = np.array([[ct,-st,0,0],[st,ct,0,0],[0,0,1,0],[0,0,0,1]])
        tz = np.eye(4); tz[2,3] = d
        tx = np.eye(4); tx[0,3] = a
        rx = np.array([[1,0,0,0],[0,ca,-sa,0],[0,sa,ca,0],[0,0,0,1]])
        np.testing.assert_allclose(example['dh'](theta,d,a,alpha), rz @ tz @ tx @ rx, atol=1e-12)
        expected = [2*np.cos(np.pi/6)+1.5*np.cos(5*np.pi/12), 2*np.sin(np.pi/6)+1.5*np.sin(5*np.pi/12),0]
        np.testing.assert_allclose(example['T'][:3,3], expected, atol=1e-12)

    def test_connection_failure_is_bounded(self):
        from roboticalab import connect_coppelia
        with socket.socket() as occupied:
            occupied.bind(('127.0.0.1',0))
            start = time.monotonic()
            with self.assertRaises(ConnectionError):
                connect_coppelia(port=occupied.getsockname()[1],timeout=0.15)
            self.assertLess(time.monotonic()-start,5)
