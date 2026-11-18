# %% 1 · Leer las articulaciones de la escena (solo lectura)
# La escena de prueba actual contiene /UR3 en el puerto 23000.
# Para la otra escena, cambia MODELO a "UR5" y ajusta el puerto si corresponde.
MODELO = "UR3"
PUERTO = 23000
RUTA_ROBOT = "/" + MODELO
client, sim = connect_coppelia(host="127.0.0.1", port=PUERTO)
lecturas = leer_articulaciones(sim, RUTA_ROBOT)
q = np.array([dato["rad"] for dato in lecturas])

for i, dato in enumerate(lecturas, start=1):
    print(f"J{i}: {dato['ruta']} = {dato['rad']:.4f} rad")


# %% 2 · Tablas DH estándar y cinemática directa
# Cada fila: (a en m, d en m, alpha en rad).
# Los seis valores theta son los ángulos q leídos en la celda anterior.
tabla_ur3 = [
    (0,        0.1519,    np.pi / 2),
    (-0.24365, 0,         0),
    (-0.21325, 0,         0),
    (0,        0.11235,   np.pi / 2),
    (0,        0.08535,  -np.pi / 2),
    (0,        0.0819,    0),
]

tabla_ur5 = [
    (0,        0.089159,  np.pi / 2),
    (-0.425,   0,         0),
    (-0.39225, 0,         0),
    (0,        0.10915,   np.pi / 2),
    (0,        0.09465,  -np.pi / 2),
    (0,        0.0823,    0),
]


def dh(theta, d, a, alpha):
    c = np.cos(theta)
    s = np.sin(theta)
    ca = np.cos(alpha)
    sa = np.sin(alpha)
    return np.array([
        [c, -s * ca,  s * sa, a * c],
        [s,  c * ca, -c * sa, a * s],
        [0,  sa,      ca,     d],
        [0,  0,       0,      1],
    ])


def cinematica_directa(q, tabla):
    if len(q) != 6 or len(tabla) != 6:
        raise ValueError("Se necesitan seis ángulos y seis filas DH.")
    T = np.eye(4)
    for i in range(6):
        a, d, alpha = tabla[i]
        T = T @ dh(q[i], d, a, alpha)
    return T


# Esta prueba matemática funciona aunque CoppeliaSim esté cerrado.
for nombre, tabla in [("UR3", tabla_ur3), ("UR5", tabla_ur5)]:
    T_cero = cinematica_directa(np.zeros(6), tabla)
    print(nombre, "con q = [0, 0, 0, 0, 0, 0]:", T_cero[:3, 3])


# %% 3 · Aplicar la tabla a los ángulos leídos
tabla = {"UR3": tabla_ur3, "UR5": tabla_ur5}[MODELO]
T_06 = cinematica_directa(q, tabla)
print("Matriz T06 calculada:")
print(T_06)
print("Posición calculada (m):", T_06[:3, 3])
