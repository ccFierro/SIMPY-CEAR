(function (global) {
  "use strict";

  const shapes = {
    folder: '<path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/>',
    save: '<path d="M4 3h14l3 3v15H3V3z"/><path d="M7 3v7h10V3M7 21v-8h10v8"/>',
    open: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v3"/><path d="M3 10h18l-2 11H5z"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
    history: '<path d="M3 12a9 9 0 1 1 2.6 6.4M3 17v-5h5m4-4v5l3 2"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/>',
    book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zM12 5v15"/>',
    settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="17" r="2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    step: '<path d="m5 4 11 8-11 8zM20 4v16"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    hand: '<path d="M8 12V5a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 5-3 8-8 8h-1c-3 0-5-2-7-5l-2-3a2 2 0 0 1 3-2l3 3"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5"/>',
    terminal: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="m6 8 4 4-4 4m6 0h5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    variables: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    alert: '<path d="M12 3 2 21h20L12 3zM12 9v5m0 4h.01"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>'
  };

  const assignments = {
    activityMenuTrigger: "folder", saveActivity: "save", openActivity: "open", exportPython: "code", showRecovery: "history", clearLocalData: "trash",
    layoutToggle: "expand", guideButton: "book", pythonSettingsButton: "settings", exportEvidence: "image",
    runCode: "play", pauseExecution: "pause", stopExecution: "stop", findCode: "search", resetNotebook: "reset", addCell: "plus", nextPythonStep: "step",
    resetView: "reset", centerContent: "target", orbitTool: "target", panTool: "hand", togglePointLabels: "eye",
    tabVariables: "variables", tabTransform: "target", tabOutput: "terminal", tabDiagnostics: "alert", tabVisualization: "settings", toggleResults: "eye",
    probeCoppelia: "link", insertCoppelia: "code", referenceTrigger: "book", showTransformOnGraph: "eye",
    poseMarkerOpen: "target", sceneInventoryToggle: "variables"
  };

  function add(button, name) {
    if (!button || !shapes[name]) return;
    const existing = button.querySelector(".button-icon");
    if (existing) {
      if (existing.dataset.name !== name) { existing.innerHTML = shapes[name]; existing.dataset.name = name; }
      return;
    }
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "button-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.8");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.dataset.name = name;
    icon.innerHTML = shapes[name];
    button.prepend(icon);
    button.classList.add("has-button-icon");
  }

  Object.entries(assignments).forEach(([id, name]) => add(document.getElementById(id), name));
  add(document.querySelector(".activity-settings summary"), "settings");
  global.RoboticaIcons = { add };
})(window);

"use strict";

const notebook = document.getElementById("notebook");
const canvas = document.getElementById("plotCanvas");
const ctx = canvas.getContext("2d");
const consoleOutput = document.getElementById("consoleOutput");
const resultCards = document.getElementById("resultCards");
const variableInspector = document.getElementById("variableInspector");
const legend = document.getElementById("legend");
const emptyState = document.getElementById("emptyState");
const coordinateInspector = document.getElementById("coordinateInspector");
const runtimeStatus = document.getElementById("runtimeStatus");
const runButton = document.getElementById("runCode");
const activityMenu = document.getElementById("activityMenu");
const activityMenuTrigger = document.getElementById("activityMenuTrigger");
const activityOptions = document.getElementById("activityOptions");
const activityOptionsPanel = document.getElementById("activityOptionsPanel");
const saveStatus = document.getElementById("saveStatus");
const activityNameInput = document.getElementById("activityName");
const teacherInstructionsInput = document.getElementById("teacherInstructions");
const autoSaveInput = document.getElementById("autoSaveEnabled");
const animationSpeedInput = document.getElementById("animationSpeed");
const activityFileInput = document.getElementById("activityFileInput");
const recoveryBackdrop = document.getElementById("recoveryBackdrop");
const recoveryList = document.getElementById("recoveryList");
let scale = 48;
let latestResult = { drawings: [], variables: {}, logs: [] };
let viewMode = "2d";
let showPointLabels = true;
let showGrid = true;
let showAxes = true;
let showLegend = true;
let camera = { yaw: -0.65, pitch: 0.48, panX: 0, panY: 0 };
let cameraTool = "orbit";
let dragState = null;
let hoveredCoordinate = null;
let lockedCoordinate = null;
let suppressCanvasClick = false;
let currentAnimation = null;
const visiblePlanes = new Set(["xy"]);
const hiddenDrawingKeys = new Set();
let notebookSession = { variables: {} };
let kernelResetPending = Promise.resolve();
let pythonResetting = false;
let activePythonCell = null;
let lastSelectedCell = null;
let linkedSourceCell = null;
let cellSequence = 0;
let executionCounter = 0;
let activeStepCell = null;
let selectedVariableName = null;
let latestVariableChanges = {};
let flowMatrixName = null;
let flowPointName = null;
let flowAnalysis = null;
let flowOverlayVisible = false;
let flowProgress = 1;
let showLocalFrames = false;
let compareLocalFrames = false;
let localFrameScale = 1;
let animationSpeed = "normal";
let autoSaveEnabled = true;
let autosaveTimer = null;
let restoringActivity = false;
let savedFingerprint = "";
let exportedFingerprint = "";
let activityDirty = false;
const execution = new ExecutionController(updateExecutionControls);

function updateExecutionControls(run) {
  const busy = Boolean(run);
  runButton.disabled = busy || pythonResetting || !PythonRuntime.available;
  document.getElementById("pauseExecution").hidden = !busy;
  document.getElementById("pauseExecution").textContent = run?.paused ? "Continuar" : "Pausar";
  RoboticaIcons.add(document.getElementById("pauseExecution"), run?.paused ? "play" : "pause");
  document.getElementById("pauseExecution").disabled = Boolean(run?.cancelled);
  document.getElementById("stopExecution").hidden = !busy;
  document.querySelectorAll(".cell-remove, .cell-move, .cell-insert-row button, #addCell, #resetNotebook, #openActivity, #showRecovery, #clearLocalData, #exportEvidence").forEach(button => { button.disabled = busy; });
  document.querySelectorAll(".cell-enabled").forEach(input => { input.disabled = busy; });
  document.querySelectorAll(".cell-editor").forEach(editor => { editor.readOnly = busy; });
  document.querySelectorAll(".cell-run, .cell-step").forEach(button => { button.disabled = busy || pythonResetting || !PythonRuntime.available || !button.closest(".code-cell").querySelector(".cell-enabled").checked; });
  const orderedCells = [...notebook.querySelectorAll(".code-cell")];
  orderedCells.forEach((cell, index) => {
    cell.querySelector(".cell-move-up").disabled = busy || pythonResetting || index === 0;
    cell.querySelector(".cell-move-down").disabled = busy || pythonResetting || index === orderedCells.length - 1;
  });
  document.querySelectorAll("#insertCoppelia, #legacyMatmul, #coppeliaClientPath").forEach(element => { element.disabled = busy; });
  document.getElementById("pythonStepBar").hidden = !busy || !run.paused || Boolean(currentAnimation);
  runtimeStatus.classList.toggle("ready", !busy && !pythonResetting && PythonRuntime.available);
  runtimeStatus.lastChild.textContent = run?.cancelled ? " Interrumpiendo…" : run?.paused ? " En pausa" : busy ? " Ejecutando Python…" : pythonResetting ? " Reiniciando Python…" : PythonRuntime.available ? ` Python ${PythonRuntime.info?.python || ""}` : " Python desconectado";
}
runtimeStatus.classList.add("ready");
runtimeStatus.lastChild.textContent = " Listo";

function updateLineNumbers(editor) {
  const lineNumbers = editor.closest(".cell-code-wrap").querySelector(".line-numbers");
  const lines = editor.value.split("\n").length;
  const style = getComputedStyle(editor);
  const lineHeight = parseFloat(style.lineHeight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  editor.parentElement.style.height = `${Math.max(140, lines * lineHeight + verticalPadding)}px`;
  const activeLine = Number(editor.closest(".code-cell").dataset.activeLine || 0);
  const errorLine = Number(editor.closest(".code-cell").dataset.errorLine || 0);
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => `${errorLine === i + 1 ? "!" : activeLine === i + 1 ? "▶" : " "}${i + 1}`).join("\n");
  lineNumbers.scrollTop = editor.scrollTop;
  RoboticaEditor.sync(editor);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  renderPlot();
}

function clearCanvas() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function worldToCanvas([x, y]) {
  return [canvas.clientWidth / 2 + camera.panX + x * scale, canvas.clientHeight / 2 + camera.panY - y * scale];
}

function themeColors() {
  const dark = document.body.classList.contains("dark-theme");
  return dark
    ? { canvas: "#091421", grid: "rgba(111,139,170,.10)", axis: "rgba(37,208,230,.48)", muted: "#5f7691", label: "rgba(7,17,30,.9)", text: "#d5e5f8" }
    : { canvas: "#f8fbfd", grid: "rgba(74,105,132,.13)", axis: "rgba(8,127,140,.48)", muted: "#637b91", label: "rgba(255,255,255,.94)", text: "#26394d" };
}

function cartesian3D(value) {
  return [value[0] || 0, value[1] || 0, value[2] || 0];
}

function project3DUnit(value) {
  const [x, y, z] = cartesian3D(value);
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const horizontal = x * cosYaw - y * sinYaw;
  const depth = x * sinYaw + y * cosYaw;
  const vertical = z * cosPitch - depth * sinPitch;
  return [horizontal, vertical, z * sinPitch + depth * cosPitch];
}

function project3D(value) {
  const [horizontal, vertical, depth] = project3DUnit(value);
  return [canvas.clientWidth / 2 + camera.panX + horizontal * scale, canvas.clientHeight / 2 + camera.panY - vertical * scale, depth];
}

function drawGrid() {
  const colors = themeColors();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  clearCanvas();
  ctx.fillStyle = colors.canvas;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2 + camera.panX;
  const cy = height / 2 + camera.panY;
  const minor = scale;
  if (showGrid) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.grid;
    ctx.beginPath();
    for (let x = cx % minor; x <= width; x += minor) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = cy % minor; y <= height; y += minor) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  }

  if (!showAxes) return;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(width, cy);
  ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
  ctx.stroke();

  ctx.fillStyle = colors.muted;
  ctx.font = "10px Cascadia Code, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let n = Math.ceil(-cx / minor); n <= Math.floor((width - cx) / minor); n += 1) {
    if (n !== 0) ctx.fillText(String(n), cx + n * minor, cy + 6);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let n = Math.ceil((cy - height) / minor); n <= Math.floor(cy / minor); n += 1) {
    if (n !== 0) ctx.fillText(String(n), cx - 7, cy - n * minor);
  }
  ctx.fillText("0", cx - 7, cy + 10);
}

function projectedLine3D(from, to, color, width = 1, dashed = false) {
  const [x1, y1] = project3D(from);
  const [x2, y2] = project3D(to);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGrid3D() {
  const colors = themeColors();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  clearCanvas();
  ctx.fillStyle = colors.canvas;
  ctx.fillRect(0, 0, width, height);

  const extent = Math.max(8, Math.ceil(Math.max(width, height) / scale));
  const planeColor = {
    xy: colors.grid,
    xz: document.body.classList.contains("dark-theme") ? "rgba(37,208,230,.09)" : "rgba(8,127,140,.10)",
    yz: document.body.classList.contains("dark-theme") ? "rgba(255,200,87,.08)" : "rgba(179,107,0,.09)"
  };
  const gridLine = (plane, fixed, varying) => {
    if (plane === "xy") return varying ? [[-extent, fixed, 0], [extent, fixed, 0]] : [[fixed, -extent, 0], [fixed, extent, 0]];
    if (plane === "xz") return varying ? [[-extent, 0, fixed], [extent, 0, fixed]] : [[fixed, 0, -extent], [fixed, 0, extent]];
    return varying ? [[0, -extent, fixed], [0, extent, fixed]] : [[0, fixed, -extent], [0, fixed, extent]];
  };
  if (showGrid) {
    for (const plane of visiblePlanes) {
      for (let n = -extent; n <= extent; n += 1) {
        const [fromA, toA] = gridLine(plane, n, false);
        const [fromB, toB] = gridLine(plane, n, true);
        projectedLine3D(fromA, toA, planeColor[plane]);
        projectedLine3D(fromB, toB, planeColor[plane]);
      }
    }
  }

  if (!showAxes) return;
  arrow3D([0, 0, 0], [2, 0, 0], "#ff7386", 2.4);
  arrow3D([0, 0, 0], [0, 2, 0], "#55e6a5", 2.4);
  arrow3D([0, 0, 0], [0, 0, 2], "#25d0e6", 2.4);
  drawLabel3D([2, 0, 0], "X", "#ff7386");
  drawLabel3D([0, 2, 0], "Y", "#55e6a5");
  drawLabel3D([0, 0, 2], "Z", "#25d0e6");
}

function arrow(from, to, color, width = 2) {
  const [x1, y1] = worldToCanvas(from);
  const [x2, y2] = worldToCanvas(to);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 9;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
}

function arrow3D(from, to, color, width = 2) {
  const [x1, y1] = project3D(from);
  const [x2, y2] = project3D(to);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 9;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
}

function drawLabel(point, label, color) {
  const [x, y] = worldToCanvas(point);
  ctx.font = "600 11px Inter, sans-serif";
  const width = ctx.measureText(label).width + 12;
  ctx.fillStyle = themeColors().label;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 9, y - 25, width, 20, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + 15, y - 15);
}

function drawLabel3D(point, label, color) {
  const [x, y] = project3D(point);
  ctx.font = "600 11px Inter, sans-serif";
  const width = ctx.measureText(label).width + 12;
  ctx.fillStyle = themeColors().label;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 9, y - 25, width, 20, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + 15, y - 15);
}

