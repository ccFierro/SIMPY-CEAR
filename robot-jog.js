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
    [...result.position, ...result.rotation].forEach((value, index) => {
      fields[index].value = Number(value).toFixed(4);
    });
  }

  function reportError(error) {
    status.textContent = "Movimiento detenido.";
    RoboLabNotifications.show(error.message || String(error), { within: dialog, type: "error" });
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
    frame.value = "tool";
    status.textContent = "Mantén pulsado un eje para mover el TCP.";
    dialog.showModal();
    readPose();
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
  dialog.addEventListener("close", stop);
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  dialog.querySelector(".dialog-close").addEventListener("click", event => {
    if (busy) { event.preventDefault(); status.textContent = "Espera a que termine la alineación."; }
  });
  setInterval(readPose, 1000);

  document.getElementById("robotJogAlignZ").addEventListener("click", async () => {
    if (activeId || starting || busy) return;
    if (!sensorPath()) { reportError(new Error("Selecciona un sensor TCP en la cabecera.")); return; }
    busy = true;
    status.textContent = "Alineando Z de la herramienta hacia abajo…";
    try {
      const result = await request("robotJogAlignZ", { sensorPath: sensorPath() });
      showPose(result);
      status.textContent = "Herramienta alineada hacia abajo.";
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
    }
  });
})();
