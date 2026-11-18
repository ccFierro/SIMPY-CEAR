"""Consulta cualquier escena abierta en CoppeliaSim; no inicia movimientos."""
from roboticalab import connect_coppelia

client, sim = connect_coppelia(host="127.0.0.1", port=23000, timeout=15)
print("Estado:", sim.getSimulationState())
articulaciones = sim.getObjectsInTree(sim.handle_scene, sim.object_joint_type, 0)
for articulacion in articulaciones:
    print(sim.getObjectAlias(articulacion, 1), sim.getJointPosition(articulacion))

# En otra celda, usa las rutas reales de tu escena y su modo de control:
# articulacion = sim.getObject('/ruta/de/tu/articulacion')
# sim.startSimulation()
# sim.setJointTargetPosition(articulacion, 0.2)  # radianes para una revoluta
# sim.stopSimulation()
# El objetivo requiere una articulación configurada para control de posición.
