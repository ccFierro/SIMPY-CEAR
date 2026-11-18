"""Objetos sencillos de una escena CoppeliaSim para actividades Python."""

import math
import re
from itertools import product

from .coppelia import connect_coppelia


def _xyz(values, label):
    try:
        result = [float(value) for value in values]
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} necesita tres números en metros.") from error
    if len(result) != 3 or not all(math.isfinite(value) for value in result):
        raise ValueError(f"{label} necesita tres números finitos en metros.")
    return result


def _rotate(vector, quaternion):
    """Rota un vector por un cuaternión [x, y, z, w]."""
    x, y, z, w = quaternion
    vx, vy, vz = vector
    tx = 2 * (y * vz - z * vy)
    ty = 2 * (z * vx - x * vz)
    tz = 2 * (x * vy - y * vx)
    return [vx + w * tx + y * tz - z * ty,
            vy + w * ty + z * tx - x * tz,
            vz + w * tz + x * ty - y * tx]


class EscenaCoppelia:
    """Crea, duplica y elimina formas sin modificar el objeto de plantilla."""

    def __init__(self, client, sim):
        self.client = client
        self.sim = sim
        self._creados = set()

    def _nombre(self, nombre):
        if not isinstance(nombre, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", nombre):
            raise ValueError("El nombre debe usar letras, números o _, y comenzar con letra o _.")
        if self.sim.getObject("/" + nombre, {"noError": True}) != -1:
            raise ValueError(f"Ya existe /{nombre} en la escena.")

    def _fisica(self, handle, dinamico, densidad, respondable):
        if dinamico not in (0, 1) or respondable not in (0, 1):
            raise ValueError("dinamico y respondable deben ser 1 o 0.")
        if dinamico:
            densidad = float(densidad)
            if not math.isfinite(densidad) or densidad <= 0:
                raise ValueError("La densidad debe ser positiva en kg/m³.")
            if self.sim.computeMassAndInertia(handle, densidad) != 1:
                raise ValueError("No se pudo calcular la masa de la forma copiada.")
        self.sim.setObjectInt32Param(handle, self.sim.shapeintparam_static, 0 if dinamico else 1)
        self.sim.setObjectInt32Param(handle, self.sim.shapeintparam_respondable, int(respondable))
        if dinamico and self.sim.getSimulationState() != self.sim.simulation_stopped:
            self.sim.resetDynamicObject(handle)

    def _limites_z(self, handle):
        """Altura inferior y superior de la caja envolvente en World."""
        size, box_pose = self.sim.getShapeBB(handle)
        object_pose = self.sim.getObjectPose(handle, self.sim.handle_world)
        heights = []
        for signs in product((-0.5, 0.5), repeat=3):
            corner = _rotate([sign * dimension for sign, dimension in zip(signs, size)],
                             box_pose[3:])
            local = [offset + value for offset, value in zip(box_pose[:3], corner)]
            heights.append(object_pose[2] + _rotate(local, object_pose[3:])[2])
        return min(heights), max(heights)

    def _superficie(self, ruta):
        if not isinstance(ruta, str) or not ruta.startswith("/"):
            raise ValueError("sobre necesita la ruta absoluta de una superficie, por ejemplo /Mesa.")
        handle = self.sim.getObject(ruta)
        if self.sim.getObjectType(handle) != self.sim.object_shape_type:
            raise ValueError("La superficie debe ser una forma individual de CoppeliaSim.")
        size, box_pose = self.sim.getShapeBB(handle)
        object_pose = self.sim.getObjectPose(handle, self.sim.handle_world)
        normal = _rotate(_rotate([0, 0, 1], box_pose[3:]), object_pose[3:])
        if abs(normal[2]) < 0.98:
            raise ValueError("sobre requiere una superficie aproximadamente horizontal.")
        return self._limites_z(handle)[1]

    def _colocar(self, handle, posicion, sobre):
        if sobre is None:
            target = _xyz(posicion, "La posición")
        else:
            try:
                xy = [float(value) for value in posicion]
            except (TypeError, ValueError) as error:
                raise ValueError("Con sobre, escribe solo X e Y en metros.") from error
            if len(xy) != 2 or not all(math.isfinite(value) for value in xy):
                raise ValueError("Con sobre, escribe solo X e Y finitos en metros.")
            bottom = self._limites_z(handle)[0]
            current_z = self.sim.getObjectPosition(handle, self.sim.handle_world)[2]
            target = [*xy, self._superficie(sobre) + current_z - bottom + 0.001]
        self.sim.setObjectPosition(handle, target, self.sim.handle_world)

    def create_cube(self, nombre, posicion, lado=0.05, dinamico=True, densidad=500,
                    sobre=None, respondable=1):
        """Cubo en World; con sobre, posicion contiene solo X e Y."""
        self._nombre(nombre)
        lado = float(lado)
        if not math.isfinite(lado) or lado <= 0:
            raise ValueError("El lado del cubo debe ser positivo en metros.")
        handle = self.sim.createPrimitiveShape(self.sim.primitiveshape_cuboid, [lado] * 3, 0)
        try:
            self.sim.setObjectAlias(handle, nombre)
            self._colocar(handle, posicion, sobre)
            self._fisica(handle, dinamico, densidad, respondable)
        except Exception:
            self.sim.removeObjects([handle])
            raise
        self._creados.add(handle)
        return handle

    def copy_object(self, ruta, nombre, posicion, dinamico=True, densidad=500,
                    sobre=None, respondable=1):
        """Copia una forma a World; con sobre, posicion contiene solo X e Y."""
        self._nombre(nombre)
        if not isinstance(ruta, str) or not ruta.startswith("/"):
            raise ValueError("Escribe la ruta absoluta de la plantilla, por ejemplo /CuboPlantilla.")
        original = self.sim.getObject(ruta)
        if self.sim.getObjectType(original) != self.sim.object_shape_type:
            raise ValueError("La plantilla debe ser una forma individual, no un modelo completo.")
        # Quitar scripts, datos personalizados y referencias del duplicado.
        copias = self.sim.copyPasteObjects([original], 2 | 4 | 8)
        if len(copias) != 1 or copias[0] == -1:
            raise RuntimeError("CoppeliaSim no pudo duplicar la forma.")
        handle = copias[0]
        try:
            self.sim.setObjectParent(handle, -1, True)
            self.sim.setObjectAlias(handle, nombre)
            self._colocar(handle, posicion, sobre)
            self._fisica(handle, dinamico, densidad, respondable)
        except Exception:
            self.sim.removeObjects([handle])
            raise
        self._creados.add(handle)
        return handle

    def delete_object(self, objeto):
        """Elimina un objeto creado por esta instancia; acepta su handle o ruta."""
        handle = self.sim.getObject(objeto) if isinstance(objeto, str) else objeto
        if handle not in self._creados:
            raise ValueError("Solo se pueden eliminar objetos creados con esta instancia de escena.")
        self.sim.removeObjects([handle])
        self._creados.remove(handle)


def conectar_escena(port=23000, host="127.0.0.1", timeout=15):
    """Conecta con la escena sin exigir un robot concreto."""
    client, sim = connect_coppelia(host=host, port=port, timeout=timeout)
    return EscenaCoppelia(client, sim)