function drawPoint(item) {
  const [x, y] = worldToCanvas(item.point);
  ctx.fillStyle = item.color;
  ctx.shadowColor = item.color; ctx.shadowBlur = 13;
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  if (showPointLabels) drawLabel(item.point, `${item.label} (${format(item.point[0])}, ${format(item.point[1])})`, item.color);
}

function drawLine(item, dashed = true) {
  const [x1, y1] = worldToCanvas(item.from);
  const [x2, y2] = worldToCanvas(item.to);
  ctx.strokeStyle = item.color; ctx.lineWidth = 1.5; ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
}

function drawTrajectory(item) {
  if (item.points.length < 2) return;
  ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
  ctx.beginPath();
  item.points.forEach((point, index) => {
    const [x, y] = worldToCanvas(point);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  item.points.forEach(point => {
    const [x, y] = worldToCanvas(point);
    ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(x, y, 3.3, 0, Math.PI * 2); ctx.fill();
  });
}

function drawFrame(item) {
  const m = item.matrix;
  const translationColumn = m.length === 4 ? 3 : 2;
  const origin = [m[0][translationColumn], m[1][translationColumn]];
  const xEnd = [origin[0] + m[0][0] * 1.25, origin[1] + m[1][0] * 1.25];
  const yEnd = [origin[0] + m[0][1] * 1.25, origin[1] + m[1][1] * 1.25];
  arrow(origin, xEnd, "#ff7386", 2.4);
  arrow(origin, yEnd, "#55e6a5", 2.4);
  drawLabel(origin, item.label, themeColors().text);
}

function drawPoint3D(item) {
  const point = cartesian3D(item.point);
  const [x, y] = project3D(point);
  ctx.fillStyle = item.color;
  ctx.shadowColor = item.color;
  ctx.shadowBlur = 13;
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  if (showPointLabels) drawLabel3D(point, `${item.label} (${point.map(format).join(", ")})`, item.color);
}

function drawLine3D(item, dashed = true) {
  projectedLine3D(cartesian3D(item.from), cartesian3D(item.to), item.color, 1.5, dashed);
}

function drawTrajectory3D(item) {
  if (item.points.length < 2) return;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  item.points.forEach((point, index) => {
    const [x, y] = project3D(point);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  item.points.forEach(point => {
    const [x, y] = project3D(point);
    ctx.fillStyle = item.color;
    ctx.beginPath(); ctx.arc(x, y, 3.3, 0, Math.PI * 2); ctx.fill();
  });
}

function drawFrame3D(item) {
  const m = item.matrix;
  if (m.length !== 4) {
    const origin2D = [m[0][2], m[1][2], 0];
    arrow3D(origin2D, [origin2D[0] + m[0][0] * 1.25, origin2D[1] + m[1][0] * 1.25, 0], "#ff7386", 2.4);
    arrow3D(origin2D, [origin2D[0] + m[0][1] * 1.25, origin2D[1] + m[1][1] * 1.25, 0], "#55e6a5", 2.4);
    drawLabel3D(origin2D, item.label, themeColors().text);
    return;
  }

  const origin = [m[0][3], m[1][3], m[2][3]];
  const axisEnd = column => [
    origin[0] + m[0][column] * 1.25,
    origin[1] + m[1][column] * 1.25,
    origin[2] + m[2][column] * 1.25
  ];
  arrow3D(origin, axisEnd(0), "#ff7386", 2.4);
  arrow3D(origin, axisEnd(1), "#55e6a5", 2.4);
  arrow3D(origin, axisEnd(2), "#25d0e6", 2.4);
  drawLabel3D(origin, item.label, themeColors().text);
}

function drawingKey(item) {
  return `${item.type}:${item.label || item.type}`;
}

function isDrawingVisible(item) {
  return !hiddenDrawingKeys.has(drawingKey(item));
}

function lerpPoint(from, to, progress) {
  const length = Math.max(from.length, to.length);
  return Array.from({ length }, (_, index) => (from[index] || 0) + ((to[index] || 0) - (from[index] || 0)) * progress);
}

function partialTrajectory(points, progress) {
  if (points.length < 2 || progress >= 1) return points.map(point => point.slice());
  const scaled = progress * (points.length - 1);
  const completed = Math.floor(scaled);
  const result = points.slice(0, completed + 1).map(point => point.slice());
  if (completed < points.length - 1) result.push(lerpPoint(points[completed], points[completed + 1], scaled - completed));
  return result;
}

function interpolateFrameMatrix(matrix, progress) {
  if (matrix.length === 3) {
    const angle = Math.atan2(matrix[1][0], matrix[0][0]) * progress;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      [c, -s, matrix[0][2] * progress],
      [s, c, matrix[1][2] * progress],
      [0, 0, 1]
    ];
  }

  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
  let w; let x; let y; let z;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    w = scale / 4;
    x = (matrix[2][1] - matrix[1][2]) / scale;
    y = (matrix[0][2] - matrix[2][0]) / scale;
    z = (matrix[1][0] - matrix[0][1]) / scale;
  } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
    const scale = Math.sqrt(1 + matrix[0][0] - matrix[1][1] - matrix[2][2]) * 2;
    w = (matrix[2][1] - matrix[1][2]) / scale;
    x = scale / 4;
    y = (matrix[0][1] + matrix[1][0]) / scale;
    z = (matrix[0][2] + matrix[2][0]) / scale;
  } else if (matrix[1][1] > matrix[2][2]) {
    const scale = Math.sqrt(1 + matrix[1][1] - matrix[0][0] - matrix[2][2]) * 2;
    w = (matrix[0][2] - matrix[2][0]) / scale;
    x = (matrix[0][1] + matrix[1][0]) / scale;
    y = scale / 4;
    z = (matrix[1][2] + matrix[2][1]) / scale;
  } else {
    const scale = Math.sqrt(1 + matrix[2][2] - matrix[0][0] - matrix[1][1]) * 2;
    w = (matrix[1][0] - matrix[0][1]) / scale;
    x = (matrix[0][2] + matrix[2][0]) / scale;
    y = (matrix[1][2] + matrix[2][1]) / scale;
    z = scale / 4;
  }
  if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
  const quaternion = [1 + (w - 1) * progress, x * progress, y * progress, z * progress];
  const length = Math.hypot(...quaternion) || 1;
  const [qw, qx, qy, qz] = quaternion.map(value => value / length);
  const rotation = [
    [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
    [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
    [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)]
  ];
  return [
    [...rotation[0], matrix[0][3] * progress],
    [...rotation[1], matrix[1][3] * progress],
    [...rotation[2], matrix[2][3] * progress],
    [0, 0, 0, 1]
  ];
}

function interpolateDrawing(item, progress) {
  if (item.type === "line") return { ...item, to: lerpPoint(item.from, item.to, progress) };
  if (item.type === "trajectory") return { ...item, points: partialTrajectory(item.points, progress) };
  if (item.type === "vector") return { ...item, point: lerpPoint(item.point.map(() => 0), item.point, progress) };
  if (item.type === "frame") return { ...item, matrix: interpolateFrameMatrix(item.matrix, progress) };
  return item;
}

function refreshDrawingLayer() {
  latestResult.drawings = [...notebook.querySelectorAll(".code-cell")].flatMap(cell => cell._drawings || []);
  renderPlot();
  emptyState.classList.toggle("hidden", latestResult.drawings.length > 0 || (flowOverlayVisible && !!flowAnalysis));
}

function finishCurrentAnimation() {
  if (!currentAnimation) return;
  cancelAnimationFrame(currentAnimation.frame);
  currentAnimation.cell._drawings = currentAnimation.finalDrawings;
  currentAnimation.resolve();
  currentAnimation = null;
  refreshDrawingLayer();
}

function animateCellDrawings(cell, finalDrawings) {
  const animatedTypes = new Set(["line", "trajectory", "vector", "frame"]);
  const shouldAnimate = finalDrawings.some(item => animatedTypes.has(item.type))
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!shouldAnimate) {
    cell._drawings = finalDrawings;
    refreshDrawingLayer();
    return Promise.resolve();
  }

  finishCurrentAnimation();
  const timing = {
    slow: { action: 2300, reveal: 360, pause: 260 },
    normal: { action: 1600, reveal: 260, pause: 180 },
    fast: { action: 900, reveal: 170, pause: 100 }
  }[animationSpeed];
  const actionDuration = timing.action;
  const revealDuration = timing.reveal;
  const pause = timing.pause;
  let cursor = 0;
  const timeline = finalDrawings.map(item => {
    const duration = animatedTypes.has(item.type) ? actionDuration : revealDuration;
    const entry = { item, start: cursor, duration, animated: animatedTypes.has(item.type) };
    cursor += duration + pause;
    return entry;
  });
  const totalDuration = Math.max(1, cursor - pause);
  let elapsedTime = 0;
  let previousTime = performance.now();
  return new Promise(resolve => {
    currentAnimation = { cell, finalDrawings, frame: 0, resolve };
    const step = now => {
      if (!currentAnimation || currentAnimation.cell !== cell) return;
      if (!execution.current?.paused) elapsedTime += now - previousTime;
      previousTime = now;
      const elapsed = Math.min(totalDuration, elapsedTime);
      cell._drawings = timeline.flatMap(entry => {
        if (elapsed < entry.start) return [];
        if (!entry.animated || elapsed >= entry.start + entry.duration) return [entry.item];
        const raw = Math.max(0, Math.min(1, (elapsed - entry.start) / entry.duration));
        const progress = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
        return [interpolateDrawing(entry.item, progress)];
      });
      refreshDrawingLayer();
      if (elapsed < totalDuration) currentAnimation.frame = requestAnimationFrame(step);
      else {
        cell._drawings = finalDrawings;
        currentAnimation = null;
        refreshDrawingLayer();
        resolve();
      }
    };
    currentAnimation.frame = requestAnimationFrame(step);
  });
}

function renderPlot() {
  if (viewMode === "3d") {
    renderPlot3D();
    showCoordinateInspector(lockedCoordinate || hoveredCoordinate, Boolean(lockedCoordinate));
    return;
  }
  drawGrid();
  for (const item of latestResult.drawings || []) {
    if (!isDrawingVisible(item)) continue;
    if (item.type === "line") drawLine(item);
    if (item.type === "trajectory") drawTrajectory(item);
    if (item.type === "vector") { arrow([0, 0], item.point, item.color, 2.5); drawPoint({ ...item, type: "point" }); }
    if (item.type === "frame") drawFrame(item);
    if (item.type === "point") drawPoint(item);
  }
  drawTransformOverlay();
  showCoordinateInspector(lockedCoordinate || hoveredCoordinate, Boolean(lockedCoordinate));
}

function renderPlot3D() {
  drawGrid3D();
  for (const item of latestResult.drawings || []) {
    if (!isDrawingVisible(item)) continue;
    if (item.type === "line") drawLine3D(item);
    if (item.type === "trajectory") drawTrajectory3D(item);
    if (item.type === "vector") {
      arrow3D([0, 0, 0], cartesian3D(item.point), item.color, 2.5);
      drawPoint3D({ ...item, type: "point" });
    }
    if (item.type === "frame") drawFrame3D(item);
    if (item.type === "point") drawPoint3D(item);
  }
  drawTransformOverlay();
}

function drawTransformOverlay() {
  if (!flowOverlayVisible || !flowAnalysis) return;
  const from = flowAnalysis.from;
  const current = RoboticaVisualFlow.pointAt(flowAnalysis, flowProgress);
  const path = { from, to: current, color: "#b36b00" };
  const start = { point: from, label: flowAnalysis.pointName, color: "#b36b00" };
  const end = { point: current, label: `${flowAnalysis.matrixName}·${flowAnalysis.pointName}`, color: "#c13f75" };
  if (viewMode === "3d") { drawLine3D(path); drawPoint3D(start); drawPoint3D(end); }
  else { drawLine(path); drawPoint(start); drawPoint(end); }
  if (!showLocalFrames) return;
  const frames = RoboticaVisualFlow.localFrames(flowAnalysis, localFrameScale);
  if (!frames) return;
  if (compareLocalFrames) drawLocalFrame(frames.initial, true);
  drawLocalFrame(frames.final, false);
}

function drawLocalFrame(frameState, initial) {
  const colors = ["#e34b62", "#159a65", "#1388b0"];
  const project = viewMode === "3d" ? point => project3D(point) : point => worldToCanvas(point);
  const visibleAxes = viewMode === "3d" ? frameState.axes : frameState.axes.slice(0, 2);
  ctx.save();
  ctx.globalAlpha = initial ? 0.48 : 1;
  ctx.setLineDash(initial ? [5, 4] : []);
  visibleAxes.forEach((end, index) => {
    if (viewMode === "3d") arrow3D(frameState.origin, end, colors[index], 2);
    else arrow(frameState.origin, end, colors[index], 2);
  });
  ctx.setLineDash([]);
  const [x, y] = project(frameState.origin);
  ctx.strokeStyle = initial ? "#b36b00" : "#c13f75";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, initial ? 8 : 4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (compareLocalFrames) {
    ctx.save();
    ctx.fillStyle = initial ? "#a35e00" : "#b12e68";
    ctx.font = "700 11px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(initial ? "Inicio" : "Final", x + 10, y + (initial ? 5 : 17));
    ctx.restore();
  }
}

function format(value) {
  if (value?.__python__) return value.repr;
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value !== "number") return String(value);
  return Number.isInteger(value) ? value : Number(value.toFixed(3));
}

