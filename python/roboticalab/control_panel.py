"""Controles del cuaderno creados desde Python y mostrados en la vista Coppelia."""
import math
import threading
import uuid


_lock = threading.RLock()
_widgets = {}
_sink = None


def _configure(sink):
    global _sink
    _sink = sink


def _emit(action, widget=None):
    if _sink:
        _sink(action, widget)


def _label(value):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 60:
        raise ValueError("El control necesita un nombre de 1 a 60 caracteres.")
    return value.strip()


def _number(value, name):
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} debe ser un número finito.") from error
    if not math.isfinite(number):
        raise ValueError(f"{name} debe ser un número finito.")
    return number


def _input(widget_id, value):
    """Recibe una interacción validada por la clase, sin ejecutar código del navegador."""
    with _lock:
        widget = _widgets.get(widget_id)
        if widget is None or widget["type"] == "light":
            return False
        if widget["type"] == "button":
            if value != "press":
                return False
            widget["presses"] = min(widget["presses"] + 1, 100)
            return True
        try:
            number = _number(value, "Valor")
        except ValueError:
            return False
        if not widget["min"] <= number <= widget["max"]:
            return False
        widget["value"] = number
        return True


class Deslizador:
    def __init__(self, widget_id):
        self.id = widget_id

    @property
    def valor(self):
        with _lock:
            return _widgets[self.id]["value"]


class Boton:
    def __init__(self, widget_id):
        self.id = widget_id

    def pulsado(self):
        """True una vez por pulsación, incluso si ocurrió entre iteraciones."""
        with _lock:
            widget = _widgets[self.id]
            if widget["presses"] == 0:
                return False
            widget["presses"] -= 1
            return True


class Luz:
    def __init__(self, widget_id):
        self.id = widget_id

    @property
    def encendida(self):
        with _lock:
            return _widgets[self.id]["value"]

    def encender(self):
        self._set(True)

    def apagar(self):
        self._set(False)

    def _set(self, value):
        with _lock:
            if _widgets[self.id]["value"] == value:
                return
            _widgets[self.id]["value"] = value
        _emit("update", {"id": self.id, "value": value})


class PanelControl:
    """Crea un panel nuevo; sus objetos pueden leerse desde las celdas siguientes."""
    def __init__(self):
        with _lock:
            _widgets.clear()
        _emit("clear")

    @staticmethod
    def _register(kind, name, **fields):
        with _lock:
            if len(_widgets) >= 24:
                raise ValueError("El panel admite hasta 24 controles.")
            widget = {"id": uuid.uuid4().hex, "type": kind, "label": _label(name), **fields}
            _widgets[widget["id"]] = widget
        _emit("create", widget.copy())
        return widget["id"]

    def deslizador(self, nombre, minimo, maximo, inicial=0, paso=1):
        minimum = _number(minimo, "Mínimo")
        maximum = _number(maximo, "Máximo")
        value = _number(inicial, "Valor inicial")
        step = _number(paso, "Paso")
        if minimum >= maximum or not minimum <= value <= maximum or step <= 0:
            raise ValueError("El deslizador requiere mínimo < máximo, valor inicial dentro del rango y paso positivo.")
        return Deslizador(self._register("slider", nombre, min=minimum, max=maximum, value=value, step=step))

    def boton(self, nombre):
        return Boton(self._register("button", nombre, presses=0))

    def luz(self, nombre, encendida=False):
        if type(encendida) is not bool:
            raise ValueError("El estado inicial de la luz debe ser True o False.")
        return Luz(self._register("light", nombre, value=encendida))
