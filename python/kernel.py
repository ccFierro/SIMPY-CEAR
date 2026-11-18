"""CPython persistente. Protocolo JSON por pipes; el código corre solo en este proceso."""
import ast
import builtins
import io
import json
import linecache
import math
import os
import queue
import sys
import threading
import time
import traceback
import types

import numpy as np
import roboticalab
from roboticalab import visual, control_panel
from roboticalab.point_markers import assigned_names, named_poses, reconcile_named_points
from roboticalab.ur_scene import Pose

PROTOCOL = sys.stdout
COMMANDS = sys.stdin
LOCK = threading.Lock()
jobs = queue.Queue()
gate = threading.Condition()
state = {"running": False, "paused": False, "step": False, "stop": False, "input": None, "runId": None}
last_trace = {"time": 0.0, "location": None}
user_module = types.ModuleType("__main__")
namespace = user_module.__dict__
namespace.update({"__builtins__": builtins, "np": np})
namespace.update({name: getattr(roboticalab, name) for name in roboticalab.__all__})
namespace["_roboticalab_matmul"] = visual.legacy_matmul
baseline = dict(namespace)
cell_point_names = {}
output_size = 0


def emit(kind, **data):
    with LOCK:
        PROTOCOL.write(json.dumps({"type": kind, "runId": state["runId"], **data}, ensure_ascii=True, allow_nan=False) + "\n")
        PROTOCOL.flush()


control_panel._configure(lambda action, widget: emit("widget", action=action, widget=widget))


class Output(io.TextIOBase):
    def __init__(self, stream):
        self.stream = stream

    def writable(self):
        return True

    def write(self, text):
        global output_size
        text = str(text)
        if output_size < 1_000_000:
            remaining = 1_000_000 - output_size
            emit("output", stream=self.stream, text=text[:remaining])
            if len(text) > remaining:
                emit("output", stream="stderr", text="\n[Salida truncada: límite de 1 MB por celda]\n")
        output_size += len(text)
        return len(text)

    def flush(self):
        pass


def user_input(prompt=""):
    with gate:
        state["input"] = None
        emit("input", prompt=str(prompt))
        while state["input"] is None and not state["stop"]:
            gate.wait(0.1)
        if state["stop"]:
            raise KeyboardInterrupt("Ejecución interrumpida")
        return state["input"]


def value_json(value, depth=0):
    if type(value) is int and value.bit_length() > 1024:
        return {"__python__": True, "type": "int", "repr": f"entero de {value.bit_length()} bits"}
    if value is None or type(value) in (bool, int, str):
        return value if not isinstance(value, str) else value[:10000]
    if isinstance(value, (float, np.floating)):
        return float(value) if math.isfinite(value) else {"__python__": True, "type": type(value).__name__, "repr": str(value)}
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if type(value) is Pose:
        return list(value)
    if isinstance(value, np.ndarray) and value.size <= 4096 and value.ndim <= 2:
        return value_json(value.tolist(), depth + 1)
    if type(value) in (list, tuple) and len(value) <= 256 and depth < 4:
        return [value_json(item, depth + 1) for item in value]
    # Avoid invoking arbitrary user __repr__ or evaluating properties during inspection.
    if isinstance(value, np.ndarray):
        description = f"array {value.shape}, dtype={value.dtype} (vista resumida)"
    elif type(value) is dict:
        description = f"dict · {len(value)} entradas"
    elif isinstance(value, types.FunctionType):
        description = f"función {value.__name__}"
    elif isinstance(value, type):
        description = f"clase {value.__name__}"
    else:
        description = f"<{type(value).__name__}>"
    return {"__python__": True, "type": type(value).__name__, "repr": description}


def snapshot(extra=None):
    values = dict(namespace)
    if extra:
        values.update(extra)
    result = {}
    for name, value in list(values.items()):
        if name.startswith("_") or isinstance(value, types.ModuleType) or (name in baseline and baseline[name] is value):
            continue
        if len(result) >= 200:
            break
        try:
            result[name] = value_json(value)
        except Exception:
            result[name] = {"__python__": True, "type": type(value).__name__, "repr": "No representable"}
    return result


def trace(frame, event, arg):
    if event != "line" or not frame.f_code.co_filename.startswith("<roboticalab:"):
        return trace
    with gate:
        if state["stop"]:
            raise KeyboardInterrupt("Ejecución interrumpida")
        if not state["step"] and not state["paused"]:
            location = (frame.f_code.co_filename, frame.f_lineno)
            now = time.monotonic()
            if location != last_trace["location"] and now - last_trace["time"] >= 0.08:
                last_trace.update(time=now, location=location)
                emit("line", line=frame.f_lineno, cellId=frame.f_code.co_filename[13:-1])
        if state["step"] or state["paused"]:
            state["paused"] = True
            emit("paused", line=frame.f_lineno, cellId=frame.f_code.co_filename[13:-1], variables=snapshot(frame.f_locals), scope=frame.f_code.co_name)
            while state["paused"] and not state["stop"]:
                gate.wait(0.1)
            if state["stop"]:
                raise KeyboardInterrupt("Ejecución interrumpida")
    return trace