function displayValue(value) {
  if (Array.isArray(value)) {
    if (Array.isArray(value[0]) && value.every(Array.isArray)) return value.map(row => `[${row.map(format).join(", ")}]`).join(" ");
    return `[${value.map(format).join(", ")}]`;
  }
  return String(format(value));
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function activityFingerprint(activity) {
  return JSON.stringify({ ...activity, savedAt: "" });
}

function captureActivity(savedAt = new Date().toISOString()) {
  return RoboticaStorage.normalizeActivity({
    format: RoboticaStorage.FORMAT,
    version: RoboticaStorage.VERSION,
    name: activityNameInput.value.trim() || "Actividad sin nombre",
    teacherInstructions: teacherInstructionsInput.value,
    savedAt,
    cells: [...notebook.querySelectorAll(".code-cell")].map(cell => ({
      source: cell.querySelector(".cell-editor").value,
      title: cell.querySelector(".cell-title").value.trim(),
      collapsed: cell.classList.contains("is-collapsed"),
      enabled: cell.querySelector(".cell-enabled").checked
    })),
    settings: {
      legacyMatmul: document.getElementById("legacyMatmul").checked,
      coppeliaHost: document.getElementById("coppeliaHost").value.trim(),
      coppeliaPort: Number(document.getElementById("coppeliaPort").value),
      coppeliaClientPath: document.getElementById("coppeliaClientPath").value.trim(),
      coppeliaRobotRoot: document.getElementById("manualRobotRoot").value.trim(),
      coppeliaIkTarget: document.getElementById("manualTargetPath").value.trim(),
      coppeliaFrame: document.getElementById("manualFrame").value,
      theme: document.body.classList.contains("dark-theme") ? "dark" : "light",
      viewMode,
      showPointLabels,
      showLocalFrames,
      compareLocalFrames,
      localFrameScale,
      showGrid,
      showAxes,
      showLegend,
      scale,
      camera: { ...camera },
      visiblePlanes: [...visiblePlanes],
      animationSpeed,
      autoSave: autoSaveEnabled
    }
  });
}

function setSaveIndicator(message) {
  saveStatus.textContent = message;
  document.getElementById("saveIndicator").textContent = message;
  document.getElementById("saveIndicator").classList.toggle("pending", activityDirty);
}

function saveLocalNow() {
  if (restoringActivity || !autoSaveEnabled || !notebook.querySelector(".code-cell")) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  try {
    const current = captureActivity();
    const previous = RoboticaStorage.loadAutosave();
    let historyFailed = false;
    if (previous && activityFingerprint(previous) !== activityFingerprint(current)) {
      try { RoboticaStorage.pushHistory(previous); } catch { historyFailed = true; }
    }
    RoboticaStorage.saveAutosave(current);
    PythonRuntime.persistStorage();
    savedFingerprint = activityFingerprint(current);
    activityDirty = false;
    setSaveIndicator(historyFailed ? "Guardado local · historial lleno" : `Guardado local ${new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`);
  } catch {
    activityDirty = true;
    setSaveIndicator("Sin guardar · descarga una copia");
  }
}

function scheduleAutosave() {
  if (restoringActivity) return;
  clearTimeout(autosaveTimer);
  try {
    const fingerprint = activityFingerprint(captureActivity());
    activityDirty = fingerprint !== savedFingerprint && fingerprint !== exportedFingerprint;
  } catch { activityDirty = true; }
  if (!autoSaveEnabled) { setSaveIndicator(activityDirty ? "Cambios sin guardar" : "Autoguardado pausado"); return; }
  setSaveIndicator("Guardando localmente…");
  autosaveTimer = setTimeout(saveLocalNow, 700);
}

function archiveCurrentActivity() {
  if (!notebook.querySelector(".code-cell")) return true;
  try { RoboticaStorage.pushHistory(captureActivity()); return true; }
  catch { return window.confirm("No se pudo conservar la actividad en el historial. ¿Continuar sin esa copia? Cancela para descargarla primero."); }
}

function updateActivityLabel() {
  const typed = activityNameInput.value.trim();
  const name = typed && typed !== "Actividad sin nombre" ? typed : "actividad_sin_titulo";
  document.getElementById("activityDisplayName").textContent = name;
  document.title = `${name} · SIMPY - CEAR`;
}

function applyActivity(activity, { persist = true, message = "Actividad abierta" } = {}) {
  if (execution.current) return;
  const normalized = RoboticaStorage.normalizeActivity(activity);
  flowMatrixName = null;
  flowPointName = null;
  flowOverlayVisible = false;
  flowProgress = 1;
  showLocalFrames = normalized.settings.showLocalFrames;
  compareLocalFrames = normalized.settings.compareLocalFrames;
  localFrameScale = normalized.settings.localFrameScale;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  restoringActivity = true;
  finishCurrentAnimation();
  lastSelectedCell = null;
  activeCell = null;
  notebook.replaceChildren();
  cellSequence = 0;
  normalized.cells.forEach(cell => createCell(cell.source, false, null, cell));
  activityNameInput.value = normalized.name;
  teacherInstructionsInput.value = normalized.teacherInstructions;
  animationSpeed = normalized.settings.animationSpeed;
  animationSpeedInput.value = animationSpeed;
  autoSaveEnabled = normalized.settings.autoSave;
  autoSaveInput.checked = autoSaveEnabled;
  document.getElementById("legacyMatmul").checked = normalized.settings.legacyMatmul;
  document.getElementById("coppeliaHost").value = normalized.settings.coppeliaHost;
  document.getElementById("coppeliaPort").value = normalized.settings.coppeliaPort;
  document.getElementById("coppeliaClientPath").value = normalized.settings.coppeliaClientPath;
  document.getElementById("manualRobotRoot").value = normalized.settings.coppeliaRobotRoot;
  document.getElementById("manualTargetPath").value = normalized.settings.coppeliaIkTarget;
  document.getElementById("manualFrame").value = normalized.settings.coppeliaFrame;
  document.dispatchEvent(new Event("manual-scene-changed"));
  document.body.classList.toggle("dark-theme", normalized.settings.theme === "dark");
  document.getElementById("themeToggle").textContent = normalized.settings.theme === "dark" ? "☀" : "☾";
  document.getElementById("themeToggle").setAttribute("aria-label", normalized.settings.theme === "dark" ? "Usar tema claro" : "Usar tema oscuro");
  setViewMode(normalized.settings.viewMode);
  showPointLabels = normalized.settings.showPointLabels;
  showGrid = normalized.settings.showGrid;
  showAxes = normalized.settings.showAxes;
  showLegend = normalized.settings.showLegend;
  updatePointLabelControl();
  updateVisualizationControls();
  scale = normalized.settings.scale;
  camera = { ...normalized.settings.camera };
  visiblePlanes.clear();
  normalized.settings.visiblePlanes.forEach(plane => visiblePlanes.add(plane));
  document.querySelectorAll(".plane-controls button").forEach(button => button.classList.toggle("active", visiblePlanes.has(button.dataset.plane)));
  resetNotebook(false);
  updateActivityLabel();
  renderPlot();
  restoringActivity = false;
  if (persist) {
    try { RoboticaStorage.saveAutosave(captureActivity()); PythonRuntime.persistStorage(); }
    catch { activityDirty = true; setSaveIndicator("Sin guardar · descarga una copia"); return; }
  }
  savedFingerprint = activityFingerprint(captureActivity());
  activityDirty = false;
  setSaveIndicator(message);
}

function safeFilename(name, extension) {
  const base = (name || "actividad").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").slice(0, 80) || "actividad";
  return `${base}${extension}`;
}

function downloadText(text, filename, type) {
  downloadBlob(new Blob([text], { type }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function evidenceLines(text, width, limit) {
  const wrapped = [];
  for (const line of text.split("\n")) {
    if (wrapped.length >= limit) break;
    if (!line) { wrapped.push(""); continue; }
    for (let offset = 0; offset < line.length && wrapped.length < limit; offset += width) wrapped.push(line.slice(offset, offset + width));
  }
  if (wrapped.length >= limit) wrapped.push("… Continúa en la actividad .roboticalab");
  return wrapped;
}

function evidenceOutput(cell) {
  const output = cell.querySelector(".cell-output");
  if (!cell.classList.contains("executed")) return output.textContent.trim() || "Ejecuta la celda para generar su salida.";
  const parts = [];
  for (const row of output.querySelectorAll(".output-variable")) {
    parts.push(`${row.querySelector(".output-variable-name").textContent}: ${row.querySelector(".output-variable-value").textContent}`);
  }
  for (const row of output.querySelectorAll(".output-print-row")) parts.push(row.querySelector(".output-print-text").textContent);
  if (!parts.length) parts.push(output.querySelector(".output-visual-count")?.textContent || "Sin salida de consola.");
  return parts.join("\n");
}

async function exportEvidence() {
  const cell = lastSelectedCell && notebook.contains(lastSelectedCell) ? lastSelectedCell : notebook.querySelector(".code-cell");
  if (!cell) return;
  const width = 1200;
  const margin = 36;
  const chartHeight = 480;
  const columnWidth = 550;
  const codeLines = evidenceLines(cell.querySelector(".cell-editor").value || "# Celda vacía", 60, 80);
  const outputLines = evidenceLines(evidenceOutput(cell), 60, 80);
  const textHeight = Math.max(codeLines.length, outputLines.length) * 21 + 68;
  const image = document.createElement("canvas");
  image.width = width;
  image.height = 120 + chartHeight + textHeight + 70;
  const g = image.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, image.width, image.height);
  g.fillStyle = "#193747";
  g.font = "700 29px Segoe UI, sans-serif";
  g.fillText("SIMPY - CEAR · Evidencia", margin, 48);
  g.font = "16px Segoe UI, sans-serif";
  g.fillText(`${activityNameInput.value.trim() || "Actividad sin nombre"} · Celda ${cell.dataset.displayNumber} · Vista ${viewMode.toUpperCase()}`, margin, 78);
  g.fillStyle = "#4b6572";
  g.font = "13px Segoe UI, sans-serif";
  g.fillText("El gráfico muestra todos los dibujos visibles del cuaderno.", margin, 101);
  g.fillStyle = "#eef6f8";
  g.fillRect(margin, 120, width - margin * 2, chartHeight);
  const chartWidth = width - margin * 2;
  const factor = Math.min(chartWidth / canvas.width, chartHeight / canvas.height);
  const drawnWidth = canvas.width * factor;
  const drawnHeight = canvas.height * factor;
  g.drawImage(canvas, margin + (chartWidth - drawnWidth) / 2, 120 + (chartHeight - drawnHeight) / 2, drawnWidth, drawnHeight);
  const textTop = 120 + chartHeight + 24;
  const drawColumn = (x, title, lines) => {
    g.fillStyle = "#f5f9fa";
    g.fillRect(x, textTop, columnWidth, textHeight);
    g.fillStyle = "#087f8c";
    g.font = "700 17px Segoe UI, sans-serif";
    g.fillText(title, x + 14, textTop + 28);
    g.fillStyle = "#193747";
    g.font = "14px Consolas, monospace";
    lines.forEach((line, index) => g.fillText(line, x + 14, textTop + 55 + index * 21));
  };
  drawColumn(margin, "Código Python", codeLines);
  drawColumn(margin + columnWidth + 28, "Salida de la celda", outputLines);
  const blob = await new Promise(resolve => image.toBlob(resolve, "image/png"));
  if (!blob) { setSaveIndicator("No se pudo crear la evidencia"); return; }
  downloadBlob(blob, safeFilename(`${activityNameInput.value.trim() || "Actividad"} - celda ${cell.dataset.displayNumber} - evidencia`, ".png"));
  setSaveIndicator(`Evidencia de celda ${cell.dataset.displayNumber} descargada`);
}

document.getElementById("exportEvidence").addEventListener("click", () => { exportEvidence().catch(showRuntimeError); });

function saveActivityFile() {
  const activity = captureActivity();
  downloadText(JSON.stringify(activity, null, 2), safeFilename(activity.name, ".roboticalab"), "application/json;charset=utf-8");
  if (autoSaveEnabled) saveLocalNow();
  exportedFingerprint = activityFingerprint(activity);
  activityDirty = false;
  setSaveIndicator("Copia descargada");
}

async function exportPythonFile() {
  const source = [...notebook.querySelectorAll(".cell-editor")]
    .map((editor, index) => `# %% Celda ${index + 1}\n${editor.value}`)
    .join("\n\n");
  try {
    const result = PythonRuntime.info ? await PythonRuntime.exportSource(source, document.getElementById("legacyMatmul").checked) : { source };
    downloadText(result.source, safeFilename(activityNameInput.value, ".py"), "text/x-python;charset=utf-8");
    setSaveIndicator("Código exportado");
  } catch (error) { showRuntimeError(error); }
}

function closeRecovery() {
  recoveryBackdrop.hidden = true;
}

function showRecoveryVersions() {
  activityMenu.hidden = true;
  activityMenuTrigger.setAttribute("aria-expanded", "false");
  const history = RoboticaStorage.loadHistory();
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "recovery-empty";
    empty.textContent = "Todavía no hay versiones anteriores para recuperar.";
    recoveryList.replaceChildren(empty);
  } else {
    recoveryList.replaceChildren(...history.map((activity, index) => {
      const entry = document.createElement("article");
      entry.className = "recovery-entry";
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = activity.name;
      const meta = document.createElement("span");
      const date = new Date(activity.savedAt);
      meta.textContent = `${Number.isNaN(date.getTime()) ? "Fecha desconocida" : date.toLocaleString("es-CL")} · ${activity.cells.length} celda${activity.cells.length === 1 ? "" : "s"}`;
      info.append(name, meta);
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = "Recuperar";
      restore.addEventListener("click", () => {
        if (execution.current || !confirmReplaceActivity()) return;
        if (!archiveCurrentActivity()) return;
        applyActivity(activity, { message: `Versión ${index + 1} recuperada` });
        closeRecovery();
      });
      entry.append(info, restore);
      const preview = document.createElement("pre");
      preview.className = "recovery-preview";
      preview.textContent = activity.cells.map(cell => cell.source).filter(Boolean).join("\n").slice(0, 240) || "Cuaderno vacío";
      entry.append(preview);
      return entry;
    }));
  }
  recoveryBackdrop.hidden = false;
}

function recordVariableChanges(before, after) {
  latestVariableChanges = Object.fromEntries(Object.entries(after).map(([name, current]) => [name, {
    previous: cloneValue(before[name]),
    current: cloneValue(current),
    changed: !valuesEqual(before[name], current)
  }]));
}

function variableDescription(value) {
  if (value?.__python__) return { type: value.type, dimensions: "Vista resumida", homogeneous: false };
  if (value === null) return { type: "None", dimensions: "—", homogeneous: false };
  if (typeof value === "number") return { type: "Número", dimensions: "1 valor", homogeneous: false };
  if (Array.isArray(value) && Array.isArray(value[0])) {
    const rows = value.length;
    const columns = value[0]?.length || 0;
    const homogeneous = value.every(row => Array.isArray(row) && row.length === columns && row.every(item => typeof item === "number")) && (rows === 3 || rows === 4) && columns === rows
      && value.at(-1).every((entry, index) => entry === (index === rows - 1 ? 1 : 0));
    return { type: homogeneous ? "Matriz homogénea" : "Matriz", dimensions: `${rows} × ${columns}`, homogeneous };
  }
  if (Array.isArray(value)) return { type: "Vector", dimensions: `${value.length} elementos`, homogeneous: false };
  return { type: typeof value, dimensions: "—", homogeneous: false };
}

function changedElements(previous, current) {
  if (previous === undefined) return "Variable creada en esta ejecución";
  if (valuesEqual(previous, current)) return "Sin cambios en la última ejecución";
  if (typeof previous === "number" && typeof current === "number") return `Δ ${format(current - previous)}`;
  const flatten = value => Array.isArray(value) ? value.flat(Infinity) : [value];
  const before = flatten(previous);
  const after = flatten(current);
  const count = after.reduce((total, value, index) => total + (valuesEqual(value, before[index]) ? 0 : 1), 0);
  return `${count} elemento${count === 1 ? "" : "s"} modificado${count === 1 ? "" : "s"}`;
}

function matrixView(matrix, homogeneous) {
  const table = document.createElement("div");
  table.className = "matrix-view";
  table.style.setProperty("--matrix-columns", matrix[0].length);
  matrix.forEach((row, r) => row.forEach((value, c) => {
    const cell = document.createElement("span");
    cell.textContent = format(value);
    if (homogeneous) {
      if (r === matrix.length - 1) cell.classList.add("homogeneous-cell");
      else if (c === matrix.length - 1) cell.classList.add("translation-cell");
      else cell.classList.add("rotation-cell");
    }
    table.append(cell);
  }));
  return table;
}

function renderVariableInspector(name, variables) {
  const value = variables[name];
  if (value === undefined) {
    variableInspector.classList.add("hidden");
    variableInspector.replaceChildren();
    return;
  }
  const change = latestVariableChanges[name] || { previous: undefined, current: value, changed: false };
  const description = variableDescription(value);
  const header = document.createElement("div");
  header.className = "variable-inspector-heading";
  const title = document.createElement("strong");
  title.textContent = name;
  const badges = document.createElement("span");
  badges.textContent = `${description.type} · ${description.dimensions}`;
  header.append(title, badges);

  const currentBlock = document.createElement("div");
  currentBlock.className = "variable-value-block";
  const currentLabel = document.createElement("small");
  currentLabel.textContent = "VALOR ACTUAL";
  currentBlock.append(currentLabel, description.homogeneous ? matrixView(value, true) : Object.assign(document.createElement("code"), { textContent: displayValue(value) }));
  if (description.homogeneous) {
    const matrixLegend = document.createElement("div");
    matrixLegend.className = "matrix-legend";
    [["rotation-cell", "Rotación"], ["translation-cell", "Traslación"], ["homogeneous-cell", "Fila homogénea"]].forEach(([className, label]) => {
      const item = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.className = className;
      item.append(swatch, document.createTextNode(label));
      matrixLegend.append(item);
    });
    currentBlock.append(matrixLegend);
  }

  const comparison = document.createElement("div");
  comparison.className = "variable-comparison";
  const previous = document.createElement("div");
  previous.innerHTML = "<small>VALOR ANTERIOR</small>";
  const previousValue = document.createElement("code");
  previousValue.textContent = change.previous === undefined ? "—" : displayValue(change.previous);
  previous.append(previousValue);
  const delta = document.createElement("div");
  delta.innerHTML = "<small>ÚLTIMO CAMBIO</small>";
  const deltaValue = document.createElement("code");
  deltaValue.textContent = changedElements(change.previous, value);
  delta.append(deltaValue);
  comparison.append(previous, delta);
  variableInspector.replaceChildren(header, currentBlock, comparison);
  variableInspector.classList.remove("hidden");
}

function updateResults(result) {
  const visible = Object.entries(result.variables);
  if (selectedVariableName && !visible.some(([name]) => name === selectedVariableName)) selectedVariableName = null;
  const cards = visible.map(([name, value]) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.classList.toggle("active", name === selectedVariableName);
    const title = document.createElement("strong");
    title.textContent = name;
    const content = document.createElement("span");
    content.textContent = displayValue(value);
    card.append(title, content);
    card.addEventListener("click", () => {
      selectedVariableName = selectedVariableName === name ? null : name;
      updateResults({ ...result, drawings: latestResult.drawings });
    });
    return card;
  });
  if (!cards.length) {
    const card = document.createElement("div");
    card.className = "result-card";
    const content = document.createElement("span");
    content.textContent = "—";
    card.append(content);
    cards.push(card);
  }
  resultCards.replaceChildren(...cards);
  if (selectedVariableName) renderVariableInspector(selectedVariableName, result.variables);
  else {
    variableInspector.classList.add("hidden");
    variableInspector.replaceChildren();
  }

  const legendMap = new Map();
  result.drawings.filter(item => item.label && ["point", "vector", "trajectory", "frame", "line"].includes(item.type))
    .forEach(item => legendMap.set(drawingKey(item), item));
  const legendItems = [...legendMap.values()];
  legend.replaceChildren(...legendItems.map(item => {
    const key = drawingKey(item);
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "legend-item";
    entry.classList.toggle("hidden-series", hiddenDrawingKeys.has(key));
    entry.setAttribute("aria-pressed", String(!hiddenDrawingKeys.has(key)));
    entry.title = hiddenDrawingKeys.has(key) ? "Mostrar" : "Ocultar";
    const dot = document.createElement("i");
    dot.className = "legend-dot";
    const dotColor = item.color || "#6554c0";
    dot.style.color = dotColor;
    dot.style.background = dotColor;
    entry.append(dot, document.createTextNode(item.label));
    entry.addEventListener("click", () => {
      if (hiddenDrawingKeys.has(key)) hiddenDrawingKeys.delete(key);
      else hiddenDrawingKeys.add(key);
      entry.classList.toggle("hidden-series", hiddenDrawingKeys.has(key));
      entry.setAttribute("aria-pressed", String(!hiddenDrawingKeys.has(key)));
      entry.title = hiddenDrawingKeys.has(key) ? "Mostrar" : "Ocultar";
      renderPlot();
    });
    return entry;
  }));
  renderTransformPanel(result.variables);
}

function renderTransformPanel(variables) {
  const matrixSelect = document.getElementById("transformMatrix");
  const pointSelect = document.getElementById("transformPoint");
  const matrixNames = RoboticaVisualFlow.matrixNames(variables);
  flowMatrixName = matrixNames.includes(flowMatrixName) ? flowMatrixName : matrixNames[0] || null;
  matrixSelect.replaceChildren(...matrixNames.map(name => new Option(`${name} · ${variables[name].length}×${variables[name].length}`, name)));
  if (flowMatrixName) matrixSelect.value = flowMatrixName;
  const pointNames = flowMatrixName ? RoboticaVisualFlow.pointNames(variables, variables[flowMatrixName].length) : [];
  flowPointName = pointNames.includes(flowPointName) ? flowPointName : pointNames[0] || null;
  pointSelect.replaceChildren(...pointNames.map(name => new Option(name, name)));
  if (flowPointName) pointSelect.value = flowPointName;
  const prior = flowAnalysis;
  flowAnalysis = flowMatrixName && flowPointName ? RoboticaVisualFlow.analyze(variables, flowMatrixName, flowPointName) : null;
  if (!flowAnalysis) flowOverlayVisible = false;
  const frames = RoboticaVisualFlow.localFrames(flowAnalysis, localFrameScale);
  if (showLocalFrames && frames) flowOverlayVisible = true;
  const hint = document.getElementById("transformHint");
  hint.textContent = !matrixNames.length ? "Define y ejecuta una matriz homogénea 3×3 o 4×4. Abre Guía para insertar un ejemplo." : !pointNames.length || !flowAnalysis
    ? "Define y ejecuta un punto compatible con la matriz elegida." : `Vista calculada con las variables de la última ejecución; no cambia tus variables ni el robot.${flowAnalysis.dimension === 3 && viewMode === "2d" ? " El gráfico muestra la proyección XY; activa 3D para ver la altura." : ""}`;
  document.getElementById("transformControls").hidden = !matrixNames.length;
  pointSelect.disabled = !pointNames.length;
  const overlayButton = document.getElementById("showTransformOnGraph");
  overlayButton.disabled = !flowAnalysis;
  overlayButton.setAttribute("aria-pressed", String(flowOverlayVisible));
  overlayButton.textContent = flowOverlayVisible ? "Ocultar del gráfico" : "Mostrar en gráfico";
  RoboticaIcons.add(overlayButton, "eye");
  const timeline = document.getElementById("transformTimeline");
  timeline.hidden = !flowAnalysis;
  const frameControls = document.getElementById("localFrameControls");
  frameControls.hidden = !flowAnalysis;
  const frameToggle = document.getElementById("showLocalFrames");
  frameToggle.checked = showLocalFrames;
  frameToggle.disabled = !frames;
  const compareToggle = document.getElementById("compareLocalFrames");
  compareToggle.checked = compareLocalFrames;
  compareToggle.disabled = !frames || !showLocalFrames;
  document.getElementById("localFrameScale").value = String(localFrameScale);
  document.getElementById("localFrameScale").disabled = !frames || !showLocalFrames;
  document.getElementById("frameStateKey").hidden = !showLocalFrames || !compareLocalFrames || !frames;
  document.getElementById("localFrameHint").textContent = frames
    ? "Inicial: ejes del mundo en P. Final: columnas de R en T @ P. Longitud en unidades del gráfico; el deslizador solo mueve el punto de vista previa."
    : "Para dibujar sistemas locales, T debe tener una rotación rígida: RᵀR = I y det(R) = +1.";
  emptyState.classList.toggle("hidden", latestResult.drawings.length > 0 || (flowOverlayVisible && !!flowAnalysis));
  document.getElementById("transformProgress").value = String(Math.round(flowProgress * 100));
  document.getElementById("transformProgressValue").textContent = `${Math.round(flowProgress * 100)} %`;
  const calculation = document.getElementById("transformCalculation");
  calculation.replaceChildren();
  if (flowAnalysis) {
    const equation = document.createElement("div");
    equation.className = "transform-equation";
    const matrixBlock = document.createElement("div");
    matrixBlock.append(Object.assign(document.createElement("strong"), { textContent: flowMatrixName }), matrixView(flowAnalysis.matrix, true));
    const inputBlock = document.createElement("div");
    inputBlock.append(Object.assign(document.createElement("strong"), { textContent: flowPointName }), Object.assign(document.createElement("code"), { textContent: `[${flowAnalysis.input.map(format).join(", ")}]` }));
    const outputBlock = document.createElement("div");
    outputBlock.append(Object.assign(document.createElement("strong"), { textContent: `${flowMatrixName} @ ${flowPointName}` }), Object.assign(document.createElement("code"), { textContent: `[${flowAnalysis.output.map(format).join(", ")}]` }));
    equation.append(matrixBlock, Object.assign(document.createElement("span"), { textContent: "×" }), inputBlock, Object.assign(document.createElement("span"), { textContent: "=" }), outputBlock);
    const rows = document.createElement("ol");
    rows.className = "transform-rows";
    flowAnalysis.rows.slice(0, -1).forEach(row => {
      const item = document.createElement("li");
      item.textContent = `${row.coordinate}′ = ${row.terms.map(term => `${format(term.coefficient)}·${format(term.value)}`).join(" + ")} = ${format(row.total)}`;
      rows.append(item);
    });
    calculation.append(equation, rows);
  }
  if (prior !== flowAnalysis || !flowAnalysis) renderPlot();
}

function renderDiagnostic(output, problem) {
  const cell = output.closest(".code-cell");
  if (cell) RoboticaWorkspace.reportDiagnostic(cell, problem);
  const simple = document.createElement("div");
  simple.className = "diagnostic-simple";
  simple.textContent = problem.simpleMessage || problem.message;
  const hint = document.createElement("div");
  hint.className = "diagnostic-hint";
  hint.textContent = problem.hint || "Revisa la instrucción indicada e inténtalo nuevamente.";
  const details = document.createElement("details");
  details.className = "diagnostic-details";
  const summary = document.createElement("summary");
  summary.textContent = "Detalles técnicos";
  const technical = document.createElement("pre");
  technical.textContent = [
    `Código: ${problem.code}`,
    `Etapa: ${problem.phase}`,
    `Ubicación: línea ${problem.line}, columna ${problem.column}`,
    problem.technicalDetails || problem.message
  ].join("\n");
  details.append(summary, technical);
  output.replaceChildren(simple, hint, details);
}

function focusDiagnostic(problem, editor) {
  RoboticaWorkspace.setExpanded(false);
  setCellCollapsed(editor.closest(".code-cell"), false);
  const lines = editor.value.split("\n");
  const offset = lines.slice(0, Math.max(0, problem.line - 1)).reduce((total, line) => total + line.length + 1, 0);
  const start = Math.min(editor.value.length, offset + Math.max(0, problem.column - 1));
  const end = Math.min(editor.value.length, offset + (lines[problem.line - 1]?.length || 0));
  editor.focus();
  editor.setSelectionRange(start, Math.max(start + 1, end));
  editor.scrollTop = Math.max(0, (problem.line - 2) * parseFloat(getComputedStyle(editor).lineHeight));
  updateLineNumbers(editor);
}

function rebuildVisualization(logs = []) {
  const drawings = [...notebook.querySelectorAll(".code-cell")].flatMap(cell => cell._drawings || []);
  latestResult = { variables: { ...notebookSession.variables }, drawings, logs };
  renderPlot();
  updateResults(latestResult);
  emptyState.classList.toggle("hidden", drawings.length > 0 || (flowOverlayVisible && !!flowAnalysis));
}

function printLines(logs) {
  return logs.at(-1) === "" ? logs.slice(0, -1) : logs;
}

function appendPrintRows(container, logs) {
  printLines(logs).forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "output-print-row";
    const number = document.createElement("span");
    number.className = "output-print-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const value = document.createElement("span");
    value.className = "output-print-text";
    value.textContent = line || "\u00a0";
    row.append(number, value);
    container.append(row);
  });
}

