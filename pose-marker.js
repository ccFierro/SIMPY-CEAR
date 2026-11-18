(function () {
  "use strict";

  const dialog = document.getElementById("poseMarkerDialog");
  const status = document.getElementById("poseMarkerStatus");
  const code = document.getElementById("poseMarkerCode");
  const fields = ["X", "Y", "Z", "Rx", "Ry", "Rz"].map(name => document.getElementById(`poseMarker${name}`));
  const controller = dialog.querySelector(".pose-controller");
  const rotationDials = document.getElementById("poseRotationDials");
  let busy = false;
  let currentCode = "";
  let lastEditor = null;

  function reportError(message) {
    status.textContent = "";
    status.classList.remove("error");
    RoboLabNotifications.show(message, { within: dialog, type: "error" });
  }

  dialog.addEventListener("close", () => RoboLabNotifications.dismiss());

  for (const axis of ["x", "y", "z"]) {
    const label = axis.toUpperCase();
    const dial = document.createElement("div");
    dial.className = `pose-rotation-dial pose-axis-${axis}`;
    dial.innerHTML = `<span class="pose-rotation-axis" aria-hidden="true">${label}</span>
      <span class="pose-control pose-rotation-segment" role="button" tabindex="0" aria-label="Girar alrededor de ${label} en sentido negativo" data-marker-axis="r${axis}" data-marker-direction="-1" aria-disabled="false"><span aria-hidden="true">↶</span></span>
      <span class="pose-control pose-rotation-segment" role="button" tabindex="0" aria-label="Girar alrededor de ${label} en sentido positivo" data-marker-axis="r${axis}" data-marker-direction="1" aria-disabled="false"><span aria-hidden="true">↷</span></span>`;
    rotationDials.append(dial);
  }

  document.addEventListener("focusin", event => {
    if (event.target.matches?.(".cell-editor")) lastEditor = event.target;
  });

  function settings() {
    return {
      host: document.getElementById("coppeliaHost").value.trim(),
      port: Number(document.getElementById("coppeliaPort").value),
      extraPath: document.getElementById("coppeliaClientPath").value.trim()
    };
  }

  function show(result) {
    [...result.position, ...result.rotation].forEach((value, index) => {
      fields[index].value = Number(value.toFixed(6));
    });
    currentCode = result.code;
    code.textContent = currentCode;
    status.textContent = `${result.path} · pose World actualizada.`;
    status.classList.remove("error");
  }

  async function send(action, values = {}) {
    if (busy) return;
    RoboLabNotifications.dismiss();
    busy = true;
    dialog.querySelectorAll("button:not(.dialog-close)").forEach(button => { button.disabled = true; });
    controller.querySelectorAll(".pose-control").forEach(control => control.setAttribute("aria-disabled", "true"));
    status.textContent = "Consultando CoppeliaSim…";
    status.classList.remove("error");
    try {
      const result = await PythonRuntime.coppelia({ ...settings(), action, ...values });
      if (!result.ok) throw new Error(result.message || "No se pudo modificar el marcador.");
      if (result.deleted) {
        currentCode = "";
        code.textContent = "Sin marcador en la escena";
        fields.forEach(field => { field.value = ""; });
        status.textContent = result.message;
        status.classList.remove("error");
      } else {
        show(result);
        if (result.message) status.textContent = result.message;
      }
    } catch (error) {
      reportError(error.message || String(error));
    } finally {
      busy = false;
      dialog.querySelectorAll("button").forEach(button => { button.disabled = false; });
      controller.querySelectorAll(".pose-control").forEach(control => control.setAttribute("aria-disabled", "false"));
    }
  }

  document.getElementById("poseMarkerOpen").addEventListener("click", () => {
    lastEditor = document.querySelector(".code-cell.active .cell-editor") || lastEditor;
    currentCode = "";
    code.textContent = "Pose pendiente de leer";
    dialog.showModal();
    send("markerRead");
  });
  document.getElementById("poseMarkerCreate").addEventListener("click", () => send("markerCreate"));
  document.getElementById("poseMarkerRead").addEventListener("click", () => send("markerRead"));
  document.getElementById("poseMarkerMoveTcp").addEventListener("click", () => {
    const sensorPath = document.getElementById("tcpSensorSelect").value;
    if (!sensorPath) {
      reportError("Selecciona primero un sensor TCP en la cabecera.");
      return;
    }
    send("markerMoveTcp", { sensorPath });
  });
  document.getElementById("poseMarkerDelete").addEventListener("click", () => send("markerDelete"));
  document.getElementById("poseMarkerApply").addEventListener("click", () => {
    const numbers = fields.map(field => Number(field.value));
    if (fields.some(field => field.value.trim() === "" || !Number.isFinite(Number(field.value)))) {
      reportError("Completa las seis coordenadas con números finitos.");
      return;
    }
    send("markerSet", { position: numbers.slice(0, 3), rotation: numbers.slice(3) });
  });
  for (const field of fields) {
    field.addEventListener("input", () => {
      currentCode = "";
      code.textContent = "Aplica la pose para actualizar p[...]";
      status.textContent = "Cambios pendientes en el marcador.";
      status.classList.remove("error");
    });
  }
  for (const control of controller.querySelectorAll(".pose-control")) {
    const jog = () => {
      if (busy) return;
      const axis = control.dataset.markerAxis;
      const step = Number(document.getElementById(axis.startsWith("r") ? "poseMarkerAngularStep" : "poseMarkerLinearStep").value);
      control.classList.add("is-selected");
      send("markerJog", { axis, direction: Number(control.dataset.markerDirection), step,
        frame: document.getElementById("poseMarkerFrame").value }).finally(() => control.classList.remove("is-selected"));
    };
    control.addEventListener("click", jog);
    control.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        jog();
      }
    });
  }
  document.getElementById("poseMarkerCopy").addEventListener("click", async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      status.textContent = "Pose copiada al portapapeles.";
    } catch (error) {
      reportError("No se pudo acceder al portapapeles; usa «Insertar en celda».");
    }
  });
  document.getElementById("poseMarkerInsert").addEventListener("click", () => {
    if (!currentCode) return;
    const editor = lastEditor?.isConnected ? lastEditor : document.querySelector(".cell-editor");
    if (!editor || editor.readOnly) {
      reportError("Selecciona una celda editable antes de insertar la pose.");
      return;
    }
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    RoboticaEditor.replace(editor, { start, end, text: currentCode });
    dialog.close();
    editor.focus();
  });
})();
