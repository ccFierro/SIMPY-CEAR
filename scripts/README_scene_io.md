# Controlador de entradas y salidas de la escena

Agrega [`coppelia_scene_io.lua`](coppelia_scene_io.lua) como **script de personalización no threaded**. El Lua de la ventosa sigue en su objeto; la versión sin lectura láser duplicada está en [`coppelia_suction_pad.lua`](coppelia_suction_pad.lua). Con la simulación detenida, el controlador detecta:

- Cintas cuyo dummy publica `__state__.vel` y `__state__.pos` y acepta `__ctrl__.vel` (como `/conveyor` de la escena actual).
- Sensores de proximidad fuera de los robots declarados. Cada láser de la escena se publica una sola vez.
- Vision sensors fuera de los robots declarados. Cada uno publica tres entradas analógicas `AI_XX` con los promedios rojo, verde y azul de la zona central de su imagen, en escala 0–255. La imagen no se muestra en la app.

El controlador asigna una salida `AO_XX` de velocidad en **mm/s con signo** a cada cinta y una entrada `DI_XX` a cada sensor láser. No crea una entrada de confirmación de marcha para las cintas. Reserva `DO_00` y `DI_01` para la ventosa; `DI_00` queda disponible para un sensor real. La primera cinta recibe `AO_00`. `80` la mueve a 80 mm/s, `-80` invierte el sentido y `0` la detiene. La magnitud máxima configurada es 500 mm/s. El controlador convierte mm/s a m/s antes de escribir `__ctrl__.vel`.

Los canales se guardan en el propio objeto mediante `customData.CEAR_RoboLab_io`; al duplicar un equipo, el duplicado obtiene canales nuevos. Una escena anterior con `DO_01` migra al nuevo `AO_00`; las antiguas entradas de marcha `DI_XX` de las cintas se eliminan. Los sensores láser existentes conservan sus direcciones. **Guarda la escena después de actualizar el controlador** para conservar las asignaciones al volver a abrir el archivo.

El manifiesto `customData.CEAR_RoboLab` publica nombres, rutas y señales para el panel **Señales y equipos** de la app. El cuaderno Python usa los mismos canales:

```python
robot = conectar_ur('/UR3', port=23000)
robot.start_simulation()

robot.set_analog_output('AO_00', 80)   # Avanzar a 80 mm/s
robot.set_analog_output('AO_00', -80)  # Invertir el sentido
robot.set_analog_output('AO_00', 0)    # Detener

rojo = robot.read_analog_input('AI_00')
verde = robot.read_analog_input('AI_01')
azul = robot.read_analog_input('AI_02')
```

Para otra escena, ajusta `CONFIG.robots`. Si una cinta debe tener otro nombre, usa `CONFIG.conveyorOverrides` por ruta. Los sensores gestionados por otro Lua se añaden a `CONFIG.ignoredSensors` y sus señales a `CONFIG.externalSignals`. La detección de cintas requiere la interfaz `__ctrl__`/`__state__`; otros modelos de cinta necesitarán un adaptador específico.

El registro se actualiza al abrir la escena y aproximadamente cada segundo mientras está detenida. Al agregar equipos, abre **Señales y equipos** en la app; el panel consulta la escena cada cinco segundos. Esta plantilla no configura por sí sola el Lua interno de una cinta ni modifica su física.

Antes de iniciar, el controlador ajusta cada objetivo articular a la posición actual de los seis ejes del robot declarado. Así una orden articular anterior no provoca un salto al arrancar. En las propiedades de simulación de CoppeliaSim, deja activada **Reset scene to initial state**: al detener, restaura la postura inicial de la escena. Prepara y guarda la Home deseada en el archivo que distribuirás. No se fuerza una Home nueva desde Python ni se teletransportan articulaciones durante la ejecución.

La escena UR3 abierta se ha usado para probar el controlador: tres cintas conservan `AO_00`, `AO_01` y `AO_02`; los tres láseres conservan `DI_04`, `DI_05` y `DI_07`. Tras reiniciar `CEAR_SceneIO`, las antiguas entradas de marcha `DI_02`, `DI_03` y `DI_06` dejaron de publicarse. El Lua de ventosa ya no crea la lectura duplicada `DI_00`; una prueba breve Start/Stop confirmó `DI_01` y las tres entradas láser. La cinta real respondió anteriormente a `+80`, `-80` y `0` mm/s con velocidades medidas de `+0,08`, `-0,08` y aproximadamente `0` m/s. En la prueba anterior, mover la primera articulación unos 0,05 rad, detener y volver a iniciar restauró la postura original sin salto apreciable (desviación máxima al reiniciar: 0,00023 rad). La escena actualizada con tres cintas y tres láseres se guardó en [`../scenes/UR3_CEAR_IO_sensores_cintas.ttt`](../scenes/UR3_CEAR_IO_sensores_cintas.ttt).

El Vision sensor `/visionSensor` se orientó hacia abajo. Con un cubo rojo debajo, su promedio central de 4×4 píxeles en una captura de 8×8 dio `AI_00=186`, `AI_01=58`, `AI_02=58`. La escena con esta configuración se guardó en [`../scenes/UR3_CEAR_IO_color.ttt`](../scenes/UR3_CEAR_IO_color.ttt).

Si la escena tiene `simUI`, el controlador abre una pantalla RGB en CoppeliaSim para `/visionSensor` (o el primer sensor de color disponible). Muestra cada canal de `0` a `255`, su señal `AI_XX` y el canal dominante. La lectura se actualiza durante la simulación y depende también de la iluminación; cerrar la pantalla la oculta hasta volver a cargar la escena.

