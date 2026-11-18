const { app, BrowserWindow, Menu, dialog, ipcMain, session, screen } = require('electron');
const { autoUpdater } = app.isPackaged
  ? require('electron-updater')
  : require('../../RoboticaLab/node_modules/electron-updater');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { runStartupUpdate } = require('./startup-update.cjs');

const localBase = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const defaultData = app.isPackaged
  ? path.join(localBase, 'CEAR RoboLab Coppelia')
  : path.resolve(__dirname, '..', '.local-data');
const isolatedTest = process.argv.includes('--smoke-test') || process.argv.includes('--startup-smoke-test');
const testDataIndex = process.argv.indexOf('--data-dir');
const profileBase = isolatedTest && testDataIndex >= 0 && process.argv[testDataIndex + 1]
  ? path.resolve(process.argv[testDataIndex + 1]) : defaultData;
fs.mkdirSync(path.join(profileBase, 'electron-profile'), { recursive: true });
app.setPath('userData', path.join(profileBase, 'electron-profile'));

let window;
let updateWindow;
let server;
let checking = false;
let updateReady = false;
let installing = false;
let updateStatus = 'Sin comprobar';
let installTimer;
let startupUpdating = false;
const hasArgument = name => process.argv.includes(name);
const argumentValue = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const smoke = hasArgument('--smoke-test');
const startupSmoke = hasArgument('--startup-smoke-test');

function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Aplicación', submenu: [{ label: 'Salir', role: 'quit' }] },
    { label: 'Vista', submenu: [{ role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Actualizaciones', submenu: [
      { label: `Versión ${app.getVersion()} · ${updateStatus}`, enabled: false }
    ] }
  ]));
}

function startServer(data) {
  const root = app.isPackaged ? path.join(process.resourcesPath, 'robolab') : path.resolve(__dirname, '..');
  const python = app.isPackaged ? path.join(root, 'runtime', 'python.exe') : require('../scripts/python-env').findPython();
  const source = app.isPackaged ? path.join(root, 'app', 'server.py') : path.join(root, 'server.py');
  const workingDirectory = app.isPackaged ? path.join(root, 'app') : root;
  if (!fs.existsSync(python) || !fs.existsSync(source)) throw new Error('Falta Python o el servidor local.');
  fs.mkdirSync(data, { recursive: true });
  const errorLog = fs.createWriteStream(path.join(data, 'server-error.log'), { flags: 'a' });
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';
    const timer = setTimeout(() => fail(new Error('Python no respondió al iniciar.')), 25000);
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    server = spawn(python, [source, '--port', '0', '--data-dir', data, '--no-browser'], {
      cwd: workingDirectory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.pipe(errorLog);
    server.once('error', fail);
    server.once('exit', code => { if (!settled) fail(new Error(`Python terminó al iniciar (${code}). Revisa ${path.join(data, 'server-error.log')}.`)); });
    server.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (settled || !buffer.includes('\n')) return;
      try {
        const info = JSON.parse(buffer.split('\n')[0]);
        if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(info.url)) throw new Error('Respuesta de inicio inválida.');
        settled = true;
        clearTimeout(timer);
        resolve(info.url);
      } catch (error) { fail(error); }
    });
  });
}

function stopServer() {
  if (!server || !server.pid || server.exitCode !== null) return;
  spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, timeout: 5000, stdio: 'ignore' });
  server = null;
}

async function createWindow(origin) {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.max(430, Math.round(area.width * 0.35));
  window = new BrowserWindow({
    x: area.x, y: area.y, width, height: area.height,
    minWidth: 430, minHeight: 520, maxWidth: Math.max(width, Math.round(area.width * 0.5)),
    alwaysOnTop: true, frame: false, autoHideMenuBar: true, resizable: true,
    title: 'SIMPY - CEAR', backgroundColor: '#edf4f4', show: !smoke && !startupSmoke,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const sameOrigin = (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); };
  window.webContents.on('will-navigate', sameOrigin);
  window.webContents.on('will-redirect', sameOrigin);
  await window.loadURL(origin);
  await window.webContents.executeJavaScript(`(() => {
    window.__robolabLastInteraction = Date.now();
    for (const name of ['pointerdown', 'keydown', 'input']) {
      document.addEventListener(name, () => { window.__robolabLastInteraction = Date.now(); }, true);
    }
  })()`);
}

async function waitForReady() {
  for (let index = 0; index < 100; index += 1) {
    if (await window.webContents.executeJavaScript('Boolean(window.PythonRuntime?.available && document.querySelector(".cell-editor") && document.body.classList.contains("desktop-window"))')) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('La interfaz no terminó de iniciar.');
}

const configured = () => app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));

