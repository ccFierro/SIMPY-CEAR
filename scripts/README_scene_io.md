# Controlador de entradas y salidas de la escena

Agrega [`coppelia_scene_io.lua`](coppelia_scene_io.lua) como **script de personalización no threaded**. El Lua de la ventosa sigue en su objeto. Con la simulación detenida, el controlador detecta:

- Cintas cuyo dummy publica `__state__.vel` y `__state__.pos` y acepta `__ctrl__.vel` (como `/conveyor` de la escena actual).
- Sensores de proximidad fuera de los robots declarados. `/LaserSensor` queda excluido porque el Lua de la ventosa ya publica su lectura en `DI_00`.

El controlador asigna una salida `AO_XX` de velocidad en **mm/s con signo** y una entrada de confirmación `DI_XX` a cada cinta, y una entrada `DI_XX` a cada sensor. Reserva `DO_00`, `DI_00` y `DI_01` para la ventosa y el láser. La primera cinta recibe `AO_00` y `DI_02`. `80` la mueve a 80 mm/s, `-80` invierte el sentido y `0` la detiene. La magnitud máxima configurada es 500 mm/s. El controlador convierte mm/s a m/s antes de escribir `__ctrl__.vel`.

Los canales se guardan en el propio objeto mediante `customData.CEAR_RoboLab_io`; al duplicar un equipo, el duplicado obtiene canales nuevos. Una escena anterior con `DO_01` migra al nuevo `AO_00` y conserva su `DI_02`. **Guarda la escena después de actualizar el controlador** para conservar las asignaciones al volver a abrir el archivo.

El manifiesto `customData.CEAR_RoboLab` publica nombres, rutas y señales para el panel **Señales y equipos** de la app. El cuaderno Python usa los mismos canales:

```python
robot = conectar_ur('/UR3', port=23000)
robot.start_simulation()

robot.set_analog_output('AO_00', 80)   # Avanzar a 80 mm/s
robot.wait_input('DI_02', 1)
robot.set_analog_output('AO_00', -80)  # Invertir el sentido
robot.set_analog_output('AO_00', 0)    # Detener
```

Para otra escena, ajusta `CONFIG.robots`. Si una cinta debe tener otro nombre, usa `CONFIG.conveyorOverrides` por ruta. Los sensores gestionados por otro Lua se añaden a `CONFIG.ignoredSensors` y sus señales a `CONFIG.externalSignals`. La detección de cintas requiere la interfaz `__ctrl__`/`__state__`; otros modelos de cinta necesitarán un adaptador específico.

El registro se actualiza al abrir la escena y aproximadamente cada segundo mientras está detenida. Al agregar equipos, abre **Señales y equipos** en la app; el panel consulta la escena cada cinco segundos. Esta plantilla no configura por sí sola el Lua interno de una cinta ni modifica su física.

Antes de iniciar, el controlador ajusta cada objetivo articular a la posición actual de los seis ejes del robot declarado. Así una orden articular anterior no provoca un salto al arrancar. En las propiedades de simulación de CoppeliaSim, deja activada **Reset scene to initial state**: al detener, restaura la postura inicial de la escena. Prepara y guarda la Home deseada en el archivo que distribuirás. No se fuerza una Home nueva desde Python ni se teletransportan articulaciones durante la ejecución.

La escena UR3 abierta se ha usado para probar el controlador: el inventario apareció antes de iniciar, una segunda cinta de prueba recibió `AO_01` y `DI_03`, y sus canales desaparecieron al eliminarla. La cinta real respondió a `+80`, `-80` y `0` mm/s con velocidades medidas de `+0,08`, `-0,08` y aproximadamente `0` m/s. `DI_02` indicó marcha y detención. En la prueba anterior, mover la primera articulación unos 0,05 rad, detener y volver a iniciar restauró la postura original sin salto apreciable (desviación máxima al reiniciar: 0,00023 rad). Una copia de la escena, con `CEAR_SceneIO` actualizado y la Home presente, está en [`../scenes/UR3_CEAR_IO.ttt`](../scenes/UR3_CEAR_IO.ttt); el archivo original fuera de este proyecto no se sobrescribió.