function appendOutputSection(container, title) {
  const section = document.createElement("section");
  section.className = "output-section";
  const heading = document.createElement("h4");
  heading.className = "output-section-title";
  heading.textContent = title;
  section.append(heading);
  container.append(section);
  return section;
}

function renderCellResult(output, result, before) {
  const changed = Object.entries(result.variables).filter(([name, value]) => JSON.stringify(before[name]) !== JSON.stringify(value));
  const summary = document.createElement("div");
  summary.className = "output-summary";
  summary.textContent = "✓ Celda ejecutada";
  output.replaceChildren(summary);
  if (changed.length) {
    const section = appendOutputSection(output, "Variables modificadas");
    for (const [name, value] of changed) {
      const kind = Array.isArray(value)
        ? (Array.isArray(value[0]) ? `matriz ${value.length}×${value[0].length}` : `vector · ${value.length} valores`)
        : typeof value === "number" ? "número" : typeof value;
      const row = document.createElement("div");
      row.className = "output-variable";
      const label = document.createElement("span");
      label.className = "output-variable-name";
      label.textContent = `${name} · ${kind}`;
      const content = document.createElement("span");
      content.className = "output-variable-value";
      content.textContent = displayValue(value);
      row.append(label, content);
      section.append(row);
    }
  }
  if (printLines(result.logs).length) appendPrintRows(appendOutputSection(output, "Salida de print()"), result.logs);
  if (result.drawings.length) {
    const visual = document.createElement("div");
    visual.className = "output-visual-count";
    visual.textContent = `Visualización · ${result.drawings.length} elemento(s)`;
    output.append(visual);
  }
  if (!changed.length && !printLines(result.logs).length && !result.drawings.length) {
    const empty = document.createElement("div");
    empty.className = "output-visual-count";
    empty.textContent = "Sin salida.";
    output.append(empty);
  }
}

