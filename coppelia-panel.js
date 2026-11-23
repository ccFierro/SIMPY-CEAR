(function () {
  "use strict";

  const panel = document.getElementById("manualPanel");
  const modeButton = document.getElementById("modeCoppelia");
  const status = document.getElementById("manualStatus");
  const stateLabel = document.getElementById("manualSimState");
  const rootInput = document.getElementById("manualRobotRoot");
  const targetInput = document.getElementById("manualTargetPath");
  const jointSelect = document.getElementById("manualJoint");
  const jointStep = document.getElementById("manualJointStep");
  const targetReadout = document.getElementById("manualTargetReadout");
  const jointReadout = document.getElementById("manualJointReadout");
  const programControls = document.getElementById("programControls");
  const programEmpty = document.getElementById("programEmpty");
  const programNotice = document.getElementById("programNotice");
  const inventoryStatus = document.getElementById("sceneInventoryStatus");
  const inventoryItems = document.getElementById("sceneInventoryItems");
  const inventoryToggle = document.getElementById("sceneInventoryToggle");
  const inventoryDialog = document.getElementById("sceneInventoryDialog");
  let equipmentNotice;
  const tcpSensorSelect = document.getElementById("tcpSensorSelect");
  const tcpLiveStatus = document.getElementById("tcpLiveStatus");
  const tcpOutputs = ["X", "Y", "Z", "Rx", "Ry", "Rz"].map(axis => document.getElementById(`tcpLive${axis}`));
  let inventoryConnected = false;
  let inventoryBusy = false;
  let equipmentBusy = false;
  let inventoryPending = null;
  let inventorySignature = "";
  let sensorSignature = "";
  let tcpBusy = false;
  let connected = false;
  let running = false;
  let working = false;
  let stopping = false;
  let targetReady = false;
  let joints = [];

  function connection() {
    return {
      host: document.getElementById("coppeliaHost").value.trim(),
      port: Number(document.getElementById("coppeliaPort").value),
      extraPath: document.getElementById("coppeliaClientPath").value.trim()
    };
  }

  function inventoryCard(title, rows) {
    const card = document.createElement("div");
    card.className = "scene-inventory-card";
    const heading = document.createElement("strong");
    heading.textContent = title;
    card.append(heading);
    for (const row of rows) {
      const line = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = row.label;
      const value = document.createElement("code");
      value.textContent = row.value;
      line.append(label, value);
      card.append(line);
    }
    return card;
  }

  function equipmentName(raw) {
    const name = String(raw || "").trim().split("/").pop();
    const match = name.match(/(?:\[(\d+)\]|[_ -](\d+))$/);
    const suffix = match?.[1] || match?.[2] || "";
    const number = suffix ? ` ${suffix}` : "";
    if (/conveyor|cinta|belt/i.test(name)) return `Cinta transportadora${number}`;
    if (/vision|color/i.test(name)) return `Sensor de color${number}`;
    if (/laser|láser/i.test(name)) return `Sensor láser${number}`;
    if (/suction|ventosa/i.test(name)) return `Ventosa${number}`;
    if (/line.?sensor|sensor.?linea|sensor.?línea/i.test(name)) return `Sensor de línea${number}`;
    if (/sensor/i.test(name)) return `Sensor${number}`;
    return name || "Equipo sin nombre";
  }

  function signalDescription(signal) {
    const raw = String(signal.label || signal.name);
    const separator = raw.indexOf(":");
    if (separator < 0) {
      if (raw === signal.name) {
        const type = signal.name.slice(0, 2);
        const equipment = { DI: "Entrada digital", DO: "Salida digital", AI: "Entrada analógica", AO: "Salida analógica" }[type];
        return { equipment: equipment || raw, action: "" };
      }
      return { equipment: equipmentName(raw), action: "" };
    }
    const equipment = equipmentName(raw.slice(0, separator));
    let action = raw.slice(separator + 1).trim().replace(/\s*\(mm\/s\)\s*$/i, "");
    if (/^en movimiento$/i.test(action)) action = "En marcha";
    if (/^detecta (objeto|pieza)$/i.test(action)) action = "Detección";
    return { equipment, action };
  }

  function signalCard(title, signals, emptyText) {
    const card = document.createElement("section");
    card.className = "scene-signal-card";
    const heading = document.createElement("h3");
    heading.textContent = `${title} · ${signals.length}`;
    card.append(heading);
    if (!signals.length) {
      const empty = document.createElement("p");
      empty.textContent = emptyText;
      card.append(empty);
    }
    for (const signal of signals) {
      const row = document.createElement("div");
      row.className = "scene-signal-row";
      row.dataset.signalName = signal.name;
      const description = signalDescription(signal);
      const details = document.createElement("div");
      details.className = "scene-signal-details";
      const address = document.createElement("code");
      address.className = "scene-signal-address";
      address.textContent = signal.name;
      const label = document.createElement("strong");
      label.textContent = description.equipment;
      details.append(address, label);
      if (description.action) {
        const action = document.createElement("span");
        action.textContent = description.action;
        details.append(action);
      }
      const state = document.createElement("strong");
      state.className = "scene-signal-value";
      const controls = document.createElement("div");
      controls.className = "scene-signal-controls";
      controls.append(state);
      if (signal.path) {
        const identify = document.createElement("button");
        identify.type = "button";
        identify.className = "scene-equipment-action";
        identify.dataset.equipmentAction = "identifyEquipment";
        identify.dataset.channel = signal.name;
        identify.textContent = "Ubicar";
        identify.title = `Seleccionar ${signal.path} en CoppeliaSim`;
        controls.append(identify);
        if (signal.kind === "conveyor" && signal.direction === "output" && signal.name.startsWith("AO_")) {
          const test = document.createElement("button");
          test.type = "button";
          test.className = "scene-equipment-action";
          test.dataset.equipmentAction = "testConveyor";
          test.dataset.channel = signal.name;
          test.textContent = "Probar";
          test.title = "Mover esta cinta 0,7 s a 60 mm/s y detenerla";
          controls.append(test);
        }
      }
      row.append(details, controls);
      card.append(row);
    }
    return card;
  }

  function clearTcp(message) {
    for (const output of tcpOutputs) output.textContent = "—";
    if (tcpLiveStatus.textContent !== message) tcpLiveStatus.textContent = message;
    tcpLiveStatus.removeAttribute("title");
  }

  function syncTcpSensors(sensors) {
    const choices = sensors.filter(sensor => sensor.type === "Proximidad");
    const signature = JSON.stringify(choices.map(sensor => [sensor.path, sensor.name]));
    if (signature === sensorSignature) return;
    const previous = tcpSensorSelect.value;
    const preferred = choices.find(sensor => sensor.path.endsWith("/suctionPad/Sensor"))
      || choices.find(sensor => /(?:tcp|tool|ventosa)/i.test(sensor.name));
    const selected = choices.some(sensor => sensor.path === previous) ? previous
      : preferred?.path || (choices.length === 1 ? choices[0].path : "");
    tcpSensorSelect.replaceChildren();
    if (!selected) tcpSensorSelect.add(new Option(choices.length ? "Selecciona sensor…" : "Sin sensor TCP", ""));
    for (const sensor of choices) {
      const root = sensor.path.split("/")[1] || "escena";
      const option = new Option(`${sensor.name} · ${root}`, sensor.path);
      option.title = sensor.path;
      tcpSensorSelect.add(option);
    }
    tcpSensorSelect.value = selected;
    tcpSensorSelect.disabled = choices.length === 0;
    sensorSignature = signature;
    clearTcp(selected ? "Leyendo…" : "Sin selección");
    if (selected) refreshTcp();
  }

  async function refreshTcp() {
    const path = tcpSensorSelect.value;
    if (tcpBusy || !PythonRuntime.available || document.hidden || !path) return;
    tcpBusy = true;
    try {
      const result = await PythonRuntime.coppelia({ ...connection(), action: "tcpPose", path });
      if (!result.ok) throw new Error(result.message || "No se pudo leer el TCP.");
      if (path !== tcpSensorSelect.value) return;
      const values = [...result.position, ...result.rotation];
      if (values.length !== 6 || values.some(value => !Number.isFinite(value))) throw new Error("Pose TCP inválida.");
      values.forEach((value, index) => {
        const next = value.toFixed(3);
        if (tcpOutputs[index].textContent !== next) tcpOutputs[index].textContent = next;
      });
      tcpLiveStatus.textContent = "En vivo";
      tcpLiveStatus.removeAttribute("title");
    } catch (error) {
      if (path === tcpSensorSelect.value) {
        clearTcp("Sin lectura");
        tcpLiveStatus.title = error.message || String(error);
      }
    } finally {
      tcpBusy = false;
    }
  }

  tcpSensorSelect.addEventListener("change", () => {
    clearTcp(tcpSensorSelect.value ? "Leyendo…" : "Sin selección");
    refreshTcp();
  });
  setInterval(refreshTcp, 1200);

  function renderInventory(result) {
    const robots = result.robots || [];
    const sensors = result.sensors || [];
    syncTcpSensors(sensors);
    const signals = result.signals || [];
    const signature = JSON.stringify([robots, sensors, signals.map(({ name, label, direction, unit, path, kind }) => ({ name, label, direction, unit, path, kind }))]);
    if (signature !== inventorySignature) {
      inventoryItems.replaceChildren();
      inventoryItems.append(signalCard("Entradas", signals.filter(signal => signal.direction === "input"), "La escena no declaró entradas."));
      inventoryItems.append(signalCard("Salidas", signals.filter(signal => signal.direction === "output"), "La escena no declaró salidas."));
      inventoryItems.append(inventoryCard("Robot", robots.length
        ? robots.map(robot => ({ label: `${robot.name} · ${robot.joints.length} ejes`, value: robot.path }))
        : [{ label: "Sin robot", value: "—" }]));
      equipmentNotice = document.createElement("p");
      equipmentNotice.className = "scene-equipment-notice";
      equipmentNotice.setAttribute("role", "status");
      equipmentNotice.textContent = "Ubicar selecciona el equipo en CoppeliaSim. Probar mueve una cinta brevemente y la detiene.";
      inventoryItems.prepend(equipmentNotice);
      inventorySignature = signature;
    }
    const byName = new Map(signals.map(signal => [signal.name, signal]));
    for (const row of inventoryItems.querySelectorAll(".scene-signal-row")) {
      const signal = byName.get(row.dataset.signalName);
      const value = signal?.value;
      const state = row.querySelector(".scene-signal-value");
      const nextText = value == null ? "Sin dato" : value === 0 ? "0 · Inactivo" : value === 1 ? "1 · Activo" : String(value);
      const analog = /^(AI|AO)_/.test(signal?.name || "");
      const displayText = analog && value != null
        ? `${Number(value).toLocaleString("es-CL", { maximumFractionDigits: 1 })}${signal.unit ? ` ${signal.unit}` : ""}` : nextText;
      if (state.textContent !== displayText) state.textContent = displayText;
      state.dataset.state = value == null ? "unknown" : analog ? "analog" : value === 0 ? "off" : value === 1 ? "on" : "other";
    }
    const robotName = robots.length === 1 ? robots[0].name : `${robots.length} robots`;
    const nextStatus = `${robotName} · ${result.paused ? "Pausada" : result.running ? "En marcha" : "Detenida"}`;
    if (inventoryStatus.textContent !== nextStatus) inventoryStatus.textContent = nextStatus;
  }

  async function readInventory(silent = false) {
    if (inventoryBusy || !PythonRuntime.available || (silent && document.hidden)) return;
    inventoryBusy = true;
    try {
      const result = await PythonRuntime.coppelia({ ...connection(), action: "inventory" });
      if (!result.ok) throw new Error(result.message || "No se pudo consultar la escena.");
      inventoryConnected = true;
      renderInventory(result);
    } catch (error) {
      inventoryConnected = false;
      inventorySignature = "";
      inventoryStatus.textContent = "Sin conexión con la escena";
      inventoryStatus.title = error.message || String(error);
      inventoryStatus.classList.add("error");
      sensorSignature = "";
      tcpSensorSelect.replaceChildren(new Option("Sin escena", ""));
      tcpSensorSelect.disabled = true;
      clearTcp("Sin escena");
      inventoryItems.replaceChildren();
      const notice = document.createElement("p");
      notice.className = "scene-inventory-loading";
      notice.textContent = error.message || "No se pudo consultar la escena.";
      inventoryItems.append(notice);
    } finally {
      inventoryBusy = false;
      if (inventoryConnected) {
        inventoryStatus.classList.remove("error");
        inventoryStatus.removeAttribute("title");
      }
    }
  }

  function requestInventory(silent = false) {
    if (inventoryPending) return inventoryPending;
    inventoryPending = readInventory(silent).finally(() => { inventoryPending = null; });
    return inventoryPending;
  }
  inventoryToggle.addEventListener("click", () => {
    inventoryDialog.showModal();
    requestInventory();
  });
  inventoryDialog.addEventListener("click", event => {
    if (event.target === inventoryDialog) inventoryDialog.close();
  });
  inventoryItems.addEventListener("click", async event => {
    const button = event.target.closest("[data-equipment-action]");
    if (!button || equipmentBusy) return;
    equipmentBusy = true;
    for (const control of inventoryItems.querySelectorAll("[data-equipment-action]")) control.disabled = true;
    if (equipmentNotice) {
      equipmentNotice.textContent = button.dataset.equipmentAction === "testConveyor" ? "Probando cinta…" : "Ubicando equipo…";
      equipmentNotice.classList.remove("error");
    }
    try {
      const result = await PythonRuntime.coppelia({ ...connection(), action: button.dataset.equipmentAction, channel: button.dataset.channel });
      if (!result.ok) throw new Error(result.message || "No se pudo identificar el equipo.");
      if (equipmentNotice) equipmentNotice.textContent = result.message;
      requestInventory(true);
    } catch (error) {
      if (equipmentNotice) {
        equipmentNotice.textContent = error.message || String(error);
        equipmentNotice.classList.add("error");
      }
    } finally {
      equipmentBusy = false;
      for (const control of inventoryItems.querySelectorAll("[data-equipment-action]")) control.disabled = false;
    }
  });
  requestInventory(true);
  setInterval(() => requestInventory(true), 5000);
  setInterval(() => { if (inventoryDialog.open) requestInventory(true); }, 1000);

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }

  function selectedJoint() {
    return joints.find(joint => joint.path === jointSelect.value);
  }

  function formatJoint(value, type) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return type === "prismatic" ? `${(value * 1000).toFixed(1)} mm` : `${(value * 180 / Math.PI).toFixed(1)}°`;
  }

  function updateJointReadout() {
    const joint = selectedJoint();
    jointReadout.textContent = joint
      ? `Actual: ${formatJoint(joint.position, joint.type)} · Objetivo: ${formatJoint(joint.target, joint.type)}`
      : "Posición: —";
    const units = joint?.type === "prismatic" ? "mm" : "°";
    const values = joint?.type === "prismatic" ? [1, 5, 10, 25, 50] : [1, 5, 10];
    if (jointStep.dataset.units !== units) {
      jointStep.replaceChildren(...values.map(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${value} ${units}`;
        return option;
      }));
      jointStep.value = "5";
      jointStep.dataset.units = units;
    }
  }

  function updateTargetReadout(target) {
    if (!target || !Array.isArray(target.pose) || target.pose.length !== 7) {
      targetReadout.textContent = targetInput.value.trim() ? "Objetivo IK: consulta la escena" : "Objetivo IK: sin configurar";
      return;
    }
    const xyz = target.pose.slice(0, 3).map(value => `${(value * 1000).toFixed(1)} mm`);
    const quaternion = target.pose.slice(3).map(value => Number(value).toFixed(3));
    targetReadout.textContent = `X ${xyz[0]} · Y ${xyz[1]} · Z ${xyz[2]} · q [${quaternion.join(", ")}]`;
  }

  function sync() {
    const selected = selectedJoint();
    const notebookBusy = !document.getElementById("pauseExecution").hidden;
    jointSelect.disabled = working || joints.length === 0;
    for (const button of panel.querySelectorAll("[data-manual-joint]")) {
      button.disabled = working || notebookBusy || !running || !selected || selected.type === "spherical";
    }
    for (const button of panel.querySelectorAll("[data-manual-axis]")) {
      button.disabled = working || notebookBusy || !running || !targetReady;
    }
    document.getElementById("manualRefresh").disabled = working;
    document.getElementById("manualStart").disabled = working || !connected || running;
    document.getElementById("manualStop").disabled = stopping || !connected || !running;
    stateLabel.textContent = connected ? (running ? "Simulación en marcha" : "Simulación detenida o pausada") : "Sin conexión";
    updateJointReadout();
  }

  function setJoints(items) {
    const previous = jointSelect.value;
    joints = Array.isArray(items) ? items : [];
    jointSelect.replaceChildren();
    if (!joints.length) {
      const option = document.createElement("option");
      option.textContent = "No hay articulaciones en esta ruta";
      option.value = "";
      jointSelect.append(option);
    } else {
      for (const joint of joints) {
        const option = document.createElement("option");
        option.value = joint.path;
        option.textContent = `${joint.path} · ${joint.type === "prismatic" ? "lineal" : joint.type === "revolute" ? "rotativa" : "esférica"}`;
        jointSelect.append(option);
      }
      jointSelect.value = joints.some(joint => joint.path === previous) ? previous : joints[0].path;
    }
    sync();
  }

  async function send(action, fields = {}) {
    const result = await PythonRuntime.coppelia({ ...connection(), action, ...fields });
    if (!result.ok) throw new Error(result.message || "CoppeliaSim rechazó la operación.");
    return result;
  }

  async function perform(label, callback) {
    if (working) return;
    working = true;
    sync();
    message(label);
    try {
      await callback();
    } catch (error) {
      message(error.message || String(error), true);
    } finally {
      working = false;
      sync();
    }
  }

  async function refresh() {
    await perform("Consultando articulaciones y objetivo de la escena…", async () => {
      connected = false;
      running = false;
      targetReady = false;
      setJoints([]);
      const result = await send("scene", { rootPath: rootInput.value.trim(), targetPath: targetInput.value.trim() });
      connected = true;
      running = result.running === true;
      targetReady = Boolean(result.target);
      setJoints(result.joints);
      updateTargetReadout(result.target);
      message(`${result.joints.length} articulación(es) encontrada(s)${result.truncated ? " · se muestran las primeras 80" : ""}. ${targetReady ? "Objetivo IK listo." : "Configura un dummy objetivo para los mandos XYZ."}`);
    });
  }

  function invalidate() {
    inventoryConnected = false;
    inventorySignature = "";
    inventoryItems.hidden = true;
    inventoryToggle.hidden = true;
    inventoryToggle.setAttribute("aria-expanded", "false");
    inventoryStatus.textContent = "Buscando escena…";
    connected = false;
    running = false;
    targetReady = false;
    setJoints([]);
    updateTargetReadout(null);
    message("La escena cambió. Pulsa «Consultar escena» para habilitar los mandos.");
    requestInventory(true);
  }

  function showPane(name) {
    const code = name === "code";
    document.body.classList.toggle("coppelia-code-only", code);
    document.body.classList.toggle("coppelia-panel-only", !code);
    document.getElementById("showCoppeliaCode").setAttribute("aria-pressed", String(code));
    document.getElementById("showCoppeliaPanel").setAttribute("aria-pressed", String(!code));
    document.getElementById("leaveCoppelia").setAttribute("aria-pressed", "false");
  }

  function enterPane(name) {
    if (!document.body.classList.contains("view-coppelia")) {
      modeButton.dataset.previousGraphMode = document.getElementById("mode3d").classList.contains("active") ? "3d" : "2d";
    }
    RoboticaWorkspace.setExpanded(false);
    document.body.classList.add("view-coppelia");
    showPane(name);
    panel.hidden = false;
    modeButton.classList.add("active");
    document.getElementById("mode2d").classList.remove("active");
    document.getElementById("mode3d").classList.remove("active");
    document.getElementById("viewTitle").textContent = "Panel del programa";
  }
  modeButton.addEventListener("click", () => enterPane("code"));
  document.getElementById("showCoppeliaCode").addEventListener("click", () => enterPane("code"));
  document.getElementById("showCoppeliaPanel").addEventListener("click", () => enterPane("panel"));
  document.getElementById("leaveCoppelia").addEventListener("click", () => {
    if (!document.body.classList.contains("view-coppelia")) return;
    document.getElementById(modeButton.dataset.previousGraphMode === "3d" ? "mode3d" : "mode2d").click();
  });
  document.getElementById("manualSettings").addEventListener("click", () => document.getElementById("pythonSettings").showModal());
  document.getElementById("manualRefresh").addEventListener("click", refresh);
  document.getElementById("manualStart").addEventListener("click", () => perform("Iniciando simulación…", async () => {
    const result = await send("start");
    message(result.message);
    running = true;
  }));
  document.getElementById("manualStop").addEventListener("click", async () => {
    if (stopping || !running) return;
    stopping = true;
    running = false;
    sync();
    message("Deteniendo simulación…");
    try {
      const result = await send("stop");
      message(result.message);
    } catch (error) { running = true; message(error.message || String(error), true); }
    finally { stopping = false; sync(); }
  });
  jointSelect.addEventListener("change", sync);
  rootInput.addEventListener("change", invalidate);
  targetInput.addEventListener("change", () => { targetReady = false; updateTargetReadout(null); message("Consulta la escena para validar el nuevo objetivo IK."); sync(); });
  for (const id of ["coppeliaHost", "coppeliaPort", "coppeliaClientPath"]) {
    document.getElementById(id).addEventListener("change", invalidate);
  }
  document.addEventListener("manual-scene-changed", invalidate);
  new MutationObserver(sync).observe(document.getElementById("pauseExecution"), { attributes: true, attributeFilter: ["hidden"] });

  for (const button of panel.querySelectorAll("[data-manual-joint]")) {
    button.addEventListener("click", () => {
      const joint = selectedJoint();
      if (!running || !joint || working) return;
      perform(`Moviendo ${joint.path}…`, async () => {
        const result = await send("jogJoint", { path: joint.path, direction: Number(button.dataset.manualJoint), step: Number(jointStep.value) });
        joints = joints.map(item => item.path === result.joint.path ? result.joint : item);
        updateJointReadout();
        message(`${result.message} ${joint.path}: ${formatJoint(result.joint.target, result.joint.type)}.`);
      });
    });
  }
  for (const button of panel.querySelectorAll("[data-manual-axis]")) {
    button.addEventListener("click", () => {
      if (!running || !targetReady || working) return;
      perform(`Moviendo objetivo en ${button.dataset.manualAxis.toUpperCase()}…`, async () => {
        const axis = button.dataset.manualAxis;
        const step = Number(document.getElementById(axis.startsWith("r") ? "manualAngularStep" : "manualLinearStep").value);
        const result = await send("jogTarget", { path: targetInput.value.trim(), axis,
          direction: Number(button.dataset.direction), step, frame: document.getElementById("manualFrame").value });
        updateTargetReadout(result.target);
        message(result.message);
      });
    });
  }

  function clearProgramControls() {
    programControls.replaceChildren();
    programEmpty.hidden = false;
    programNotice.textContent = "";
  }

  function controlError(error) {
    programNotice.textContent = error.message || String(error);
    programNotice.classList.add("error");
  }

  function sendWidget(id, value) {
    PythonRuntime.widget(id, value).then(() => {
      programNotice.textContent = "";
      programNotice.classList.remove("error");
    }, controlError);
  }

  function createProgramControl(widget) {
    if (!widget || !["slider", "button", "light"].includes(widget.type) || !widget.id || programControls.children.length >= 24) return;
    const card = document.createElement("div");
    card.className = "program-control";
    card.dataset.widgetId = widget.id;
    const title = document.createElement("span");
    title.textContent = widget.label;
    card.append(title);
    if (widget.type === "slider") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = widget.min;
      input.max = widget.max;
      input.step = widget.step;
      input.value = widget.value;
      input.setAttribute("aria-label", widget.label);
      const output = document.createElement("output");
      output.textContent = input.value;
      let timer;
      input.addEventListener("input", () => {
        output.textContent = input.value;
        clearTimeout(timer);
        timer = setTimeout(() => sendWidget(widget.id, Number(input.value)), 80);
      });
      input.addEventListener("change", () => {
        clearTimeout(timer);
        sendWidget(widget.id, Number(input.value));
      });
      card.append(input, output);
    } else if (widget.type === "button") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = widget.label;
      button.addEventListener("click", () => sendWidget(widget.id, "press"));
      card.append(button);
    } else {
      const lamp = document.createElement("div");
      lamp.className = `program-light${widget.value ? " on" : ""}`;
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      const state = document.createElement("span");
      state.textContent = widget.value ? "Encendida" : "Apagada";
      lamp.append(dot, state);
      lamp.setAttribute("role", "status");
      card.append(lamp);
    }
    programControls.append(card);
    programEmpty.hidden = true;
  }

  document.addEventListener("python-widget-reset", clearProgramControls);
  document.addEventListener("python-widget", event => {
    const { action, widget } = event.detail;
    if (action === "clear") clearProgramControls();
    else if (action === "create") createProgramControl(widget);
    else if (action === "update" && widget) {
      const card = [...programControls.children].find(item => item.dataset.widgetId === widget.id);
      const lamp = card?.querySelector(".program-light");
      if (lamp) {
        lamp.classList.toggle("on", widget.value === true);
        lamp.lastChild.textContent = widget.value ? "Encendida" : "Apagada";
      }
    }
  });
  sync();
})();