function showUpdateStatus(state) {
  if (!updateWindow || updateWindow.isDestroyed()) return;
  const version = state.version || '';
  const content = state.phase === 'checking'
    ? { heading: 'Buscando actualizaciones', detail: 'Comprobando la versión disponible…' }
    : state.phase === 'installing'
      ? { heading: `Instalando ${version}`, detail: 'SIMPY - CEAR se abrirá de nuevo automáticamente.', percent: 100 }
      : { heading: 'Actualizando SIMPY - CEAR', detail: `Descargando versión ${version}…`, percent: state.percent };
  void updateWindow.webContents.executeJavaScript(`window.setUpdateStatus(${JSON.stringify(content)})`).catch(() => {});
}

async function updateBeforeOpening() {
  if (!configured()) return false;
  startupUpdating = true;
  autoUpdater.autoDownload = false;
  updateWindow = new BrowserWindow({
    width: 500, height: 340, minWidth: 500, minHeight: 340,
    frame: false, transparent: true, hasShadow: false, skipTaskbar: true,
    resizable: false, maximizable: false, show: false,
    title: 'Iniciando SIMPY - CEAR', backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  updateWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    await updateWindow.loadFile(path.join(__dirname, 'update.html'));
    if (!startupSmoke) updateWindow.show();
    const result = await runStartupUpdate(autoUpdater, showUpdateStatus);
    if (result.action === 'install') {
      installing = true;
      autoUpdater.quitAndInstall(true, true);
      return true;
    }
    updateStatus = result.reason === 'timeout' ? 'Sin conexión; se reintentará' : 'Al día';
  } catch (error) {
    updateStatus = 'Sin conexión; se reintentará';
    try { fs.appendFileSync(path.join(defaultData, 'updater.log'), `${new Date().toISOString()} ${error.stack || error}\n`); } catch {}
  } finally {
    if (!installing) {
      if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
      updateWindow = null;
      startupUpdating = false;
      autoUpdater.autoDownload = true;
    }
  }
  return false;
}

async function checkUpdates() {
  if (!configured() || checking || installing) return;
  checking = true;
  updateStatus = 'Buscando…';
  menu();
  try { await autoUpdater.checkForUpdates(); }
  catch { updateStatus = 'Sin conexión; se reintentará'; }
  finally { checking = false; menu(); }
}

async function tryInstall() {
  if (!updateReady || installing || !window || window.isDestroyed()) return;
  let safe = false;
  try {
    safe = await window.webContents.executeJavaScript(`(() =>
      !execution.current && !pythonResetting &&
      !activityDirty && !PythonRuntime.storagePending &&
      Date.now() - window.__robolabLastInteraction > 15000
    )()`);
  } catch { return; }
  if (!safe) {
    updateStatus = 'Lista; esperando que termines';
    menu();
    return;
  }
  installing = true;
  updateStatus = 'Instalando y reiniciando…';
  menu();
  autoUpdater.quitAndInstall(true, true);
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
autoUpdater.on('update-available', info => { updateStatus = `Descargando ${info.version}…`; menu(); });
autoUpdater.on('download-progress', info => { updateStatus = `Descargando ${Math.floor(info.percent)} %`; menu(); });
autoUpdater.on('update-not-available', () => { updateStatus = 'Al día'; menu(); });
autoUpdater.on('update-downloaded', () => {
  updateReady = true;
  updateStatus = 'Lista para instalar';
  menu();
  if (!startupUpdating) {
    if (!installTimer) installTimer = setInterval(() => void tryInstall(), 5000);
    void tryInstall();
  }
});
autoUpdater.on('error', () => { updateStatus = 'No se pudo comprobar; reintentar'; menu(); });

ipcMain.on('simpy:window-action', (event, action) => {
  if (!window || window.isDestroyed() || event.sender !== window.webContents) return;
  if (action === 'minimize') window.minimize();
  else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  else if (action === 'close') window.close();
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const data = path.resolve(argumentValue('--data-dir') || defaultData);
    if (!smoke && await updateBeforeOpening()) return;
    const origin = await startServer(data);
    await createWindow(origin);
    menu();
    if (smoke || startupSmoke) {
      await waitForReady();
      const destination = argumentValue('--smoke-output');
      if (destination) fs.writeFileSync(destination, JSON.stringify({ version: app.getVersion(), origin, ready: true, titlebar: true, startupChecked: startupSmoke, updateStatus }));
      stopServer();
      app.exit(0);
      return;
    }
    setInterval(() => void checkUpdates(), 6 * 60 * 60 * 1000).unref();
  }).catch(error => {
    if (smoke) console.error(error);
    else dialog.showErrorBox('No se pudo iniciar SIMPY - CEAR', error.message);
    stopServer();
    app.exit(1);
  });
  app.on('window-all-closed', () => { if (window && window.isDestroyed() && !installing) app.quit(); });
  app.on('before-quit', () => { if (installTimer) clearInterval(installTimer); stopServer(); });
}