function markFollowingCellsStale(cell) {
  let following = cell.nextElementSibling;
  while (following) {
    if (following.classList.contains("executed")) markCellStale(following);
    following = following.nextElementSibling;
  }
}

function setCellStatus(cell, message) {
  const status = cell.querySelector(".cell-status");
  if (!status) return;
  if (status.textContent !== message) status.textContent = message;
  status.setAttribute("aria-label", `Celda ${cell.dataset.displayNumber || cell.dataset.cellNumber}: ${message}`);
}

function markCellStale(cell) {
  cell.classList.add("stale");
  setCellStatus(cell, "Resultado desactualizado");
}

function recordCellExecution(cell) {
  executionCounter += 1;
  cell.classList.add("executed");
  cell.classList.remove("error", "stale", "stepping");
  cell.querySelector(".execution-count").textContent = `[${executionCounter}]`;
  setCellStatus(cell, "Terminada");
}

function clearStepHighlight(cell) {
  delete cell.dataset.activeLine;
  cell.classList.remove("stepping");
  updateLineNumbers(cell.querySelector(".cell-editor"));
}

let tracedCell = null;
function clearExecutionPointer() {
  if (!tracedCell) return;
  tracedCell.classList.remove("trace-active");
  tracedCell.querySelector(".execution-pointer").hidden = true;
  tracedCell.querySelector(".cell-execution-location").hidden = true;
  delete tracedCell.dataset.executingLine;
  tracedCell = null;
}

function positionExecutionPointer(cell) {
  const editor = cell.querySelector(".cell-editor");
  const pointer = cell.querySelector(".execution-pointer");
  const line = Number(cell.dataset.executingLine);
  if (!line || cell.classList.contains("is-collapsed")) { pointer.hidden = true; return; }
  const computed = getComputedStyle(editor);
  const lineHeight = parseFloat(computed.lineHeight);
  const padding = parseFloat(computed.paddingTop);
  let y = padding + (line - 1) * lineHeight - editor.scrollTop;
  if (y < padding || y > editor.clientHeight - lineHeight) {
    editor.scrollTop = Math.max(0, (line - 2) * lineHeight);
    y = padding + (line - 1) * lineHeight - editor.scrollTop;
  }
  pointer.style.top = `${Math.max(0, y)}px`;
  pointer.hidden = false;
}

function showExecutionPointer(cell, line) {
  if (tracedCell !== cell) clearExecutionPointer();
  tracedCell = cell;
  cell.dataset.executingLine = String(line);
  cell.classList.add("trace-active");
  const location = cell.querySelector(".cell-execution-location");
  location.textContent = `Línea ${line}`;
  location.hidden = false;
  positionExecutionPointer(cell);
}

function highlightStep(cell, node) {
  setCellCollapsed(cell, false);
  const editor = cell.querySelector(".cell-editor");
  cell.dataset.activeLine = String(node.line);
  cell.classList.add("stepping");
  updateLineNumbers(editor);
  const lines = editor.value.split("\n");
  const start = lines.slice(0, node.line - 1).reduce((total, line) => total + line.length + 1, 0);
  const end = lines.slice(0, node.endLine).reduce((total, line) => total + line.length + 1, 0) - 1;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(start, Math.max(start + 1, end));
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
  editor.scrollTop = Math.max(0, (node.line - 2) * lineHeight);
  editor.closest(".cell-code-wrap").querySelector(".line-numbers").scrollTop = editor.scrollTop;
}

function setCellOutputExpanded(cell, expanded) {
  const region = cell.querySelector(".cell-output-region");
  const toggle = cell.querySelector(".cell-output-toggle");
  if (!region || !toggle) return;
  region.classList.toggle("collapsed", !expanded);
  toggle.textContent = expanded ? "▾ Ocultar salida" : "▸ Mostrar salida";
  toggle.setAttribute("aria-expanded", String(expanded));
}

function showCellOutput(cell) {
  const region = cell.querySelector(".cell-output-region");
  if (!region) return;
  region.classList.remove("hidden");
}

function cancelStepMode(cell) {
  if (!cell) return;
  cell._stepState = null;
  const stepButton = cell.querySelector(".cell-step");
  if (stepButton) { stepButton.textContent = "Paso a paso"; RoboticaIcons.add(stepButton, "step"); }
  clearStepHighlight(cell);
  if (activeStepCell === cell) activeStepCell = null;
}

function stepOutputLines(state, node, result, before) {
  const changed = Object.entries(result.variables).filter(([name, value]) => !valuesEqual(before[name], value));
  const lines = [`Paso ${state.index + 1} de ${state.program.length} · Línea ${node.line}`, `› ${node.source.replace(/\s+/g, " ")}`];
  if (changed.length) {
    lines.push("", "VARIABLES MODIFICADAS");
    changed.forEach(([name, value]) => {
      lines.push(`${name}: ${before[name] === undefined ? "—" : displayValue(before[name])}  →  ${displayValue(value)}`);
    });
  } else lines.push("", "Sin cambios en las variables.");
  if (result.logs.length) lines.push("", "CONSOLA", ...result.logs.map(line => `› ${line}`));
  return lines;
}

function advanceCellStep(cell) {
  if (execution.current) return;
  runCells([cell], false, "step");
}

function syncPythonVariables(variables) {
  const before = notebookSession.variables;
  notebookSession.variables = variables || {};
  recordVariableChanges(before, notebookSession.variables);
}

async function executeCell(cell, run) {
  if (activeStepCell) cancelStepMode(activeStepCell);
  RoboticaWorkspace.clearDiagnostic(cell);
  const editor = cell.querySelector(".cell-editor");
  const output = cell.querySelector(".cell-output");
  const before = cloneValue(notebookSession.variables);
  const drawings = [];
  cell._drawings = [];
  cell._logs = [];
  let stream = "";
  let failed = false;
  let runtimeRestarted = false;
  activePythonCell = cell;
  clearExecutionPointer();
  showCellOutput(cell);
  cell.classList.remove("executed", "error", "stale");
  cell.querySelector(".execution-count").textContent = "";
  cell.classList.add("running");
  setCellStatus(cell, "Ejecutando");
  output.className = "cell-output muted";
  output.textContent = "Ejecutando en Python…";
  try {
    const done = await PythonRuntime.run(editor.value, cell.dataset.cellNumber, {
      mode: run.mode, legacyMatmul: document.getElementById("legacyMatmul").checked,
      extraPath: document.getElementById("coppeliaClientPath").value.trim(),
      coppeliaHost: document.getElementById("coppeliaHost").value.trim(),
      coppeliaPort: Number(document.getElementById("coppeliaPort").value)
    }, event => {
      if (event.type === "output") {
        stream += event.text;
        cell._logs = stream.split("\n");
        output.textContent = stream;
        updateNotebookOutput();
      } else if (event.type === "drawing") {
        drawings.push(event.drawing);
      } else if (event.type === "line" && run.mode !== "step") {
        const origin = [...notebook.querySelectorAll(".code-cell")].find(item => item.dataset.cellNumber === event.cellId) || cell;
        showExecutionPointer(origin, event.line);
      } else if (event.type === "paused") {
        run.paused = true;
        updateExecutionControls(run);
        syncPythonVariables(event.variables);
        cell._drawings = drawings.slice();
        rebuildVisualization(cell._logs);
        const origin = [...notebook.querySelectorAll(".code-cell")].find(item => item.dataset.cellNumber === event.cellId) || cell;
        if (activeStepCell && activeStepCell !== origin) clearStepHighlight(activeStepCell);
        activeStepCell = origin;
        highlightStep(origin, { line: event.line, endLine: event.line });
        document.getElementById("pythonStepLocation").textContent = `Celda ${origin.dataset.displayNumber} · línea ${event.line} · ${event.scope}`;
      } else if (event.type === "input") {
        document.getElementById("pythonInputPrompt").textContent = event.prompt || "Introduce un valor:";
        document.getElementById("pythonInputValue").value = "";
        document.getElementById("pythonInputDialog").showModal();
        document.getElementById("pythonInputValue").focus();
      } else if (event.type === "diagnostic") {
        failed = true;
        const origin = [...notebook.querySelectorAll(".code-cell")].find(item => item.dataset.cellNumber === event.problem.cellId) || cell;
        renderDiagnostic(output, event.problem);
        if (origin !== cell) RoboticaWorkspace.reportDiagnostic(origin, event.problem);
        output.className = "cell-output error";
        cell.classList.add("error");
        setCellStatus(cell, "Error");
        focusDiagnostic(event.problem, origin.querySelector(".cell-editor"));
      }
    });
    runtimeRestarted = done.status === "restarted";
    syncPythonVariables(done.variables);
    if (done.status !== "ok") {
      if (done.status === "interrupted" || runtimeRestarted) run.cancelled = true;
      cell._drawings = drawings;
      rebuildVisualization(cell._logs);
      return false;
    }
    if (!await execution.checkpoint(run)) return false;
    if (activeStepCell) { clearStepHighlight(activeStepCell); activeStepCell = null; }
    markFollowingCellsStale(cell);
    recordVariableChanges(before, notebookSession.variables);
    const result = { variables: { ...notebookSession.variables }, drawings, logs: cell._logs };
    renderCellResult(output, result, before);
    output.className = "cell-output success";
    cell._drawings = [];
    rebuildVisualization(cell._logs);
    if (run.mode === "step") { cell._drawings = drawings; refreshDrawingLayer(); }
    else await animateCellDrawings(cell, drawings);
    if (!await execution.checkpoint(run)) return false;
    recordCellExecution(cell);
    updateNotebookOutput();
    return true;
  } catch (error) {
    failed = true;
    const problem = { code: "PythonRuntime", phase: "Conexión", line: 1, column: 1, message: error.message };
    renderDiagnostic(output, problem);
    output.className = "cell-output error";
    cell.classList.add("error");
    setCellStatus(cell, "Error");
    return false;
  } finally {
    clearExecutionPointer();
    activePythonCell = null;
    cell.classList.remove("running");
    document.getElementById("pythonInputDialog").close();
    if (activeStepCell) { clearStepHighlight(activeStepCell); activeStepCell = null; }
    clearStepHighlight(cell);
    if (run.cancelled) {
      cell.classList.remove("executed");
      cell.classList.add("stale");
      cell.querySelector(".execution-count").textContent = "";
      setCellStatus(cell, "Interrumpida");
      output.textContent = runtimeRestarted ? "Python fue reiniciado porque no respondió a la interrupción. Se limpiaron todas las variables. CoppeliaSim no se detuvo automáticamente." : "Ejecución detenida. Se conservan los cálculos realizados. CoppeliaSim no se detiene automáticamente.";
      output.className = "cell-output muted";
      if (runtimeRestarted) {
        notebookSession.variables = {};
        notebook.querySelectorAll(".code-cell").forEach(item => { item._drawings = []; if (item.classList.contains("executed")) markCellStale(item); });
      }
      showCellOutput(cell);
    }
    if (run.cancelled || failed) { markFollowingCellsStale(cell); rebuildVisualization(cell._logs); }
  }
}

function updateNotebookOutput() {
  consoleOutput.classList.remove("error");
  consoleOutput.replaceChildren();
  for (const cell of notebook.querySelectorAll(".code-cell")) {
    if (!printLines(cell._logs || []).length) continue;
    const group = document.createElement("section");
    group.className = "console-cell";
    const title = document.createElement("div");
    title.className = "console-cell-title";
    title.textContent = `Celda ${cell.dataset.displayNumber}`;
    group.append(title);
    appendPrintRows(group, cell._logs);
    consoleOutput.append(group);
  }
  if (!consoleOutput.childElementCount) consoleOutput.textContent = "Sin salida de print().";
}

