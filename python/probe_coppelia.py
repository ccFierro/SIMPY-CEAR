"""Consulta aislada y acotada de la API de una escena genérica."""
import json
from pathlib import Path
import sys

data = json.load(sys.stdin)
extra_path = data.get("extraPath")
if extra_path:
    if not Path(extra_path).is_dir():
        raise ValueError("La carpeta local de ZeroMQ no existe")
    sys.path.insert(0, extra_path)

from roboticalab import connect_coppelia
from roboticalab.manual_control import jog_joint, jog_target, scene_snapshot, simulation_running
from roboticalab.scene_inventory import scene_inventory, sensor_pose, identify_equipment, test_conveyor
from roboticalab.pose_marker import marker_action
from roboticalab.cartesian_jog import cartesian_jog_action

client = None
try:
    client, sim = connect_coppelia(data.get("host", "127.0.0.1"), int(data.get("port", 23000)), timeout=3)
    action = data["action"]
    if action == "stop":
        sim.stopSimulation()
        result = {"ok": True, "message": "Solicitud de detener simulación enviada."}
    elif action == "start":
        if sim.getSimulationState() != sim.simulation_stopped:
            raise ValueError("La simulación ya está iniciada o pausada. Reanúdala en CoppeliaSim.")
        sim.startSimulation()
        result = {"ok": True, "message": "Simulación iniciada."}
    elif action == "scene":
        result = scene_snapshot(sim, data.get("rootPath", ""), data.get("targetPath", ""))
    elif action == "inventory":
        result = scene_inventory(sim)
    elif action == "tcpPose":
        result = sensor_pose(sim, data.get("path"))
    elif action == "identifyEquipment":
        result = identify_equipment(sim, data.get("channel"))
    elif action == "testConveyor":
        result = test_conveyor(sim, data.get("channel"))
    elif action == "jogJoint":
        result = jog_joint(sim, data.get("path"), data.get("direction"), data.get("step"))
    elif action == "jogTarget":
        result = jog_target(sim, data.get("path"), data.get("axis"), data.get("direction"),
                            data.get("step"), data.get("frame", "world"))
    elif action in ("markerCreate", "markerRead", "markerSet", "markerJog", "markerAlignTcp", "markerMoveTcp", "markerDelete"):
        result = marker_action(sim, action, data, client)
    elif action in ("robotJogStart", "robotJogHeartbeat", "robotJogStop", "robotJogRead", "robotJogAlignZ"):
        result = cartesian_jog_action(sim, client, action, data)
    else:
        result = {"ok": True, "message": "CoppeliaSim conectado", "state": sim.getSimulationState(),
                  "running": simulation_running(sim), "version": sim.getInt32Param(sim.intparam_program_version)}
    print(json.dumps(result))
except Exception as error:
    print(json.dumps({"ok": False, "message": str(error)}))
finally:
    if client:
        client.socket.close(linger=0)
        client.context.term()
