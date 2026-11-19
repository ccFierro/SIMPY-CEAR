(function (global) {
  "use strict";

  const FORMAT = "RoboticaLabActivity";
  const VERSION = 2;
  const AUTOSAVE_KEY = "roboticalab.autosave.v1";
  const HISTORY_KEY = "roboticalab.history.v1";
  const MAX_HISTORY = 12;

  function finite(value, fallback, min, max) {
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  }

  function normalizeActivity(input) {
    if (!input || typeof input !== "object" || input.format !== FORMAT) throw new Error("El archivo no es una actividad de CEAR RoboLab.");
    if (![1, VERSION].includes(input.version)) throw new Error(`La versión ${input.version ?? "desconocida"} del archivo no es compatible.`);
    if (!Array.isArray(input.cells) || input.cells.length < 1 || input.cells.length > 100) throw new Error("La actividad debe contener entre 1 y 100 celdas.");
    const cells = input.cells.map((cell, index) => {
      if (!cell || typeof cell.source !== "string") throw new Error(`La celda ${index + 1} no contiene código válido.`);
      if (cell.source.length > 200000) throw new Error(`La celda ${index + 1} supera el tamaño permitido.`);
      return {
        source: cell.source,
        title: typeof cell.title === "string" ? cell.title.slice(0, 80) : "",
        collapsed: cell.collapsed === true,
        enabled: cell.enabled !== false
      };
    });
    const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
    const camera = settings.camera && typeof settings.camera === "object" ? settings.camera : {};
    const planes = Array.isArray(settings.visiblePlanes)
      ? settings.visiblePlanes.filter(plane => ["xy", "xz", "yz"].includes(plane))
      : ["xy"];
    return {
      format: FORMAT,
      version: VERSION,
      name: typeof input.name === "string" ? input.name.slice(0, 100) : "Actividad sin nombre",
      teacherInstructions: typeof input.teacherInstructions === "string" ? input.teacherInstructions.slice(0, 20000) : "",
      savedAt: typeof input.savedAt === "string" ? input.savedAt : new Date().toISOString(),
      cells,
      settings: {
        legacyMatmul: input.version === 1 || settings.legacyMatmul === true,
        coppeliaHost: typeof settings.coppeliaHost === "string" ? settings.coppeliaHost.slice(0, 255) : "127.0.0.1",
        coppeliaPort: Math.round(finite(settings.coppeliaPort, 23000, 1, 65535)),
        coppeliaClientPath: typeof settings.coppeliaClientPath === "string" ? settings.coppeliaClientPath.slice(0, 2048) : "",
        coppeliaRobotRoot: typeof settings.coppeliaRobotRoot === "string" ? settings.coppeliaRobotRoot.slice(0, 256) : "",
        coppeliaIkTarget: typeof settings.coppeliaIkTarget === "string" ? settings.coppeliaIkTarget.slice(0, 256) : "",
        coppeliaFrame: settings.coppeliaFrame === "tool" ? "tool" : "world",
        theme: settings.theme === "dark" ? "dark" : "light",
        viewMode: settings.viewMode === "3d" ? "3d" : "2d",
        showPointLabels: settings.showPointLabels !== false,
        showGrid: settings.showGrid !== false,
        showAxes: settings.showAxes !== false,
        showLegend: settings.showLegend !== false,
        showLocalFrames: settings.showLocalFrames === true,
        compareLocalFrames: settings.compareLocalFrames === true,
        localFrameScale: finite(settings.localFrameScale, 1, 0.1, 20),
        scale: finite(settings.scale, 48, 20, 100),
        camera: {
          yaw: finite(camera.yaw, -0.65, -Math.PI * 4, Math.PI * 4),
          pitch: finite(camera.pitch, 0.48, -Math.PI / 2, Math.PI / 2),
          panX: finite(camera.panX, 0, -10000, 10000),
          panY: finite(camera.panY, 0, -10000, 10000)
        },
        visiblePlanes: planes.length ? [...new Set(planes)] : ["xy"],
        animationSpeed: ["slow", "normal", "fast"].includes(settings.animationSpeed) ? settings.animationSpeed : "normal",
        autoSave: settings.autoSave !== false
      }
    };
  }

  function safeParse(text) {
    try { return normalizeActivity(JSON.parse(text)); }
    catch (error) { throw new Error(`No se pudo abrir la actividad: ${error.message}`); }
  }

  function read(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch { return fallback; }
  }

  function loadAutosave(storage = global.localStorage) {
    try {
      const raw = storage.getItem(AUTOSAVE_KEY);
      return raw ? normalizeActivity(JSON.parse(raw)) : null;
    } catch { return null; }
  }

  function inspectAutosave(storage) {
    try {
      const target = storage || global.localStorage;
      const raw = target.getItem(AUTOSAVE_KEY);
      if (!raw) return { status: "empty", activity: null };
      try { return { status: "ready", activity: normalizeActivity(JSON.parse(raw)) }; }
      catch { return { status: "invalid", activity: null }; }
    } catch { return { status: "unavailable", activity: null }; }
  }

  function saveAutosave(activity, storage = global.localStorage) {
    const normalized = normalizeActivity(activity);
    storage.setItem(AUTOSAVE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function activityFingerprint(activity) {
    const copy = { ...activity, savedAt: "" };
    return JSON.stringify(copy);
  }

  function pushHistory(activity, storage = global.localStorage) {
    const normalized = normalizeActivity(activity);
    const rawHistory = read(storage, HISTORY_KEY, []);
    const history = (Array.isArray(rawHistory) ? rawHistory : []).filter(item => {
      try { return normalizeActivity(item); } catch { return false; }
    });
    if (!history.length || activityFingerprint(history[0]) !== activityFingerprint(normalized)) history.unshift(normalized);
    const trimmed = history.slice(0, MAX_HISTORY);
    storage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return trimmed;
  }

  function loadHistory(storage) {
    let history;
    try { history = read(storage || global.localStorage, HISTORY_KEY, []); }
    catch { return []; }
    return (Array.isArray(history) ? history : []).flatMap(item => {
      try { return [normalizeActivity(item)]; } catch { return []; }
    }).slice(0, MAX_HISTORY);
  }

  function clearLocal(storage) {
    try {
      const target = storage || global.localStorage;
      target.removeItem(AUTOSAVE_KEY);
      target.removeItem(HISTORY_KEY);
      return true;
    } catch { return false; }
  }

  const api = { FORMAT, VERSION, AUTOSAVE_KEY, HISTORY_KEY, MAX_HISTORY, normalizeActivity, safeParse, loadAutosave, inspectAutosave, saveAutosave, pushHistory, loadHistory, clearLocal };
  global.RoboticaStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