async function runCells(cells, reset = false, mode = "run") {
  if (execution.current || pythonResetting || !PythonRuntime.available) return false;
  if (reset) resetNotebook(false);
  if (!await kernelResetPending) return false;
  const run = execution.start();
  if (!run) return false;
  run.mode = mode;
  let ok = true;
  try {
    for (const cell of cells) {
      if (!await execution.checkpoint(run)) { ok = false; break; }
      if (!cell.querySelector(".cell-enabled").checked) continue;
      if (!cell.querySelector(".cell-editor").value.trim()) continue;
      if (!await executeCell(cell, run)) { ok = false; break; }
    }
    updateNotebookOutput();
    return ok && !run.cancelled;
  } finally {
    clearExecutionPointer();
    execution.finish(run);
  }
}

function stopExecution() {
  execution.stop();
  PythonRuntime.control("interrupt").catch(showRuntimeError);
  document.getElementById("pythonInputDialog").close();
  if (currentAnimation) {
    cancelAnimationFrame(currentAnimation.frame);
    const resolve = currentAnimation.resolve;
    currentAnimation = null;
    resolve();
  }
}

function resetNotebook(showMessage = true) {
  if (execution.current || pythonResetting) return;
  RoboticaWorkspace.clearDiagnostic();
  finishCurrentAnimation();
  notebookSession = { variables: {} };
  flowMatrixName = null;
  flowPointName = null;
  flowOverlayVisible = false;
  flowProgress = 1;
  if (PythonRuntime.info) {
    pythonResetting = true;
    updateExecutionControls(null);
    kernelResetPending = PythonRuntime.reset().then(() => true, error => { showRuntimeError(error); return false; }).finally(() => { pythonResetting = false; updateExecutionControls(execution.current); });
  }
  executionCounter = 0;
  activeStepCell = null;
  latestVariableChanges = {};
  selectedVariableName = null;
  hiddenDrawingKeys.clear();
  linkedSourceCell?.classList.remove("linked-source");
  linkedSourceCell = null;
  document.getElementById("sourceLinkStatus").textContent = "";
  notebook.querySelectorAll(".code-cell").forEach(cell => {
    cell._drawings = [];
    cell._logs = [];
    cell._stepState = null;
    delete cell.dataset.activeLine;
    cell.classList.remove("executed", "error", "stale", "stepping");
    cell.querySelector(".execution-count").textContent = "";
    setCellStatus(cell, cell.querySelector(".cell-enabled").checked ? "Sin ejecutar" : "Desactivada");
    cell.querySelector(".cell-step").textContent = "Paso a paso";
    RoboticaIcons.add(cell.querySelector(".cell-step"), "step");
    updateLineNumbers(cell.querySelector(".cell-editor"));
    const output = cell.querySelector(".cell-output");
    output.textContent = "";
    output.className = "cell-output";
    cell.querySelector(".cell-output-region").className = "cell-output-region hidden";
    setCellOutputExpanded(cell, false);
  });
  rebuildVisualization();
  consoleOutput.classList.remove("error");
  if (showMessage) consoleOutput.textContent = "Cuaderno reiniciado. Ejecuta una celda para comenzar.";
}

function nextCodeCell(cell) {
  let next = cell.nextElementSibling;
  while (next && !next.classList.contains("code-cell")) next = next.nextElementSibling;
  return next;
}

function moveCell(cell, direction) {
  if (execution.current || pythonResetting) return;
  const cells = [...notebook.querySelectorAll(".code-cell")];
  const other = cells[cells.indexOf(cell) + direction];
  if (!other) return;
  if (direction < 0) notebook.insertBefore(cell, other);
  else notebook.insertBefore(other, cell);
  refreshCellInsertControls();
  resetNotebook(false);
  selectActiveCell(cell);
  cell.scrollIntoView({ block: "nearest" });
  scheduleAutosave();
}

function setCellCollapsed(cell, collapsed, save = false) {
  if (!cell) return;
  const wasCollapsed = cell.classList.contains("is-collapsed");
  cell.classList.toggle("is-collapsed", collapsed);
  const button = cell.querySelector(".cell-fold");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", `${collapsed ? "Abrir" : "Cerrar"} celda ${cell.dataset.displayNumber || ""}`.trim());
  button.title = collapsed ? "Mostrar código y salida" : "Ocultar código y salida";
  if (wasCollapsed && !collapsed) updateLineNumbers(cell.querySelector(".cell-editor"));
  if (tracedCell === cell) positionExecutionPointer(cell);
  if (save) scheduleAutosave();
}

let activeCell = null;
function selectActiveCell(cell) {
  if (activeCell && activeCell !== cell) activeCell.classList.remove("active");
  activeCell = cell;
  if (cell) {
    cell.classList.add("active");
    lastSelectedCell = cell;
  }
}
document.addEventListener("pointerdown", event => {
  if (!event.target.closest(".code-cell")) selectActiveCell(null);
});
document.addEventListener("focusin", event => {
  const cell = event.target.closest?.(".code-cell");
  if (cell) selectActiveCell(cell);
  else if (!event.target.closest?.(".cell-insert-row")) selectActiveCell(null);
});