class LegacyMatmul(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.MatMult):
            return ast.copy_location(ast.Call(func=ast.Name(id="_roboticalab_matmul", ctx=ast.Load()), args=[node.left, node.right], keywords=[]), node)
        return node


def compile_source(source, filename, legacy=False):
    tree = ast.parse(source, filename, "exec")
    if legacy:
        tree = ast.fix_missing_locations(LegacyMatmul().visit(tree))
    return compile(tree, filename, "exec")


def execute(job):
    global output_size
    source = job["source"]
    filename = f"<roboticalab:{job['cellId']}>"
    linecache.cache[filename] = (len(source), None, source.splitlines(keepends=True), filename)
    extra_path = job.get("extraPath")
    if extra_path and extra_path not in sys.path:
        sys.path.insert(0, extra_path)
    output_size = 0
    last_trace.update(time=0.0, location=None)
    visual._configure(lambda drawing: emit("drawing", drawing=drawing))
    emit("started", cellId=job["cellId"])
    status = "ok"
    try:
        code = compile_source(source, filename, job.get("legacyMatmul", False))
        sys.settrace(trace)
        exec(code, namespace, namespace)
    except KeyboardInterrupt:
        status = "interrupted"
    except BaseException as error:
        status = "error"
        locations = [entry for entry in traceback.extract_tb(error.__traceback__) if entry.filename.startswith("<roboticalab:")]
        location = locations[-1] if locations else None
        error_filename = getattr(error, "filename", None) or (location.filename if location else filename)
        emit("diagnostic", problem={
            "code": type(error).__name__, "phase": "Sintaxis" if isinstance(error, SyntaxError) else "Ejecución",
            "line": getattr(error, "lineno", None) or (location.lineno if location else 1),
            "column": getattr(error, "offset", None) or ((location.colno or 0) + 1 if location else 1),
            "cellId": error_filename[13:-1] if error_filename.startswith("<roboticalab:") else job["cellId"],
            "message": f"{type(error).__name__}: {error}",
            "technicalDetails": "".join(traceback.format_exception(error))[-16000:],
            "hint": "Revisa la línea indicada. Los cálculos anteriores al error permanecen en la sesión."
        })
    finally:
        sys.settrace(None)
        if job.get("syncCoppeliaPoints") and status == "ok":
            cell_id = job["cellId"]
            previous = cell_point_names.get(cell_id, set())
            declared = assigned_names(source)
            poses = named_poses(namespace)
            cell_point_names[cell_id] = declared & poses.keys()
            tracked_before = bool(previous or any(cell_point_names.values()))
            for names in cell_point_names.values():
                names.intersection_update(poses)
            active_names = set().union(*cell_point_names.values()) if cell_point_names else set()
            active_poses = {name: poses[name] for name in active_names}
        else:
            tracked_before = False
        if tracked_before:
            try:
                client, sim = roboticalab.connect_coppelia(
                    host=job.get("coppeliaHost") or "127.0.0.1",
                    port=job.get("coppeliaPort") or 23000,
                    timeout=1.5,
                )
                try:
                    result = reconcile_named_points(sim, active_poses)
                    emit("point_markers", **result)
                finally:
                    client.socket.close(linger=0)
                    client.context.term()
            except Exception as error:
                emit("point_markers", markers=[], error=str(error))
        with gate:
            state.update(running=False, paused=False, step=False, stop=False)
        emit("done", status=status, variables=snapshot())


def read_commands():
    for line in COMMANDS:
        try:
            command = json.loads(line)
            action = command.get("action")
            if action == "shutdown":
                os._exit(0)
            if action == "execute":
                with gate:
                    state.update(running=True, paused=False, step=command.get("mode") == "step", stop=False, runId=command["runId"])
                jobs.put(command)
            elif action in ("pause", "resume", "step", "interrupt", "input"):
                with gate:
                    if action == "pause":
                        state["paused"] = True
                    elif action in ("resume", "step"):
                        state["paused"] = False
                        state["step"] = action == "step"
                    elif action == "interrupt":
                        state["stop"] = True
                    elif action == "input":
                        state["input"] = str(command.get("value", ""))
                    gate.notify_all()
            elif action == "widget":
                control_panel._input(command.get("id"), command.get("value"))
        except Exception as error:
            emit("protocol_error", message=str(error))
    # The parent exiting must also terminate an idle kernel.
    os._exit(0)


if __name__ == "__main__":
    sys.modules["__main__"] = user_module
    sys.stdout = Output("stdout")
    sys.stderr = Output("stderr")
    builtins.input = user_input
    emit("ready", python=sys.version.split()[0], numpy=np.__version__)
    threading.Thread(target=read_commands, daemon=True).start()
    while True:
        execute(jobs.get())
