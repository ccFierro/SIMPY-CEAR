(function () {
  "use strict";

  const sections = [
    { id: "python", label: "Python completo", entries: [
      ["Condiciones", "if / elif / else", "La sangría delimita los bloques de Python.", "x = 3\nif x > 0:\n    print('Positivo')\nelse:\n    print('Cero o negativo')"],
      ["Bucles", "for / while", "Recorre secuencias; Detener interrumpe la ejecución.", "for i in range(5):\n    print(i, i ** 2)"],
      ["Funciones", "def nombre(...)", "Las funciones permanecen disponibles para otras celdas.", "def doble(x):\n    return 2 * x\n\nprint(doble(3))"],
      ["Importaciones", "import módulo", "Usa la biblioteca estándar y los paquetes instalados en el entorno local.", "import math\nprint(math.sqrt(2))"],
      ["Entrada", "input(mensaje)", "Abre un diálogo para escribir una respuesta; devuelve texto.", "nombre = input('Tu nombre: ')\nprint('Hola', nombre)"],
      ["Autocompletado", "Ctrl + Espacio", "Solicita sugerencias de Python y NumPy en el editor. Flechas y Enter seleccionan una opción.", "import numpy as np"],
      ["Excepciones", "try / except", "Permite manejar errores de una actividad.", "try:\n    valor = float(input('Valor: '))\nexcept ValueError:\n    print('Introduce un número')"]
    ] },
    { id: "coppelia", label: "CoppeliaSim · cualquier escena", entries: [
      ["Panel programable", "PanelControl()", "Crea deslizadores, botones y luces desde Python. En la vista Coppelia, alterna Código y Panel desde la barra superior incluso mientras corre el programa. Las interacciones cambian variables que un bucle puede leer; no mueven el robot por sí mismas.", "panel = PanelControl()\nangulo = panel.deslizador('Ángulo J1 (°)', -90, 90, 0)\nparar = panel.boton('Detener bucle')\nluz = panel.luz('Ángulo positivo')\n\nimport time\nwhile not parar.pulsado():\n    if angulo.valor > 0:\n        luz.encender()\n    else:\n        luz.apagar()\n    time.sleep(0.05)"],
      ["Mover articulación", "sim.setJointTargetPosition(...) ", "Requiere simulación activa y control de posición. Si la articulación no sigue el objetivo, revisa si un script de la escena lo sobrescribe.", "robot = sim.getObject('/UR5')\narticulaciones = sim.getObjectsInTree(robot, sim.object_joint_type, 0)\nobjetivo = np.radians(10)\nsim.setJointTargetPosition(articulaciones[0], float(objetivo))\nprint('J1 real:', np.degrees(sim.getJointPosition(articulaciones[0])))"],
      ["Conectar", "client, sim = connect_coppelia()", "Abre CoppeliaSim con su API ZeroMQ activa. Ajusta host, puerto o carpeta del cliente en Actividad → Conexión del simulador.", "from roboticalab import connect_coppelia\nclient, sim = connect_coppelia()\nprint(sim.getSimulationState())"],
      ["Leer seis ángulos", "leer_articulaciones(sim, '/UR5')", "Lee en radianes una cadena de seis articulaciones de base a muñeca, sin mover el robot. Cambia /UR5 por la ruta de tu escena.", "lecturas = leer_articulaciones(sim, '/UR5')\nq = np.array([dato['rad'] for dato in lecturas])\nfor i, dato in enumerate(lecturas, 1):\n    print(i, dato['ruta'], dato['rad'])"],
      ["Descubrir articulaciones", "sim.getObjectsInTree(...)", "Consulta las articulaciones de la escena abierta sin moverlas.", "articulaciones = sim.getObjectsInTree(sim.handle_scene, sim.object_joint_type, 0)\nfor articulacion in articulaciones:\n    print(sim.getObjectAlias(articulacion, 1), sim.getJointPosition(articulacion))"],
      ["Control de simulación", "sim.startSimulation() / sim.stopSimulation()", "Son acciones explícitas. Detener Python no detiene la simulación; usa Detener simulación en la configuración.", "print('Estado:', sim.getSimulationState())"],
      ["Paso de simulación", "sim.setStepping(True) / sim.step()", "Sincroniza el avance del simulador con tu programa. Es distinto del depurador por líneas del cuaderno.", "sim.setStepping(True)\nsim.startSimulation()\ntry:\n    for paso in range(20):\n        sim.step()\nfinally:\n    sim.stopSimulation()\n    sim.setStepping(False)"]
    ] },
    {
      id: "fundamentals", label: "Fundamentos", entries: [
        ["Variable", "nombre = expresión", "Guarda un número, texto, lista, vector o matriz.", "x = 3\nnombre = \"Robot\""],
        ["Comentario", "# explicación", "Python ignora el contenido situado después de #.", "# Punto inicial\nP = [2, 3]"],
        ["Operaciones", "+  -  *  /  %  **", "Realiza operaciones aritméticas; ** representa una potencia.", "resultado = 2 + 3 * 4\ncuadrado = resultado ** 2"],
        ["Comparaciones", "==  !=  <  <=  >  >=", "Compara valores y produce True o False.", "dentro = 0 <= x and x <= 10"],
        ["Lógica", "and  or  not", "Combina o invierte expresiones booleanas.", "seguro = activo and not alarma"],
        ["Valores especiales", "True  False  None", "Representan verdadero, falso y ausencia de valor.", "activo = True"],
        ["Lista", "[valor_1, valor_2, ...]", "Agrupa valores; los índices comienzan en cero.", "P = [2, 3]\nx = P[0]"],
        ["Lista anidada", "[[...], [...]]", "Representa matrices o una colección de puntos.", "ruta = [[0, 0], [2, 1], [4, 0]]"]
      ]
    },
    {
      id: "numpy", label: "NumPy", entries: [
        ["Importar", "import numpy as np", "Importa NumPy real. En el cuaderno también está precargado como np.", "import numpy as np"],
        ["Arreglo", "np.array(datos)", "Crea un vector o matriz a partir de listas.", "P = np.array([2, 1, 1])"],
        ["Convertir ángulos", "np.radians / np.degrees", "Convierte grados a radianes o radianes a grados.", "theta = np.radians(45)"],
        ["Trigonometría", "np.sin / np.cos / np.tan", "Calcula seno, coseno o tangente de un ángulo en radianes.", "s = np.sin(theta)\nc = np.cos(theta)"],
        ["Raíz y π", "np.sqrt / np.pi", "Calcula una raíz cuadrada o utiliza la constante π.", "diagonal = np.sqrt(2)\nmedia_vuelta = np.pi"],
        ["Producto matricial", "A @ B", "Multiplica arreglos NumPy con dimensiones compatibles. Convierte listas con np.array.", "Pf = T @ P"]
      ]
    },
    {
      id: "visual", label: "Visualización", entries: [
        ["Explorar transformación", "Resultados → Transformación", "Ejecuta una matriz homogénea y un punto compatible. La pestaña muestra el producto por filas y una vista previa interpolada; no mueve CoppeliaSim.", "T = np.array([[1,0,2],[0,1,1],[0,0,1]])\nP = np.array([1,2,1])\nPf = T @ P"],
        ["Sistemas locales", "Transformación → Mostrar ejes locales", "Elige una matriz rígida y un punto. La comparación deja el sistema inicial en P con ejes del mundo y el final en T @ P con ejes orientados por la rotación de T; ajusta su longitud en unidades del gráfico.", "theta = np.radians(90)\nT = np.array([[np.cos(theta),-np.sin(theta),2],[np.sin(theta),np.cos(theta),1],[0,0,1]])\nP = np.array([1,1,1])\nprint(T @ P)"],
        ["Punto", "plot(P, etiqueta, color)", "Dibuja un punto 2D o 3D. punto() es un alias en español.", "P = [2, 3]\nplot(P, \"P\")"],
        ["Vector", "vector(v, etiqueta, color)", "Dibuja un vector desde el origen.", "v = [2, 1, 3]\nvector(v, \"v\")"],
        ["Conectar", "connect(A, B, etiqueta, color)", "Une dos puntos. linea() es un alias en español.", "connect(P0, P1, \"desplazamiento\")"],
        ["Trayectoria", "trayectoria(puntos, etiqueta, color)", "Dibuja una secuencia formada por dos o más puntos.", "ruta = [[0, 0], [2, 1], [4, 0]]\ntrayectoria(ruta, \"Ruta\")"],
        ["Frame 2D", "frame(T, etiqueta)", "Dibuja un sistema de referencia desde una matriz homogénea 3×3.", "T = [[1, 0, 2], [0, 1, 1], [0, 0, 1]]\nframe(T, \"{T}\")"],
        ["Frame 3D", "frame(T, etiqueta)", "Dibuja un sistema de referencia desde una matriz homogénea 4×4.", "T = [[1,0,0,2], [0,1,0,1], [0,0,1,3], [0,0,0,1]]\nframe(T, \"{T}\")"]
      ]
    },
    {
      id: "output", label: "Consola", entries: [
        ["Mostrar valores", "print(valor_1, valor_2, ...)", "Escribe textos, números, vectores o matrices en la consola inferior.", "print(\"P =\", P)"],
        ["Texto", "\"contenido\" o 'contenido'", "Los textos pueden usar comillas dobles o simples.", "mensaje = \"Movimiento completado\"\nprint(mensaje)"]
      ]
    }
  ];

  // Esta variante usa CoppeliaSim como visualización externa.
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    if (!["python", "coppelia", "fundamentals", "output"].includes(sections[index].id)) sections.splice(index, 1);
  }
  sections.find(section => section.id === "coppelia").entries = sections.find(section => section.id === "coppelia").entries
    .filter(entry => entry[0] !== "Panel programable");
  sections.find(section => section.id === "coppelia").entries.push(
    ["Conectar robot UR", "robot = conectar_ur('/UR3')", "Encuentra las seis articulaciones y el sensor TCP de la ventosa. Usa el botón superior para iniciar la simulación.", "robot = conectar_ur('/UR3', port=23000)\nprint(robot.q())"],
    ["Cinemática directa DH", "robot.forward_kinematics(q)", "Configura seis filas (a, d, alpha) con set_dh. Devuelve T06 del modelo DH; todavía no es una orden de movimiento.", "robot.set_dh(tabla_DH)\nT06 = robot.forward_kinematics(robot.q())\nprint(T06)"],
    ["Pose TCP", "p[x, y, z]", "Define una posición del TCP en World de Coppelia, en metros. Intenta conservar la orientación actual. Tras align_z, MoveJ puede girar la ventosa alrededor del eje vertical para encontrar una postura, manteniendo su dirección. Usa p[x, y, z, rx, ry, rz] si necesitas una orientación exacta, con vector de rotación en radianes.", "arriba = p[0.350, 0, 0.455]"],
    ["Alinear Z", "robot.align_z(1)", "Orienta el eje Z de la herramienta: 1 hacia abajo, -1 hacia arriba, respecto de World. Mantiene la posición del TCP cuando la postura es alcanzable.", "robot.align_z(1)  # ventosa hacia abajo"],
    ["Movimiento articular", "robot.movej(destino)", "Acepta seis ángulos articulares o una pose p[...]. Con pose, prueba varias posturas iniciales de IK internamente y mueve las articulaciones; el TCP puede seguir una curva.", "robot.movej(p[0.350, 0, 0.455])"],
    ["Movimiento lineal", "robot.movel(destino)", "Acepta una pose p[...] y resuelve IK a lo largo de una línea del TCP. p[x, y, z] conserva la orientación actual.", "robot.movel(p[0.350, 0, 0.405])"],
    ["Posición TCP", "robot.tcp_position()", "Devuelve [x, y, z] del sensor de la ventosa en coordenadas World, en metros. tcp_pose() agrega su orientación como cuaternión.", "posicion = robot.tcp_position()\nrobot.movel([posicion[0], posicion[1], posicion[2] - 0.005])"],
    ["Bajar hasta contacto", "robot.lower_until_contact(z_minima)", "Baja el TCP en pasos de 5 mm hasta tocar una pieza dinámica o alcanzar la altura mínima. Devuelve la pieza detectada o None; el bucle queda dentro de la función.", "contacto = robot.lower_until_contact(0.34)\nif contacto:\n    robot.set_output('DO_00', True)\n    robot.wait_input('DI_01', 1)"],
    ["Detectar contacto", "robot.detect_contact()", "Consulta una vez el sensor de la ventosa. Devuelve la ruta y distancia de una pieza dinámica a menos de 7 mm, o None.", "contacto = robot.detect_contact()\nif contacto:\n    print(contacto['ruta'])"],
    ["Entradas y salidas", "robot.read_input / robot.set_output", "Lee una señal de la escena por su etiqueta o cambia una salida. Estas funciones Python usan nombres como DI_01 y DO_00.", "if robot.read_input('DI_01') == 0:\n    robot.set_output('DO_00', True)\n    robot.wait_input('DI_01', 1)"]
  );

  const panel = document.getElementById("pythonReference");
  const trigger = document.getElementById("referenceTrigger");
  const closeButton = document.getElementById("referenceClose");
  const backdrop = document.getElementById("referenceBackdrop");
  const search = document.getElementById("referenceSearch");
  const list = document.getElementById("referenceList");
  const detail = document.getElementById("referenceDetail");
  const count = document.getElementById("referenceCount");
  let lastFocusedEditor = document.querySelector(".cell-editor");
  let focusBeforeOpen = null;
  let selectedKey = "python:0";

  function setOpen(open) {
    const wasOpen = document.body.classList.contains("reference-open");
    if (open === wasOpen) return;
    if (open) focusBeforeOpen = document.activeElement;
    document.body.classList.toggle("reference-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      search.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (document.body.classList.contains("reference-open") && document.activeElement !== search) search.focus({ preventScroll: true });
      });
    }
    else if (focusBeforeOpen?.isConnected) focusBeforeOpen.focus();
  }

  function insertSnippet(snippet) {
    const editor = lastFocusedEditor?.isConnected ? lastFocusedEditor : [...document.querySelectorAll(".cell-editor")].at(-1);
    if (!editor || editor.readOnly) return;
    const start = editor.selectionStart;
    const prefix = start > 0 && editor.value[start - 1] !== "\n" ? "\n" : "";
    RoboticaEditor.replace(editor, { start, end: editor.selectionEnd, text: `${prefix}${snippet}` });
    editor.focus();
    setOpen(false);
  }

  function renderDetail(item) {
    if (!item) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = "No se encontraron temas con ese término.";
      detail.replaceChildren(empty);
      return;
    }
    const [title, syntax, explanation, snippet] = item.entry;
    const category = document.createElement("span");
    category.className = "reference-detail-category";
    category.textContent = item.section.label;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const signature = document.createElement("code");
    signature.className = "reference-signature";
    signature.textContent = syntax;
    const description = document.createElement("p");
    description.textContent = explanation;
    const exampleLabel = document.createElement("span");
    exampleLabel.className = "reference-example-label";
    exampleLabel.textContent = "EJEMPLO";
    const example = document.createElement("pre");
    example.textContent = snippet;
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "reference-insert";
    insert.textContent = "Insertar en la celda";
    insert.addEventListener("click", () => insertSnippet(snippet));
    detail.replaceChildren(category, heading, signature, description, exampleLabel, example, insert);
    detail.scrollTop = 0;
  }

  function renderEntries() {
    const query = search.value.trim().toLocaleLowerCase("es");
    const groups = sections.map(section => ({
      section,
      items: section.entries.map((entry, index) => ({ section, entry, key: `${section.id}:${index}` }))
        .filter(item => !query || `${section.label} ${item.entry.join(" ")}`.toLocaleLowerCase("es").includes(query))
    })).filter(group => group.items.length);
    const items = groups.flatMap(group => group.items);
    if (!items.some(item => item.key === selectedKey)) selectedKey = items[0]?.key || "";
    const navigation = groups.map(group => {
      const section = document.createElement("section");
      section.className = "reference-nav-group";
      const heading = document.createElement("h3");
      heading.textContent = group.section.label;
      section.append(heading);
      group.items.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reference-nav-item";
        button.classList.toggle("selected", item.key === selectedKey);
        button.setAttribute("aria-current", String(item.key === selectedKey));
        button.textContent = item.entry[0];
        button.addEventListener("click", () => {
          selectedKey = item.key;
          list.querySelectorAll(".reference-nav-item").forEach(other => {
            const active = other === button;
            other.classList.toggle("selected", active);
            other.setAttribute("aria-current", String(active));
          });
          renderDetail(item);
        });
        section.append(button);
      });
      return section;
    });
    if (!navigation.length) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = "Sin resultados";
      navigation.push(empty);
    }
    list.replaceChildren(...navigation);
    const selected = list.querySelector(".reference-nav-item.selected");
    if (selected) {
      const container = list.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      if (item.top < container.top || item.bottom > container.bottom) {
        list.scrollTop += item.top - container.top - (container.height - item.height) / 2;
      }
    }
    renderDetail(items.find(item => item.key === selectedKey));
    count.textContent = `${items.length} tema${items.length === 1 ? "" : "s"} disponible${items.length === 1 ? "" : "s"} · Desplázate por la lista o por el ejemplo.`;
  }

  trigger.addEventListener("click", () => setOpen(!document.body.classList.contains("reference-open")));
  closeButton.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  search.addEventListener("input", renderEntries);
  document.addEventListener("focusin", event => {
    if (event.target.classList?.contains("cell-editor")) lastFocusedEditor = event.target;
  });
  document.addEventListener("keydown", event => {
    if (!document.body.classList.contains("reference-open")) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length && !element.disabled);
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  renderEntries();
  if (location.hash === "#guide") setOpen(true);
})();