function refreshCellInsertControls() {
  notebook.querySelectorAll(".cell-insert-row").forEach(row => row.remove());
  const cells = [...notebook.querySelectorAll(".code-cell")];
  cells.forEach((cell, index) => {
    cell.dataset.displayNumber = String(index + 1);
    cell.querySelector(".cell-title").placeholder = `Celda ${index + 1} · nombre opcional`;
    cell.querySelector(".cell-title").setAttribute("aria-label", `Nombre de la celda ${index + 1}`);
    setCellCollapsed(cell, cell.classList.contains("is-collapsed"));
    cell.querySelector(".cell-enabled").setAttribute("aria-label", `Activar celda ${index + 1} para ejecución`);
    cell.querySelector(".cell-move-up").disabled = !index || Boolean(execution.current) || pythonResetting;
    cell.querySelector(".cell-move-down").disabled = index === cells.length - 1 || Boolean(execution.current) || pythonResetting;
    cell.querySelector(".cell-editor").setAttribute("aria-label", `Código de la celda ${index + 1}`);
    setCellStatus(cell, cell.querySelector(".cell-status").textContent);
    if (!index) return;
    const row = document.createElement("div");
    row.className = "cell-insert-row";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Insertar celda entre la ${index} y la ${index + 1}`);
    button.title = "Insertar celda aquí";
    RoboticaIcons.add(button, "plus");
    button.disabled = Boolean(execution.current) || pythonResetting;
    button.addEventListener("click", () => createCell("", true, cell));
    row.append(button);
    notebook.insertBefore(row, cell);
  });
}

function createCell(source = "", focus = false, beforeCell = null, options = {}) {
  if (notebook.querySelectorAll(".code-cell").length >= 100) {
    setSaveIndicator("Máximo de 100 celdas");
    return [...notebook.querySelectorAll(".code-cell")].at(-1);
  }
  const cell = document.createElement("article");
  cell.className = "code-cell";
  cell.dataset.cellNumber = String(++cellSequence);
  cell._drawings = [];

  const heading = document.createElement("div");
  heading.className = "cell-heading";
  const fold = document.createElement("button");
  fold.type = "button";
  fold.className = "cell-fold";
  fold.setAttribute("aria-controls", `cell-code-${cell.dataset.cellNumber} cell-output-region-${cell.dataset.cellNumber}`);
  RoboticaIcons.add(fold, "chevron");
  const title = document.createElement("input");
  title.type = "text";
  title.className = "cell-title";
  title.maxLength = 80;
  title.value = options.title || "";
  title.setAttribute("aria-label", "Nombre de la celda");

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "cell-enabled-label";
  enabledLabel.title = "Incluir esta celda al ejecutar el cuaderno";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "cell-enabled";
  enabled.checked = options.enabled !== false;
  const enabledText = document.createElement("span");
  enabledText.className = "cell-enabled-text";
  enabledText.textContent = "Activa";
  const enabledTrack = document.createElement("span");
  enabledTrack.className = "cell-enabled-track";
  enabledTrack.setAttribute("aria-hidden", "true");
  enabledLabel.append(enabled, enabledText, enabledTrack);
  const moveControls = document.createElement("div");
  moveControls.className = "cell-move-controls";
  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "cell-move cell-move-up";
  moveUp.textContent = "↑";
  moveUp.title = "Subir celda";
  moveUp.setAttribute("aria-label", "Subir celda");
  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "cell-move cell-move-down";
  moveDown.textContent = "↓";
  moveDown.title = "Bajar celda";
  moveDown.setAttribute("aria-label", "Bajar celda");
  moveControls.append(moveUp, moveDown);

  const meta = document.createElement("div");
  meta.className = "cell-meta";
  const executionCount = document.createElement("span");
  executionCount.className = "execution-count";
  const cellStatus = document.createElement("span");
  cellStatus.className = "cell-status";
  cellStatus.setAttribute("role", "status");
  cellStatus.setAttribute("aria-live", "polite");
  cellStatus.setAttribute("aria-atomic", "true");
  cellStatus.textContent = "Sin ejecutar";
  meta.append(executionCount, cellStatus);
  const executionLocation = document.createElement("span");
  executionLocation.className = "cell-execution-location";
  executionLocation.hidden = true;
  heading.append(fold, title, moveControls, executionLocation, meta, enabledLabel);
  const actions = document.createElement("div");
  actions.className = "cell-actions";
  const run = document.createElement("button");
  run.type = "button";
  run.className = "cell-run";
  run.textContent = "Ejecutar";
  const step = document.createElement("button");
  step.type = "button";
  step.className = "cell-step";
  step.textContent = "Paso a paso";
  RoboticaIcons.add(run, "play");
  RoboticaIcons.add(step, "step");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "cell-remove";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "Eliminar celda");
  actions.append(run, step, remove);

  const codeWrap = document.createElement("div");
  codeWrap.className = "cell-code-wrap";
  codeWrap.id = `cell-code-${cell.dataset.cellNumber}`;
  const lineNumbers = document.createElement("pre");
  lineNumbers.className = "line-numbers";
  lineNumbers.setAttribute("aria-hidden", "true");
  const executionPointer = document.createElement("span");
  executionPointer.className = "execution-pointer";
  executionPointer.textContent = "➤";
  executionPointer.setAttribute("aria-hidden", "true");
  executionPointer.hidden = true;
  const editor = document.createElement("textarea");
  editor.className = "cell-editor";
  editor.spellcheck = false;
  editor.setAttribute("aria-label", `Código de la celda ${cell.dataset.cellNumber}`);
  editor.placeholder = "# Código...";
  editor.value = source;
  codeWrap.append(lineNumbers, editor, actions, executionPointer);
  const outputRegion = document.createElement("div");
  outputRegion.className = "cell-output-region hidden collapsed";
  outputRegion.id = `cell-output-region-${cell.dataset.cellNumber}`;
  const outputToggle = document.createElement("button");
  outputToggle.type = "button";
  outputToggle.className = "cell-output-toggle";
  outputToggle.textContent = "▸ Mostrar salida";
  outputToggle.setAttribute("aria-expanded", "false");
  const output = document.createElement("div");
  output.id = `cell-output-${cell.dataset.cellNumber}`;
  output.className = "cell-output";
  outputToggle.setAttribute("aria-controls", output.id);
  outputRegion.append(outputToggle, output);
  cell.append(heading, codeWrap, outputRegion);
  notebook.insertBefore(cell, beforeCell);
  RoboticaEditor.attach(editor);
  updateLineNumbers(editor);
  refreshCellInsertControls();
  setCellCollapsed(cell, options.collapsed === true);
  cell.classList.toggle("is-disabled", !enabled.checked);
  if (!enabled.checked) setCellStatus(cell, "Desactivada");
  cell.addEventListener("pointerdown", () => selectActiveCell(cell));

  fold.addEventListener("click", () => setCellCollapsed(cell, !cell.classList.contains("is-collapsed"), true));
  title.addEventListener("input", scheduleAutosave);
  enabled.addEventListener("change", () => {
    cell.classList.toggle("is-disabled", !enabled.checked);
    resetNotebook(false);
    updateExecutionControls(execution.current);
    scheduleAutosave();
  });
  moveUp.addEventListener("click", () => moveCell(cell, -1));
  moveDown.addEventListener("click", () => moveCell(cell, 1));

  run.addEventListener("click", () => runCells([cell]));
  step.addEventListener("click", () => advanceCellStep(cell));
  outputToggle.addEventListener("click", () => {
    setCellOutputExpanded(cell, outputRegion.classList.contains("collapsed"));
  });
  remove.addEventListener("click", () => {
    if (execution.current) return;
    const cells = [...notebook.querySelectorAll(".code-cell")];
    if (cells.length === 1) {
      editor.value = "";
      title.value = "";
      enabled.checked = true;
      cell.classList.remove("is-disabled");
      setCellCollapsed(cell, false);
      updateLineNumbers(editor);
      editor.focus();
    } else {
      const index = cells.indexOf(cell);
      cell.remove();
      const next = cells[index + 1] || cells[index - 1];
      selectActiveCell(next);
      next.querySelector(".cell-editor").focus({ preventScroll: true });
    }
    refreshCellInsertControls();
    resetNotebook(false);
    scheduleAutosave();
  });
  editor.addEventListener("input", () => {
    RoboticaWorkspace.clearDiagnostic(cell);
    if (cell._stepState) cancelStepMode(cell);
    updateLineNumbers(editor);
    if (cell.classList.contains("executed")) {
      markCellStale(cell);
    }
    markFollowingCellsStale(cell);
    scheduleAutosave();
    flowOverlayVisible = false;
    renderTransformPanel(notebookSession.variables);
  });
  editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; if (tracedCell === cell) positionExecutionPointer(cell); });
  editor.addEventListener("keydown", async event => {
    if ((event.ctrlKey || event.metaKey || event.shiftKey) && event.key === "Enter") {
      event.preventDefault();
      if (execution.current) return;
      const ok = await runCells([cell]);
      if (ok && event.shiftKey) {
        let next = nextCodeCell(cell);
        if (!next) next = createCell("", false);
        next.scrollIntoView({ block: "start" });
        next.querySelector(".cell-editor").focus({ preventScroll: true });
      }
    }
  });
  if (focus) {
    cell.scrollIntoView({ block: "start" });
    selectActiveCell(cell);
    editor.focus({ preventScroll: true });
  }
  updateExecutionControls(execution.current);
  scheduleAutosave();
  return cell;
}

async function executeAll() {
  return runCells([...notebook.querySelectorAll(".code-cell")], true);
}

function setViewMode(mode) {
  document.body.classList.remove("view-coppelia", "coppelia-code-only", "coppelia-panel-only");
  document.getElementById("showCoppeliaCode").setAttribute("aria-pressed", "false");
  document.getElementById("showCoppeliaPanel").setAttribute("aria-pressed", "false");
  document.getElementById("leaveCoppelia").setAttribute("aria-pressed", "true");
  RoboticaWorkspace.setExpanded(false);
  document.getElementById("manualPanel").hidden = true;
  document.getElementById("modeCoppelia").classList.remove("active");
  viewMode = mode;
  document.body.classList.toggle("view-3d", mode === "3d");
  document.getElementById("mode2d").classList.toggle("active", mode === "2d");
  document.getElementById("mode3d").classList.toggle("active", mode === "3d");
  document.getElementById("viewTitle").textContent = mode === "3d" ? "Espacio cartesiano" : "Plano cartesiano";
  scale = 48;
  camera = { yaw: -0.65, pitch: 0.48, panX: 0, panY: 0 };
  document.querySelectorAll(".view-3d-control").forEach(button => button.classList.toggle("active", button.id === "viewIso"));
  hoveredCoordinate = null;
  lockedCoordinate = null;
  showCoordinateInspector(null);
  renderPlot();
  renderTransformPanel(latestResult.variables);
  scheduleAutosave();
}

function updatePointLabelControl() {
  const button = document.getElementById("togglePointLabels");
  button.setAttribute("aria-pressed", String(showPointLabels));
  button.title = showPointLabels ? "Ocultar etiquetas de puntos" : "Mostrar etiquetas de puntos";
  button.classList.toggle("active", showPointLabels);
  document.getElementById("showLabels").checked = showPointLabels;
}

function updateVisualizationControls() {
  document.getElementById("showGrid").checked = showGrid;
  document.getElementById("showAxes").checked = showAxes;
  document.getElementById("showLegend").checked = showLegend;
  legend.hidden = !showLegend;
}

function coordinatesFromDrawing(item) {
  if (!isDrawingVisible(item)) return [];
  if (item.type === "point" || item.type === "vector") return [{ label: item.label || item.type, point: item.point }];
  if (item.type === "line") return [
    { label: item.label ? `${item.label} · A` : "A", point: item.from },
    { label: item.label ? `${item.label} · B` : "B", point: item.to }
  ];
  if (item.type === "trajectory") return item.points.map((point, index) => ({ label: `${item.label || "Trayectoria"} · ${index + 1}`, point }));
  if (item.type === "frame") {
    const m = item.matrix;
    const column = m.length === 4 ? 3 : 2;
    return [{ label: item.label || "Frame", point: m.length === 4 ? [m[0][column], m[1][column], m[2][column]] : [m[0][column], m[1][column]] }];
  }
  return [];
}

function allInspectableCoordinates() {
  return [...notebook.querySelectorAll(".code-cell")].flatMap(cell =>
    (cell._drawings || []).flatMap(item => coordinatesFromDrawing(item).map(info => ({ ...info, cell }))));
}

function findTrajectoryAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let closest = null;
  let distance = 10;
  for (const cell of notebook.querySelectorAll(".code-cell")) {
    for (const item of cell._drawings || []) {
      if (item.type !== "trajectory" || !isDrawingVisible(item)) continue;
      for (let i = 1; i < item.points.length; i += 1) {
        const [ax, ay] = screenPoint(item.points[i - 1]);
        const [bx, by] = screenPoint(item.points[i]);
        const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
        const progress = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSquared)) : 0;
        const current = Math.hypot(x - ax - progress * (bx - ax), y - ay - progress * (by - ay));
        if (current < distance) { distance = current; closest = { cell, label: item.label || "Trayectoria" }; }
      }
    }
  }
  return closest;
}

function linkDrawingToCell(hit) {
  linkedSourceCell?.classList.remove("linked-source");
  linkedSourceCell = hit?.cell || null;
  const status = document.getElementById("sourceLinkStatus");
  if (!linkedSourceCell) { status.textContent = ""; return; }
  selectActiveCell(linkedSourceCell);
  setCellCollapsed(linkedSourceCell, false);
  linkedSourceCell.classList.add("linked-source");
  linkedSourceCell.scrollIntoView({ block: "nearest", behavior: "smooth" });
  status.textContent = `${hit.label} · creada en la celda ${linkedSourceCell.dataset.displayNumber}`;
}

function screenPoint(point) {
  return viewMode === "3d" ? project3D(point) : worldToCanvas(point);
}

function coordinateKey(info) {
  return info ? `${info.label}:${info.point.join(",")}` : "";
}

function showCoordinateInspector(info, locked = false) {
  if (!info) {
    coordinateInspector.classList.remove("visible", "locked");
    coordinateInspector.replaceChildren();
    return;
  }
  const dimensions = viewMode === "3d" ? cartesian3D(info.point) : [info.point[0], info.point[1]];
  const title = document.createElement("strong");
  title.textContent = info.label;
  const values = document.createElement("span");
  values.textContent = dimensions.map((value, index) => `${["X", "Y", "Z"][index]} ${format(value)}`).join("   ");
  coordinateInspector.replaceChildren(title, values);
  coordinateInspector.classList.add("visible");
  coordinateInspector.classList.toggle("locked", locked);
  const [x, y] = screenPoint(info.point);
  const left = Math.max(8, Math.min(canvas.clientWidth - 190, x + 14));
  const top = Math.max(55, Math.min(canvas.clientHeight - 64, y - 18));
  coordinateInspector.style.left = `${left}px`;
  coordinateInspector.style.top = `${top}px`;
}

function findCoordinateAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let closest = null;
  let distance = 14;
  for (const info of allInspectableCoordinates()) {
    const [px, py] = screenPoint(info.point);
    const current = Math.hypot(px - x, py - y);
    if (current < distance) {
      distance = current;
      closest = info;
    }
  }
  return closest;
}

function drawingBoundsCoordinates(item) {
  const base = coordinatesFromDrawing(item).map(info => info.point);
  if (item.type !== "frame") return base;
  const m = item.matrix;
  const size = m.length;
  const column = size === 4 ? 3 : 2;
  const origin = size === 4 ? [m[0][column], m[1][column], m[2][column]] : [m[0][column], m[1][column]];
  const dimensions = size === 4 ? 3 : 2;
  for (let axis = 0; axis < dimensions; axis += 1) {
    base.push(Array.from({ length: dimensions }, (_, row) => origin[row] + m[row][axis] * 1.25));
  }
  return base;
}

function centerVisibleContent() {
  const points = (latestResult.drawings || []).filter(isDrawingVisible).flatMap(drawingBoundsCoordinates);
  if (flowOverlayVisible && flowAnalysis) {
    points.push(flowAnalysis.from, flowAnalysis.to);
    if (showLocalFrames) {
      const frames = RoboticaVisualFlow.localFrames(flowAnalysis, localFrameScale);
      if (frames) points.push(...frames.final.axes, ...(compareLocalFrames ? frames.initial.axes : []));
    }
  }
  if (!points.length) {
    scale = 48;
    camera.panX = 0;
    camera.panY = 0;
    renderPlot();
    scheduleAutosave();
    return;
  }
  const projected = points.map(point => viewMode === "3d" ? project3DUnit(point) : [point[0], point[1]]);
  const xs = projected.map(point => point[0]);
  const ys = projected.map(point => point[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  scale = Math.max(20, Math.min(100, Math.min((canvas.clientWidth - 140) / width, (canvas.clientHeight - 130) / height)));
  camera.panX = -((minX + maxX) / 2) * scale;
  camera.panY = ((minY + maxY) / 2) * scale;
  renderPlot();
  scheduleAutosave();
}

function setCameraView(name) {
  const views = {
    iso: [-0.65, 0.48],
    top: [0, Math.PI / 2],
    front: [0, 0],
    side: [-Math.PI / 2, 0],
    left: [-Math.PI / 2, 0],
    right: [Math.PI / 2, 0],
    back: [Math.PI, 0],
    bottom: [0, -Math.PI / 2]
  };
  [camera.yaw, camera.pitch] = views[name];
  document.querySelectorAll(".view-3d-control").forEach(button => button.classList.toggle("active", button.id === `view${name[0].toUpperCase()}${name.slice(1)}`));
  centerVisibleContent();
}

runButton.addEventListener("click", executeAll);
document.getElementById("pauseExecution").addEventListener("click", () => {
  execution.togglePause();
  PythonRuntime.control(execution.current?.paused ? "pause" : "resume").catch(showRuntimeError);
});
document.getElementById("stopExecution").addEventListener("click", stopExecution);
document.getElementById("addCell").addEventListener("click", () => createCell("", true));
document.getElementById("resetNotebook").addEventListener("click", () => resetNotebook(true));
document.getElementById("mode2d").addEventListener("click", () => setViewMode("2d"));
document.getElementById("mode3d").addEventListener("click", () => setViewMode("3d"));
document.getElementById("togglePointLabels").addEventListener("click", () => {
  showPointLabels = !showPointLabels;
  updatePointLabelControl();
  renderPlot();
  scheduleAutosave();
});
document.getElementById("showLabels").addEventListener("change", event => {
  showPointLabels = event.target.checked;
  updatePointLabelControl();
  renderPlot();
  scheduleAutosave();
});
for (const [id, assign] of [
  ["showGrid", value => { showGrid = value; }],
  ["showAxes", value => { showAxes = value; }],
  ["showLegend", value => { showLegend = value; }]
]) {
  document.getElementById(id).addEventListener("change", event => {
    assign(event.target.checked);
    updateVisualizationControls();
    renderPlot();
    scheduleAutosave();
  });
}
document.getElementById("resetView").addEventListener("click", () => {
  scale = 48;
  camera = { yaw: -0.65, pitch: 0.48, panX: 0, panY: 0 };
  document.querySelectorAll(".view-3d-control").forEach(button => button.classList.toggle("active", button.id === "viewIso"));
  renderPlot();
  scheduleAutosave();
});
document.getElementById("zoomIn").addEventListener("click", () => { scale = Math.min(100, scale * 1.2); renderPlot(); scheduleAutosave(); });
document.getElementById("zoomOut").addEventListener("click", () => { scale = Math.max(20, scale / 1.2); renderPlot(); scheduleAutosave(); });
canvas.addEventListener("wheel", event => {
  event.preventDefault();
  scale = Math.max(20, Math.min(100, scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
  renderPlot();
  scheduleAutosave();
}, { passive: false });
canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
  const mode = viewMode === "2d" || event.shiftKey || event.button === 1 || event.button === 2 ? "pan" : cameraTool;
  dragState = { mode, x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch, panX: camera.panX, panY: camera.panY, moved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("dragging");
});
canvas.addEventListener("pointermove", event => {
  if (!dragState) {
    hoveredCoordinate = findCoordinateAt(event.clientX, event.clientY);
    if (!lockedCoordinate) showCoordinateInspector(hoveredCoordinate);
    return;
  }
  if (Math.hypot(event.clientX - dragState.x, event.clientY - dragState.y) > 4) {
    dragState.moved = true;
    suppressCanvasClick = true;
  }
  if (dragState.mode === "pan") {
    camera.panX = dragState.panX + event.clientX - dragState.x;
    camera.panY = dragState.panY + event.clientY - dragState.y;
  } else {
    camera.yaw = dragState.yaw + (event.clientX - dragState.x) * 0.008;
    camera.pitch = Math.max(-1.35, Math.min(1.35, dragState.pitch + (event.clientY - dragState.y) * 0.008));
    document.querySelectorAll(".view-3d-control").forEach(button => button.classList.remove("active"));
  }
  renderPlot();
});
const stopDragging = () => {
  const moved = dragState?.moved;
  dragState = null;
  canvas.classList.remove("dragging");
  if (moved) scheduleAutosave();
};
canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("pointerleave", () => {
  hoveredCoordinate = null;
  if (!lockedCoordinate) showCoordinateInspector(null);
});
canvas.addEventListener("click", event => {
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }
  const selected = findCoordinateAt(event.clientX, event.clientY);
  linkDrawingToCell(selected || findTrajectoryAt(event.clientX, event.clientY));
  lockedCoordinate = selected && coordinateKey(lockedCoordinate) !== coordinateKey(selected) ? selected : null;
  showCoordinateInspector(lockedCoordinate || hoveredCoordinate, Boolean(lockedCoordinate));
});
canvas.addEventListener("contextmenu", event => event.preventDefault());
window.addEventListener("resize", () => {
  notebook.querySelectorAll(".cell-editor").forEach(updateLineNumbers);
  resizeCanvas();
});
new ResizeObserver(resizeCanvas).observe(document.getElementById("canvasWrap"));

function setCameraTool(tool) {
  cameraTool = tool;
  document.getElementById("orbitTool").classList.toggle("active", tool === "orbit");
  document.getElementById("panTool").classList.toggle("active", tool === "pan");
  canvas.classList.toggle("pan-tool", tool === "pan");
}
document.getElementById("orbitTool").addEventListener("click", () => setCameraTool("orbit"));
document.getElementById("panTool").addEventListener("click", () => setCameraTool("pan"));
document.getElementById("viewIso").addEventListener("click", () => setCameraView("iso"));
document.getElementById("viewTop").addEventListener("click", () => setCameraView("top"));
document.getElementById("viewFront").addEventListener("click", () => setCameraView("front"));
document.getElementById("viewSide").addEventListener("click", () => setCameraView("side"));
document.getElementById("centerContent").addEventListener("click", centerVisibleContent);
document.querySelectorAll(".plane-controls button").forEach(button => {
  button.addEventListener("click", () => {
    const plane = button.dataset.plane;
    if (visiblePlanes.has(plane) && visiblePlanes.size > 1) visiblePlanes.delete(plane);
    else visiblePlanes.add(plane);
    button.classList.toggle("active", visiblePlanes.has(plane));
    renderPlot();
    scheduleAutosave();
  });
});

document.getElementById("themeToggle").addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark-theme");
  document.getElementById("themeToggle").textContent = dark ? "☀" : "☾";
  document.getElementById("themeToggle").setAttribute("aria-label", dark ? "Usar tema claro" : "Usar tema oscuro");
  renderPlot();
  scheduleAutosave();
});

activityMenuTrigger.addEventListener("click", event => {
  event.stopPropagation();
  activityOptions.open = false;
  const open = activityMenu.hidden;
  activityMenu.hidden = !open;
  activityMenuTrigger.setAttribute("aria-expanded", String(open));
});
activityMenu.addEventListener("click", event => event.stopPropagation());
function positionActivityOptions() {
  if (activityOptions.open && window.matchMedia("(max-width: 760px)").matches) {
    const top = document.querySelector(".topbar").getBoundingClientRect().bottom + 8;
    activityOptionsPanel.style.top = `${top}px`;
    activityOptionsPanel.style.maxHeight = `${Math.max(180, window.innerHeight - top - 8)}px`;
  } else {
    activityOptionsPanel.style.top = "";
    activityOptionsPanel.style.maxHeight = "";
  }
}
activityOptions.addEventListener("toggle", positionActivityOptions);
window.addEventListener("resize", positionActivityOptions);
document.addEventListener("click", event => {
  activityMenu.hidden = true;
  activityMenuTrigger.setAttribute("aria-expanded", "false");
  if (!activityOptions.contains(event.target)) activityOptions.open = false;
});
document.getElementById("saveActivity").addEventListener("click", saveActivityFile);
document.getElementById("exportPython").addEventListener("click", exportPythonFile);
document.getElementById("openActivity").addEventListener("click", () => activityFileInput.click());
document.getElementById("showRecovery").addEventListener("click", showRecoveryVersions);
document.getElementById("closeRecovery").addEventListener("click", closeRecovery);
recoveryBackdrop.addEventListener("click", event => { if (event.target === recoveryBackdrop) closeRecovery(); });
activityFileInput.addEventListener("change", async () => {
  const file = activityFileInput.files?.[0];
  activityFileInput.value = "";
  if (!file) return;
  try {
    if (file.size > 3_000_000) throw new Error("El archivo supera el límite de 3 MB.");
    const activity = RoboticaStorage.safeParse(await file.text());
    if (execution.current || !confirmReplaceActivity()) return;
    if (!archiveCurrentActivity()) return;
    applyActivity(activity);
    activityMenu.hidden = true;
    activityMenuTrigger.setAttribute("aria-expanded", "false");
    consoleOutput.classList.remove("error");
    consoleOutput.textContent = `✓ ${activity.name} abierta correctamente.`;
  } catch (error) {
    consoleOutput.classList.add("error");
    consoleOutput.textContent = error.message;
    RoboticaWorkspace.selectTab("outputPanel");
    setSaveIndicator("No se pudo abrir");
  }
});
activityNameInput.addEventListener("input", () => { updateActivityLabel(); scheduleAutosave(); });
teacherInstructionsInput.addEventListener("input", scheduleAutosave);
animationSpeedInput.addEventListener("change", () => {
  animationSpeed = animationSpeedInput.value;
  scheduleAutosave();
});
autoSaveInput.addEventListener("change", () => {
  autoSaveEnabled = autoSaveInput.checked;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (autoSaveEnabled) {
    scheduleAutosave();
  } else {
    // Save the preference only if the current document had no pending edits.
    if (!activityDirty) {
      try {
        const activity = captureActivity();
        RoboticaStorage.saveAutosave(activity);
        savedFingerprint = activityFingerprint(activity);
      } catch { activityDirty = true; }
    }
    scheduleAutosave();
  }
});
document.getElementById("clearLocalData").addEventListener("click", () => {
  if (!window.confirm("¿Borrar el autoguardado y todas las versiones recientes de este navegador?")) return;
  if (!RoboticaStorage.clearLocal()) { setSaveIndicator("No se pudieron borrar los datos"); return; }
  PythonRuntime.persistStorage();
  autoSaveEnabled = false;
  autoSaveInput.checked = false;
  clearTimeout(autosaveTimer);
  savedFingerprint = "";
  exportedFingerprint = "";
  activityDirty = true;
  setSaveIndicator("Datos locales borrados");
});
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveActivityFile();
  }
  if (event.key === "Escape") {
    activityMenu.hidden = true;
    activityMenuTrigger.setAttribute("aria-expanded", "false");
    activityOptions.open = false;
    closeRecovery();
  }
});

function confirmReplaceActivity() {
  if (autoSaveEnabled && activityDirty) saveLocalNow();
  return !activityDirty || window.confirm("Hay cambios sin guardar. ¿Reemplazar la actividad? Cancela y usa Guardar .roboticalab para conservar una copia.");
}
window.addEventListener("beforeunload", event => {
  if (autoSaveEnabled && activityDirty) saveLocalNow();
  if (activityDirty || PythonRuntime.storagePending) { event.preventDefault(); event.returnValue = ""; }
});
window.addEventListener("pagehide", () => {
  if (autoSaveEnabled && activityDirty) saveLocalNow();
});
document.addEventListener("visibilitychange", () => { if (document.hidden && autoSaveEnabled && activityDirty) saveLocalNow(); });

document.getElementById("transformMatrix").addEventListener("change", event => {
  flowMatrixName = event.target.value;
  flowPointName = null;
  flowProgress = 1;
  renderTransformPanel(notebookSession.variables);
});
document.getElementById("transformPoint").addEventListener("change", event => {
  flowPointName = event.target.value;
  flowProgress = 1;
  renderTransformPanel(notebookSession.variables);
});
document.getElementById("showTransformOnGraph").addEventListener("click", () => {
  if (!flowAnalysis) return;
  flowOverlayVisible = !flowOverlayVisible;
  if (!flowOverlayVisible) showLocalFrames = false;
  renderTransformPanel(notebookSession.variables);
  if (flowOverlayVisible) centerVisibleContent();
});
document.getElementById("showLocalFrames").addEventListener("change", event => {
  showLocalFrames = event.target.checked;
  if (showLocalFrames) flowOverlayVisible = true;
  renderTransformPanel(notebookSession.variables);
  if (showLocalFrames) centerVisibleContent();
  else renderPlot();
  scheduleAutosave();
});
document.getElementById("compareLocalFrames").addEventListener("change", event => {
  compareLocalFrames = event.target.checked;
  renderTransformPanel(notebookSession.variables);
  renderPlot();
  scheduleAutosave();
});
document.getElementById("localFrameScale").addEventListener("change", event => {
  const value = Number(event.target.value);
  localFrameScale = Number.isFinite(value) && value >= 0.1 && value <= 20 ? value : 1;
  event.target.value = String(localFrameScale);
  renderPlot();
  scheduleAutosave();
});
document.getElementById("transformProgress").addEventListener("input", event => {
  if (!flowAnalysis) return;
  flowProgress = Number(event.target.value) / 100;
  flowOverlayVisible = true;
  document.getElementById("transformProgressValue").textContent = `${event.target.value} %`;
  const button = document.getElementById("showTransformOnGraph");
  button.setAttribute("aria-pressed", "true");
  button.textContent = "Ocultar del gráfico";
  RoboticaIcons.add(button, "eye");
  renderPlot();
});

RoboticaWorkspace.onFocusDiagnostic = focusDiagnostic;
RoboticaWorkspace.init();

const autosaveInspection = RoboticaStorage.inspectAutosave();
const savedActivity = autosaveInspection.activity;
updatePointLabelControl();
if (savedActivity) {
  applyActivity(savedActivity, { persist: false, message: savedActivity.settings.autoSave ? "Sesión recuperada" : "Autoguardado pausado" });
  consoleOutput.textContent = "Sesión local recuperada.";
} else {
  restoringActivity = true;
  createCell("");
  restoringActivity = false;
  updateActivityLabel();
  updateResults(latestResult);
  consoleOutput.textContent = "Listo.";
  setSaveIndicator("Sin cambios");
  savedFingerprint = activityFingerprint(captureActivity());
  if (autosaveInspection.status === "invalid") {
    setSaveIndicator("Autoguardado dañado · revisa versiones");
    consoleOutput.textContent = "No se pudo recuperar el autoguardado. Abre Actividad → Recuperar versión para revisar las copias anteriores.";
    RoboticaWorkspace.selectTab("outputPanel");
  } else if (autosaveInspection.status === "unavailable") {
    setSaveIndicator("Guardado local no disponible");
  }
}
if (location.hash === "#3d" && !savedActivity) setViewMode("3d");
requestAnimationFrame(resizeCanvas);

function showRuntimeError(error) {
  const notice = document.getElementById("runtimeNotice");
  notice.textContent = error.message || String(error);
  notice.hidden = false;
}
document.addEventListener("python-status", event => {
  document.getElementById("runtimeNotice").hidden = event.detail.ready;
  if (!event.detail.ready) showRuntimeError(event.detail.message);
  updateExecutionControls(execution.current);
});
document.addEventListener("python-storage", event => {
  if (!event.detail.ok) setSaveIndicator("Copia en navegador · disco no disponible");
});
document.getElementById("nextPythonStep").addEventListener("click", () => {
  if (!execution.current?.paused) return;
  execution.togglePause();
  PythonRuntime.control("step").catch(showRuntimeError);
});
document.getElementById("pythonInputForm").addEventListener("submit", event => {
  event.preventDefault();
  PythonRuntime.input(document.getElementById("pythonInputValue").value).catch(showRuntimeError);
  document.getElementById("pythonInputDialog").close();
});
document.getElementById("cancelPythonInput").addEventListener("click", stopExecution);
document.getElementById("pythonInputDialog").addEventListener("cancel", event => { event.preventDefault(); stopExecution(); });
document.getElementById("pythonSettingsButton").addEventListener("click", () => {
  activityMenu.hidden = true;
  activityMenuTrigger.setAttribute("aria-expanded", "false");
  document.getElementById("pythonSettings").showModal();
});
for (const id of ["coppeliaHost", "coppeliaPort", "coppeliaClientPath", "manualRobotRoot", "manualTargetPath", "manualFrame", "legacyMatmul"]) {
  document.getElementById(id).addEventListener("change", () => {
    scheduleAutosave();
  });
}
function coppeliaSettings(action) {
  return {
    action, host: document.getElementById("coppeliaHost").value.trim(),
    port: Number(document.getElementById("coppeliaPort").value),
    extraPath: document.getElementById("coppeliaClientPath").value.trim()
  };
}
for (const [id, action] of [["probeCoppelia", "probe"]]) {
  document.getElementById(id).addEventListener("click", async () => {
    const button = document.getElementById(id);
    const status = document.getElementById("coppeliaStatus");
    button.disabled = true;
    status.textContent = "Comprobando conexión…";
    try {
      const result = await PythonRuntime.coppelia(coppeliaSettings(action));
      status.textContent = result.message + (result.version ? ` · versión ${result.version}` : "");
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
}
document.getElementById("insertCoppelia").addEventListener("click", () => {
  if (execution.current) return;
  const { host, port, extraPath } = coppeliaSettings("probe");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    document.getElementById("coppeliaStatus").textContent = "Comprueba la dirección y el puerto.";
    return;
  }
  const pathCode = extraPath ? `import sys\nsys.path.insert(0, ${JSON.stringify(extraPath)})\n` : "";
  const code = `${pathCode}from roboticalab import connect_coppelia\n\nclient, sim = connect_coppelia(host=${JSON.stringify(host)}, port=${port})\nprint("Estado de simulación:", sim.getSimulationState())\n\n# Descubrir articulaciones de la escena, sin moverlas.\narticulaciones = sim.getObjectsInTree(sim.handle_scene, sim.object_joint_type, 0)\nfor articulacion in articulaciones:\n    print(sim.getObjectAlias(articulacion, 1), sim.getJointPosition(articulacion))\n\n# Usa las rutas de TU escena en las siguientes celdas.\n# sim.startSimulation() y sim.stopSimulation() son acciones explícitas.`;
  const empty = [...notebook.querySelectorAll(".code-cell")].find(cell => !cell.querySelector(".cell-editor").value.trim());
  const cell = empty || createCell("", true);
  const editor = cell.querySelector(".cell-editor");
  RoboticaEditor.replace(editor, { start: 0, end: editor.value.length, text: code });
  document.getElementById("pythonSettings").close();
  RoboticaWorkspace.setExpanded(false);
});
const environment = document.getElementById("pythonEnvironment");
environment.textContent = PythonRuntime.info ? `Python ${PythonRuntime.info.python} · NumPy ${PythonRuntime.info.packages.numpy} · ZeroMQ, CBOR y cliente CoppeliaSim disponibles. Carpeta de trabajo: ${PythonRuntime.info.workspace}` : "Python no está conectado. Inicia la aplicación desde Iniciar_Cuaderno_Coppelia.bat.";
if (window.roboticalabBoot?.error) showRuntimeError(window.roboticalabBoot.error);
updateExecutionControls(execution.current);
