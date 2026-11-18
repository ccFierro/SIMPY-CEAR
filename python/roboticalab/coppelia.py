"""Conexión explícita al cliente oficial ZeroMQ. No inicia movimientos."""
import zmq


def connect_coppelia(host="127.0.0.1", port=23000, timeout=5.0):
    """Devuelve (client, sim). timeout está expresado en segundos por recepción."""
    from coppeliasim_zmqremoteapi_client import RemoteAPIClient
    if not isinstance(host, str) or not host.strip() or not 1 <= int(port) <= 65535:
        raise ValueError("Host o puerto de CoppeliaSim inválido.")
    if not 0.1 <= float(timeout) <= 60:
        raise ValueError("El tiempo de espera debe estar entre 0.1 y 60 segundos.")
    client = RemoteAPIClient(host=host.strip(), port=int(port))
    client.socket.setsockopt(zmq.LINGER, 0)
    client.socket.setsockopt(zmq.RCVTIMEO, int(timeout * 1000))
    client.socket.setsockopt(zmq.SNDTIMEO, int(timeout * 1000))
    if hasattr(client, "initialTimeout"):
        client.initialTimeout = 0  # Our socket timeout also covers the initial handshake.
    try:
        sim = client.require("sim")
        return client, sim
    except Exception as error:
        client.socket.close(linger=0)
        client.context.term()
        raise ConnectionError(
            f"No se pudo conectar con CoppeliaSim en {host}:{port}. "
            "Comprueba que esté abierto y que la API ZeroMQ esté activa."
        ) from error


def leer_articulaciones(sim, ruta_robot, rutas=None):
    """Lee una cadena de seis articulaciones, de base a muñeca, sin moverla.

    `rutas` permite indicar las seis rutas en orden si el modelo también tiene
    articulaciones de pinza u otras ramas bajo la misma raíz.
    """
    if not isinstance(ruta_robot, str) or not ruta_robot.startswith("/"):
        raise ValueError("Escribe la ruta absoluta del robot, por ejemplo /UR5.")
    raiz = sim.getObject(ruta_robot)
    if rutas is None:
        articulaciones = list(sim.getObjectsInTree(raiz, sim.object_joint_type, 0))
        if len(articulaciones) != 6:
            raise ValueError(
                f"{ruta_robot} contiene {len(articulaciones)} articulaciones; "
                "indica las seis rutas del brazo con rutas=[...] si hay otras articulaciones."
            )

        def profundidad(articulacion):
            nivel = 0
            actual = articulacion
            while actual != raiz and actual != -1:
                actual = sim.getObjectParent(actual)
                nivel += 1
            if actual != raiz:
                raise ValueError("Una articulación no pertenece al modelo indicado.")
            return nivel

        articulaciones.sort(key=profundidad)
    else:
        if not isinstance(rutas, (list, tuple)) or len(rutas) != 6 or any(
            not isinstance(ruta, str) or not ruta.startswith("/") for ruta in rutas
        ):
            raise ValueError("rutas debe contener seis rutas absolutas de articulación.")
        articulaciones = [sim.getObject(ruta) for ruta in rutas]
        if len(set(articulaciones)) != 6:
            raise ValueError("Las seis rutas de articulación deben ser distintas.")

    def es_ancestro(ancestro, descendiente):
        actual = sim.getObjectParent(descendiente)
        while actual != -1:
            if actual == ancestro:
                return True
            actual = sim.getObjectParent(actual)
        return False

    if not es_ancestro(raiz, articulaciones[0]) or any(
        not es_ancestro(anterior, siguiente)
        for anterior, siguiente in zip(articulaciones, articulaciones[1:])
    ):
        raise ValueError("Las seis articulaciones deben formar una cadena ordenada de base a muñeca.")
    return [
        {"ruta": sim.getObjectAlias(articulacion, 2), "rad": float(sim.getJointPosition(articulacion))}
        for articulacion in articulaciones
    ]
