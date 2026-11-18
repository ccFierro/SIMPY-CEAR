"""Descriptores de dibujo independientes del navegador y de CoppeliaSim."""
import numpy as np

PALETTE = ["#087f8c", "#16875d", "#b36b00", "#c13f75", "#6554c0", "#c4512d"]
_sink = None
_drawings = []
_color_index = 0


def _configure(sink=None, reset=False):
    global _sink, _color_index
    _sink = sink
    _drawings.clear()
    if reset:
        _color_index = 0


def _color(color):
    global _color_index
    if color is not None:
        return str(color)
    value = PALETTE[_color_index % len(PALETTE)]
    _color_index += 1
    return value


def _point(value):
    point = np.asarray(value, dtype=float)
    if point.ndim != 1 or not 2 <= point.size <= 4 or not np.isfinite(point).all():
        raise ValueError("Se esperaba un punto de 2 a 4 coordenadas numéricas finitas.")
    return point.tolist()


def _emit(drawing):
    if len(_drawings) >= 10000:
        raise ValueError("La celda supera el límite de 10000 elementos visuales.")
    _drawings.append(drawing)
    if _sink:
        _sink(drawing)


def get_drawings():
    """Devuelve los elementos de la última ejecución (también fuera del cuaderno)."""
    return list(_drawings)


def plot(P, etiqueta="P", color=None):
    """Dibuja un punto 2D/3D; admite un vector homogéneo como entrada."""
    _emit(dict(type="point", point=_point(P), label=str(etiqueta), color=_color(color)))


punto = plot


def vector(V, etiqueta="v", color=None):
    """Dibuja un vector desde el origen."""
    _emit(dict(type="vector", point=_point(V), label=str(etiqueta), color=_color(color)))


def connect(A, B, etiqueta="", color="#7187a2"):
    """Une dos puntos mediante un segmento."""
    _emit(dict(type="line", **{"from": _point(A)}, to=_point(B), label=str(etiqueta), color=str(color)))


linea = connect


def trayectoria(puntos, etiqueta="Trayectoria", color=None):
    """Dibuja una secuencia de dos o más puntos."""
    values = np.asarray(puntos, dtype=float)
    if values.ndim != 2 or not 2 <= len(values) <= 10000:
        raise ValueError("trayectoria() necesita entre 2 y 10000 puntos.")
    _emit(dict(type="trajectory", points=[_point(p) for p in values], label=str(etiqueta), color=_color(color)))


def frame(T, etiqueta="{1}"):
    """Dibuja los ejes de una matriz 3×3 o 4×4 (no valida rigidez)."""
    matrix = np.asarray(T, dtype=float)
    if matrix.shape not in ((3, 3), (4, 4)) or not np.isfinite(matrix).all():
        raise ValueError("frame() necesita una matriz numérica finita 3×3 o 4×4.")
    _emit(dict(type="frame", matrix=matrix.tolist(), label=str(etiqueta)))


def legacy_matmul(a, b):
    """Compatibilidad explícita con @ entre listas de actividades versión 1."""
    return np.asarray(a) @ np.asarray(b)
