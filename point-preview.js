(function () {
  "use strict";

  const toggle = document.getElementById("showCodePoints");
  const label = toggle.closest("label");
  const storageKey = "simpy-cear:show-code-points";
  try { toggle.checked = localStorage.getItem(storageKey) !== "false"; } catch (_) { /* Preferencia opcional. */ }

  let busy = false;
  let queued = false;
  let lastSignature = "";
  let lastSuccess = 0;
  let editTimer = null;

  function snapshot() {
    return {
      visible: toggle.checked,
      sources: toggle.checked ? [...document.querySelectorAll(".cell-editor")].map(editor => editor.value) : [],
      host: document.getElementById("coppeliaHost").value.trim(),
      port: Number(document.getElementById("coppeliaPort").value),
      extraPath: document.getElementById("coppeliaClientPath").value.trim()
    };
  }

  async function sync() {
    if (busy) { queued = true; return; }
    if (!PythonRuntime.available) return;
    const values = snapshot();
    const signature = JSON.stringify(values);
    if (signature === lastSignature && Date.now() - lastSuccess < 12000) return;
    busy = true;
    try {
      const result = await PythonRuntime.coppelia({ action: "previewPoints", ...values });
      if (!result.ok) throw new Error(result.message || "No se pudieron actualizar los puntos.");
      lastSignature = signature;
      lastSuccess = Date.now();
      const conflicts = result.markers?.filter(marker => marker.status === "name_conflict").length || 0;
      label.title = conflicts ? `${conflicts} nombre(s) de punto ya existen en la escena.` :
        values.visible ? `${result.visible || 0} punto(s) del cuaderno visibles en CoppeliaSim.` : "Puntos ocultos en CoppeliaSim.";
    } catch (error) {
      label.title = `No se pudieron actualizar los puntos: ${error.message}`;
    } finally {
      busy = false;
      if (queued) { queued = false; sync(); }
    }
  }

  toggle.addEventListener("change", () => {
    try { localStorage.setItem(storageKey, String(toggle.checked)); } catch (_) { /* Preferencia opcional. */ }
    sync();
  });
  document.addEventListener("input", event => {
    if (!event.target.matches?.(".cell-editor, #coppeliaHost, #coppeliaPort, #coppeliaClientPath")) return;
    clearTimeout(editTimer);
    editTimer = setTimeout(sync, 650);
  });
  document.addEventListener("python-status", event => { if (event.detail?.ready) sync(); });
  window.addEventListener("focus", sync);
  setInterval(sync, 3000);
  setTimeout(sync, 800);
})();