## Reposición de cubos de la escena docente

El mismo controlador observa `/SensorSalida` y repone en `/PuntoEntrada` automáticamente las figuras cuyo nombre sea `icubo[n]` (`icubo[0]`, `icubo[1]`, etc.). El sensor de salida es interno y no aparece en **Señales y equipos**. El dummy debe estar en el **centro deseado del cubo**, con la altura correcta sobre la cinta. El cubo conserva su orientación inicial.

Cuando un cubo llega al sensor, el controlador espera a que no haya otro cubo a menos de `entryClearance` metros del punto de entrada. La ventosa puede sostener otra pieza mientras el sistema repone cubos. Procesa un cubo por paso de simulación. Los nuevos cubos con nombre `icubo[n]` se incluyen al iniciar la simulación; otros objetos detectados por el sensor no se reponen.

La escena [`../scenes/UR3_CEAR_IO_color.ttt`](../scenes/UR3_CEAR_IO_color.ttt) incorpora esta lógica. La reposición aún requiere la prueba funcional del docente en su rutina.

## Movimiento del robot dentro de CoppeliaSim

Añade [`coppelia_motion_controller.lua`](coppelia_motion_controller.lua) como un segundo **script de personalización no threaded** de la escena. `CEAR_SceneIO` sigue encargado de las señales, cintas y sensores. El nuevo controlador recibe `movej` y `movel` desde el cuaderno, construye la IK con `simIK` usando las seis articulaciones y el sensor TCP indicados por Python, comprueba toda la trayectoria antes de mover y envía objetivos articulares en cada paso de simulación. Para `movej` con seis ángulos no se necesita IK; para `movej(p[...])` y `movel(p[...])` se calcula dentro de la escena.

La sintaxis de los estudiantes no cambia. Si la escena no incluye el controlador, Python conserva el movimiento anterior. El controlador detiene el brazo cuando la aplicación deja de renovar su comunicación durante 2 segundos. Al detener la simulación se descartan las órdenes pendientes; al iniciar no se repite un movimiento anterior. Cada escena que se entregue a los estudiantes debe guardar este segundo script para usar el movimiento nuevo.

La velocidad opcional usa la notación `v=`. En `robot.movej(destino, v=0.5)`, `v` limita la velocidad articular a 0,5 rad/s (rango 0,05–1,2 rad/s). En `robot.movel(destino, v=0.05)`, limita la velocidad del TCP a 0,05 m/s (rango 0,01–0,2 m/s). Si no se indica `v`, se conserva la velocidad previa de los ejemplos. El controlador comprueba los límites y puede avanzar más lento si la simulación o las articulaciones no siguen el objetivo. Una escena con controlador anterior rechaza `v=` y pide actualizarla, para no ignorar silenciosamente la velocidad.

El botón **Mover robot** permite desplazar el TCP de manera continua mientras se mantiene presionado el mando. La referencia inicial es **TCP**; también se puede elegir World. Al soltar el mando, cerrar la ventana o perder la comunicación, el controlador detiene el movimiento. **Alinear Z ↓** orienta la herramienta hacia abajo. El mando requiere la escena actualizada con este controlador; el instalador no modifica automáticamente las escenas externas.

Al abrir **Mover robot**, la app dibuja ejes X/Y/Z de 25 mm sobre el sensor TCP seleccionado. Siguen al brazo y se retiran al cerrar la ventana; no se crea un dummy permanente. **Alinear X** orienta el X local del TCP hacia +X World y **Alinear Y** orienta el Y local hacia +Y World mediante la rotación mínima de la orientación actual. **Alinear Z** orienta Z local hacia abajo. Cada alineación conserva la posición del TCP y puede fallar si no existe una trayectoria de IK válida.

Las coordenadas del mando muestran la pose World actual y pueden editarse como destino. Los valores pendientes se resaltan en amarillo sin perderse durante la lectura periódica del TCP. **Mover robot al destino** envía los seis valores a `movej` y muestra un error si la escena no puede resolver la IK. **Agregar punto a celda** añade `target_N = p[x, y, z, rx, ry, rz]` al final de la celda seleccionada. El mismo botón de **Marco 3D** usa la numeración consecutiva del cuaderno. El marcador pequeño aparece al escribir el punto si el interruptor **Puntos** está activo.
La vista previa de puntos actualiza los marcadores directamente al escribir `nombre = p[...]`; no requiere ejecutar Python. Acepta tres o seis coordenadas numéricas, variables escalares asignadas antes y expresiones aritméticas simples como `-np.pi` o `np.radians(90)`. Las llamadas y funciones arbitrarias no se ejecutan para calcular la vista previa. El interruptor **Puntos** junto a Reiniciar Python elimina los marcadores del cuaderno al ocultarlos y los reconstruye al mostrarlos. Un cambio de nombre o pose retira el marcador anterior y conserva solo las asignaciones actuales.

La escena de prueba con el controlador está guardada en [`../scenes/UR3_active_with_motion_controller.ttt`](../scenes/UR3_active_with_motion_controller.ttt). En el UR3 local se comprobaron `movej` con un cambio de 0,03 rad en J1, `movel` con un ascenso de 5 mm y `movej(p[...])` con un ascenso de 5 mm; las dos poses terminaron a menos de 0,4 mm de la altura solicitada. También se comprobó `movej` con `v=0.2` y `movel` con `v=0.05` en desplazamientos breves. Las escenas `.ttt` se distribuyen por separado de la aplicación.
