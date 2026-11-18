"""DH estándar: RotZ(theta) TransZ(d) TransX(a) RotX(alpha).

Modelo didáctico planar de dos eslabones; no corresponde a un UR5.
Ángulos en radianes y longitudes en la misma unidad.
"""
import numpy as np
from roboticalab import frame, trayectoria


def dh(theta, d, a, alpha):
    ct, st = np.cos(theta), np.sin(theta)
    ca, sa = np.cos(alpha), np.sin(alpha)
    return np.array([
        [ct, -st * ca, st * sa, a * ct],
        [st, ct * ca, -ct * sa, a * st],
        [0, sa, ca, d],
        [0, 0, 0, 1],
    ])


tabla_dh = [
    (np.radians(30), 0, 2, 0),
    (np.radians(45), 0, 1.5, 0),
]
T = np.eye(4)
puntos = [T[:3, 3].copy()]
frame(T, "Base")
for i, fila in enumerate(tabla_dh, start=1):
    A = dh(*fila)
    T = T @ A
    print(f"A{i}:\n{A}\nT0{i}:\n{T}")
    frame(T, f"Sistema {i}")
    puntos.append(T[:3, 3].copy())
trayectoria(puntos, "Cadena cinemática")
print("Posición final:", T[:3, 3])
