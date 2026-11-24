(function () {
  "use strict";

  const dialog = document.getElementById("robotJogDialog");
  const status = document.getElementById("robotJogStatus");
  const frame = document.getElementById("robotJogFrame");
  const fields = ["X", "Y", "Z", "Rx", "Ry", "Rz"].map(name => document.getElementById(`robotJog${name}`));
  const controller = document.querySelector("#poseMarkerDialog .pose-controller").cloneNode(true);
  controller.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
  controller.setAttribute("aria-label", "Mando cartesiano continuo del TCP");
  controller.querySelectorAll("[aria-label]").forEach(element => {
    element.setAttribute("aria-label", element.getAttribute("aria-label").replaceAll("marcador", "TCP"));
  });
  document.getElementById("robotJogController").append(controller);

  let activeId = "";
  let pressedControl = null;
  let starting = false;
  let busy = false;
  let heartbeatBusy = false;
  let readBusy = false;
  let heartbeatTimer = null;
  let startedAt = 0;
  let axesOwner = "";
  let axesQueue = Promise.resolve();
  let measuredPose = null;
  let userEditing = false;

  function sensorPath() { return document.getElementById("tcpSensorSelect").value; }

  function settings() {
    return {
      host: document.getElementById("coppeliaHost").value.trim(),
      port: Number(document.getElementById("coppeliaPort").value),
      extraPath: document.getElementById("coppeliaClientPath").value.trim()
    };
  }

  async function request(action, values = {}) {
    const result = await PythonRuntime.coppelia({ ...settings(), action, ...values });
    if (!result.ok) throw new Error(result.message || "CoppeliaSim no respondió.");
    return result;
  }

  function showPose(result) {
    if (!Array.isArray(result.position) || !Array.isArray(result.rotation)) return;
    measuredPose = [...result.position, ...result.rotation].map(Number);
    if (!userEditing) measuredPose.forEach((value, index) => { fields[index].value = value.toFixed(4); });
    refreshPending();
  }

  function refreshPending() {
    if (!measuredPose) return;
    let pendingAny = false;
    fields.forEach((field, index) => {
      const value = Number(field.value);
      const pending = field.value.trim() === "" || !Number.isFinite(value) ||
        Math.abs(value - measuredPose[index]) > (index < 3 ? 0.0005 : 0.002);
      field.parentElement.classList.toggle("is-pending", pending);
      pendingAny ||= pending;
    });
    userEditing = pendingAny;
  }

  function destination() {
    const values = fields.map(field => Number(field.value));
    if (fields.some(field => field.value.trim() === "") || values.some(value => !Number.isFinite(value))) {
      throw new Error("Completa X, Y, Z y rx, ry, rz con números finitos.");
    }
    return values;
  }

  function reportError(error) {
    status.textContent = "No se completó la acción.";
    RoboLabNotifications.show(error.message || String(error), { within: dialog, type: "error" });
  }

  function updateAxes(action, owner, path = "") {
    axesQueue = axesQueue.catch(() => {}).then(() => request(action, { owner, sensorPath: path }));
    axesQueue.catch(error => { if (dialog.open) reportError(error); });
  }

  async function readPose() {
    if (!dialog.open || activeId || starting || busy || readBusy || !sensorPath()) return;
    readBusy = true;
    try {
      showPose(await request("robotJogRead", { sensorPath: sensorPath() }));
    } catch (error) {
      status.textContent = error.message || "Sin lectura del TCP.";
    } finally {
      readBusy = false;
    }
  }

  async function pulse() {
    if (!activeId || heartbeatBusy) return;
    heartbeatBusy = true;
    const id = activeId;
    try {
      const result = await request("robotJogHeartbeat", { id, sensorPath: sensorPath() });
      if (activeId !== id) return;
      showPose(result);
      if (result.state === "pending" && performance.now() - startedAt > 3000) {
        stop();
        reportError(new Error("El controlador de la escena no inició el movimiento."));
        return;
      }
      if (result.state === "done") stop();
    } catch (error) {
      if (activeId === id) {
        stop();
        reportError(error);
      }
    } finally {
      heartbeatBusy = false;
    }
  }

  function stop() {
    if (pressedControl) pressedControl.classList.remove("is-selected");
    pressedControl = null;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (!activeId) return;
    const id = activeId;
    activeId = "";
    status.textContent = "TCP detenido.";
    request("robotJogStop", { id }).catch(reportError);
    readPose();
  }

  async function start(control) {
    if (starting || activeId || busy || !dialog.open) return;
    const path = sensorPath();
    if (!path) { reportError(new Error("Selecciona un sensor TCP en la cabecera.")); return; }
    const axis = control.dataset.markerAxis;
    const speedField = document.getElementById(axis.startsWith("r") ? "robotJogAngularSpeed" : "robotJogLinearSpeed");
    const speed = Number(speedField.value);
    if (!Number.isFinite(speed) || speed < 1 || speed > 90) {
      reportError(new Error("Usa una velocidad entre 1 y 90."));
      return;
    }
    pressedControl = control;
    control.classList.add("is-selected");
    starting = true;
    status.textContent = "Iniciando movimiento…";
    try {
      const result = await request("robotJogStart", {
        sensorPath: path, axis, direction: Number(control.dataset.markerDirection),
        frame: frame.value, speed
      });
      activeId = result.id;
      startedAt = performance.now();
      status.textContent = `Moviendo TCP en ${axis.toUpperCase()} · ${frame.value === "tool" ? "TCP" : "World"}`;
      if (pressedControl !== control || !dialog.open) {
        stop();
      } else {
        heartbeatTimer = setInterval(pulse, 350);
        pulse();
      }
    } catch (error) {
      control.classList.remove("is-selected");
      pressedControl = null;
      reportError(error);
    } finally {
      starting = false;
    }
  }

  document.getElementById("robotJogOpen").addEventListener("click", () => {
    RoboticaPoseInsert.rememberEditor();
    frame.value = "tool";
    measuredPose = null;
    userEditing = false;
    fields.forEach(field => { field.value = ""; field.parentElement.classList.remove("is-pending"); });
    status.textContent = "Mantén pulsado un eje para mover el TCP.";
    dialog.showModal();
    axesOwner = crypto.randomUUID();
    if (sensorPath()) updateAxes("robotJogAxesShow", axesOwner, sensorPath());
    readPose();
  });
  document.getElementById("tcpSensorSelect").addEventListener("change", () => {
    if (dialog.open && axesOwner && sensorPath()) {
      userEditing = false;
      updateAxes("robotJogAxesShow", axesOwner, sensorPath());
      readPose();
    }
  });

  for (const field of fields) {
    field.addEventListener("input", () => {
      if (measuredPose) refreshPending();
      else { userEditing = true; field.parentElement.classList.add("is-pending"); }
      if (userEditing) status.textContent = "Destino pendiente: el TCP todavía no está en esta pose.";
    });
  }

  document.getElementById("robotJogSavePoint").addEventListener("click", () => {
    try {
      RoboticaPoseInsert.appendPoint(destination(), dialog);
    } catch (error) {
      reportError(error);
    }
  });

  document.getElementById("robotJogMovePose").addEventListener("click", async () => {
    if (activeId || starting || busy) return;
    try {
      const pose = destination();
      if (!sensorPath()) throw new Error("Selecciona un sensor TCP en la cabecera.");
      busy = true;
      status.textContent = "Calculando IK y moviendo el robot al destino…";
      const result = await request("robotJogMovePose", { sensorPath: sensorPath(), pose });
      userEditing = false;
      showPose(result);
      status.textContent = "El TCP llegó al destino.";
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
    }
  });

  for (const control of controller.querySelectorAll(".pose-control")) {
    control.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      start(control);
    });
    control.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        start(control);
      }
    });
    control.addEventListener("keyup", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); stop(); }
    });
  }
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  dialog.addEventListener("close", () => {
    stop();
    if (axesOwner) updateAxes("robotJogAxesHide", axesOwner);
    axesOwner = "";
  });
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  dialog.querySelector(".dialog-close").addEventListener("click", event => {
    if (busy) { event.preventDefault(); status.textContent = "Espera a que termine la alineación."; }
  });
  setInterval(readPose, 1000);

  for (const button of dialog.querySelectorAll("[data-align-axis]")) {
    button.addEventListener("click", async () => {
      if (activeId || starting || busy) return;
      if (!sensorPath()) { reportError(new Error("Selecciona un sensor TCP en la cabecera.")); return; }
      const axis = button.dataset.alignAxis;
      busy = true;
      status.textContent = axis === "z" ? "Alineando Z del TCP hacia abajo…" : `Alineando ${axis.toUpperCase()} del TCP con World…`;
      try {
        const result = await request("robotJogAlignAxis", { sensorPath: sensorPath(), axis });
        showPose(result);
        status.textContent = `Eje ${axis.toUpperCase()} alineado.`;
      } catch (error) {
        reportError(error);
      } finally {
        busy = false;
      }
    });
  }
})();
