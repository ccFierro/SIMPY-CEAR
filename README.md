# SIMPY - CEAR

Cuaderno Python de código abierto para programar escenas de CoppeliaSim Edu. La aplicación ocupa inicialmente el 35 % de la pantalla para dejar visible el simulador al costado. Incluye celdas Python, actividades `.roboticalab`, panel de señales, lectura del TCP y un marcador de poses 3D.

## Instalar

Descarga el instalador Windows x64 desde [Releases](https://github.com/ccFierro/SIMPY-CEAR/releases). CoppeliaSim Edu 4.10 y las escenas de práctica se instalan por separado. La app consulta las nuevas versiones al abrirse; cuando hay una disponible, la descarga, instala en silencio y vuelve a iniciarse.

La carpeta de trabajos permanece en `%LOCALAPPDATA%\CEAR RoboLab Coppelia` para conservar las actividades creadas con la versión anterior del programa.

## Uso básico

Abre una escena en CoppeliaSim con la API ZeroMQ activa, normalmente en el puerto `23000`. En el cuaderno:

```python
robot = conectar_ur("/UR3", port=23000)
robot.align_z(1)
robot.movej(p[0.35, 0, 0.45])
```

`p[x, y, z]` expresa una posición World en metros y conserva la orientación actual del TCP. `p[x, y, z, rx, ry, rz]` añade un vector de rotación en radianes. Para mover el robot a una pose, `movej` y `movel` utilizan la cinemática inversa `simIK` de CoppeliaSim. Las funciones DH del cuaderno permiten estudiar la cinemática directa; no alimentan todavía la IK del movimiento.

Para preparar objetos de práctica:

```python
escena = conectar_escena(port=23000)
escena.create_cube("Cubo_1", [0.35, 0, 0.40], lado=0.05)
escena.copy_object("/CuboPlantilla", "CuboFijo", [0, 0.35, 0.40],
                   dinamico=0, respondable=0)
```

`dinamico` y `respondable` aceptan `1` o `0`. Los objetos son dinámicos y respondables por defecto. La app no modifica el objeto usado como plantilla. El [mapa de comandos](material_docente/08_mapa_comandos_coppelia.html) reúne más ejemplos.

## Escenas y señales

El script [coppelia_scene_io.lua](scripts/coppelia_scene_io.lua) puede añadirse como script de personalización a una escena. Detecta cintas transportadoras y sensores compatibles, asigna señales y publica un inventario que aparece en **Señales y equipos**. La ventosa de la escena docente utiliza `DO_00`, `DI_00` y `DI_01`. La integración se describe en [README_scene_io.md](scripts/README_scene_io.md).

Las escenas `.ttt` y los modelos de CoppeliaSim no se distribuyen en este repositorio. La licencia MIT cubre el código de SIMPY - CEAR; CoppeliaSim y sus modelos mantienen sus propias licencias.

## Desarrollo local

Se requiere Windows, Node.js 22–24 y Python 3.14 x64 con las dependencias de [requirements.lock](requirements.lock). Ejecuta `npm ci`, prepara un entorno Python y abre [Iniciar_Cuaderno_Coppelia.bat](Iniciar_Cuaderno_Coppelia.bat). El servicio local usa `http://127.0.0.1:8766` y el navegador se abre como ventana lateral. Ejecuta `npm run check` y `npm test` para las comprobaciones del proyecto.

Para generar el instalador, prepara las ruedas Python en `.build/wheels` y ejecuta `npm run installer:win`. Los artefactos aparecen en `dist/installer`: `SIMPY-CEAR-Setup-<versión>-x64.exe`, su `.blockmap` y `latest.yml`. El instalador Electron usa la misma identidad interna que la versión previa para conservar los datos; la barra de título integrada se aplica solo a la ventana instalada.

## Publicar una versión

Publica el código fuente en `ccFierro/SIMPY-CEAR`, incrementa la versión de `package.json`, genera el instalador y publica los tres artefactos de la misma versión en una Release no preliminar. `npm run release:draft` crea un borrador usando `SIMPY_CEAR_RELEASE_TOKEN` con permiso `Contents: write`; `node scripts/publish-installer.js --publish` carga los artefactos y publica la Release. Comprueba el instalador antes de publicarlo.

## Licencia

Código propio bajo [MIT](LICENSE). Autor: CEAR Inacap.
