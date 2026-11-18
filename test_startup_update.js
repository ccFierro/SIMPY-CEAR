"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { runStartupUpdate } = require("./desktop/startup-update.cjs");

async function main() {
  const current = new EventEmitter();
  current.checkForUpdates = async () => ({ isUpdateAvailable: false });
  current.downloadUpdate = () => { throw new Error("No debe descargar si está al día"); };
  const currentStates = [];
  assert.deepEqual(await runStartupUpdate(current, state => currentStates.push(state)), { action: "open", reason: "current" });
  assert.deepEqual(currentStates, [{ phase: "checking" }]);

  const available = new EventEmitter();
  const cancellationToken = { id: 1 };
  available.checkForUpdates = async () => ({ isUpdateAvailable: true, updateInfo: { version: "0.2.5" }, cancellationToken });
  available.downloadUpdate = async token => {
    assert.equal(token, cancellationToken);
    available.emit("download-progress", { percent: 42.9 });
  };
  const progressStates = [];
  assert.deepEqual(await runStartupUpdate(available, state => progressStates.push(state)), { action: "install", version: "0.2.5" });
  assert.deepEqual(progressStates, [
    { phase: "checking" },
    { phase: "downloading", version: "0.2.5", percent: 0 },
    { phase: "downloading", version: "0.2.5", percent: 42 },
    { phase: "installing", version: "0.2.5", percent: 100 }
  ]);
  assert.equal(available.listenerCount("download-progress"), 0);

  const timeout = new EventEmitter();
  timeout.checkForUpdates = () => new Promise(() => {});
  assert.deepEqual(await runStartupUpdate(timeout, () => {}, 5), { action: "open", reason: "timeout" });

  const failed = new EventEmitter();
  failed.checkForUpdates = available.checkForUpdates;
  failed.downloadUpdate = async () => { throw new Error("Descarga interrumpida"); };
  await assert.rejects(runStartupUpdate(failed, () => {}), /Descarga interrumpida/);
  assert.equal(failed.listenerCount("download-progress"), 0);
  console.log("Actualización al iniciar: búsqueda, progreso y fallos OK");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
