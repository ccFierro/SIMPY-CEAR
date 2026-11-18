"""Transformación homogénea 3D con NumPy real."""
import numpy as np
from roboticalab import plot, connect, frame

P = np.array([1.0, 2.0, 3.0, 1.0])
T = np.eye(4)
T[:3, 3] = [3, 1, 2]
Pf = T @ P
plot(P, "Inicial")
plot(Pf, "Final")
connect(P, Pf, "Desplazamiento")
frame(T, "Herramienta")
print("P final:", Pf)
