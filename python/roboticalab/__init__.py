"""Funciones educativas disponibles en el cuaderno y en scripts Python."""
from .visual import plot, punto, vector, connect, linea, trayectoria, frame, get_drawings
from .coppelia import connect_coppelia, leer_articulaciones
from .control_panel import PanelControl
from .ur_scene import RobotUR, conectar_ur, p
from .scene_objects import EscenaCoppelia, conectar_escena

__all__ = ["plot", "punto", "vector", "connect", "linea", "trayectoria", "frame", "get_drawings", "connect_coppelia", "leer_articulaciones", "PanelControl", "RobotUR", "conectar_ur", "p", "EscenaCoppelia", "conectar_escena"]
