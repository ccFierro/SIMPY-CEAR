(function (global) {
  "use strict";
  let token = "";
  let session = "";
  let cursor = 0;
  let closed = false;
  let pending = null;
  let storageQueue = Promise.resolve();
  const buffered = new Map();
  const api = { available: false, info: null, storagePending: false };

  async function request(endpoint, data = {}, options = {}) {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "X-RoboticaLab-Token": token },
      body: JSON.stringify(data), ...options
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "El servicio Python no respondió.");
    return result;
  }

  function deliver(event) {
    if (event.type === "exit") {
      api.available = false;
      if (pending) { pending.reject(new Error(event.message)); pending = null; }
      document.dispatchEvent(new CustomEvent("python-status", { detail: { ready: false, message: event.message } }));
    }
    if (event.type === "ready") {
      api.available = true;
      document.dispatchEvent(new Event("python-widget-reset"));
      document.dispatchEvent(new CustomEvent("python-status", { detail: { ready: true, message: `Python ${event.python}` } }));
    }
    if (event.type === "widget") {
      document.dispatchEvent(new CustomEvent("python-widget", { detail: event }));
      return;
    }
    if (!event.runId) return;
    if (!pending || pending.runId !== event.runId) {
      if (!buffered.has(event.runId)) buffered.set(event.runId, []);
      buffered.get(event.runId).push(event);
      if (buffered.size > 8) buffered.delete(buffered.keys().next().value);
      return;
    }
    try { pending.onEvent(event); }
    catch (error) { console.error("No se pudo representar un evento Python", error); }
    if (event.type === "done") {
      const resolve = pending.resolve;
      pending = null;
      resolve(event);
    }
  }

  async function poll() {
    let failures = 0;
    while (!closed) {
      try {
        const response = await fetch(`/api/events?session=${encodeURIComponent(session)}&after=${cursor}`, { headers: { "X-RoboticaLab-Token": token }, signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("La sesión Python no está disponible. Recarga la aplicación.");
        const result = await response.json();
        cursor = result.cursor;
        failures = 0;
        if (result.dropped && pending) pending.onEvent({ type: "output", stream: "stderr", text: "\n[Se omitieron eventos por exceso de salida]\n" });
        result.events.forEach(deliver);
      } catch (error) {
        if (closed) break;
        if (++failures >= 3) {
          api.available = false;
          if (pending) { pending.reject(error); pending = null; }
          document.dispatchEvent(new CustomEvent("python-status", { detail: { ready: false, message: error.message } }));
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  api.initialize = async () => {
    if (location.protocol === "file:") return { error: "Para ejecutar Python, abre Iniciar_Cuaderno_Coppelia.bat. El HTML solo permite editar y guardar actividades." };
    try {
      const response = await fetch("/api/bootstrap", { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Inicia CEAR RoboLab Coppelia con su lanzador para ejecutar Python.");
      const info = await response.json();
      token = info.token;
      api.info = info;
      // Keep an existing browser copy if it is newer than the durable file copy.
      try {
        const local = JSON.parse(localStorage.getItem("roboticalab.autosave.v1") || "null");
        const disk = JSON.parse(info.storage["roboticalab.autosave.v1"] || "null");
        if (disk && (!local || String(disk.savedAt) >= String(local.savedAt))) {
          Object.entries(info.storage).forEach(([key, value]) => localStorage.setItem(key, value));
        }
      } catch { /* Editing remains available when browser storage is blocked. */ }
      session = (await request("/api/session")).session;
      api.available = true;
      poll();
      return info;
    } catch (error) { return { error: error.message }; }
  };

  api.run = async (source, cellId, options, onEvent) => {
    if (!api.available) throw new Error("Python no está conectado. Abre el lanzador o reinicia Python.");
    if (pending) throw new Error("Ya existe una ejecución Python activa.");
    const result = await request("/api/execute", { session, source, cellId, ...options });
    return new Promise((resolve, reject) => {
      pending = { runId: result.runId, resolve, reject, onEvent };
      const events = buffered.get(result.runId) || [];
      buffered.delete(result.runId);
      events.forEach(deliver);
    });
  };
  api.control = action => request("/api/control", { session, action });
  api.input = value => request("/api/control", { session, action: "input", value });
  api.widget = (id, value) => request("/api/widget", { session, id, value });
  api.reset = () => request("/api/reset", { session });
  api.complete = data => request("/api/complete", data);
  api.exportSource = (source, legacyMatmul) => request("/api/export", { source, legacyMatmul });
  api.coppelia = settings => request("/api/coppelia", settings);
  api.persistStorage = () => {
    if (!token) return Promise.resolve();
    const values = {};
    for (const key of ["roboticalab.autosave.v1", "roboticalab.history.v1", "roboticalab.editorWidth"]) {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    api.storagePending = true;
    storageQueue = storageQueue.catch(() => {}).then(() => request("/api/storage", { values }));
    const current = storageQueue;
    return current.then(() => {
      if (current === storageQueue) api.storagePending = false;
      document.dispatchEvent(new CustomEvent("python-storage", { detail: { ok: true } }));
    }, error => {
      if (current === storageQueue) api.storagePending = false;
      document.dispatchEvent(new CustomEvent("python-storage", { detail: { ok: false, message: error.message } }));
    });
  };
  window.addEventListener("pagehide", () => {
    closed = true;
    if (session) request("/api/close-session", { session }, { keepalive: true }).catch(() => {});
  });
  global.PythonRuntime = api;
})(window);
