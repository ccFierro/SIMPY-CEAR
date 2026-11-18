"use strict";
const assert = require("node:assert/strict");
const Editor = require("./editor.js");
const ExecutionController = require("./execution.js");
const Storage = require("./storage.js");

async function main() {
  const controller = new ExecutionController();
  const run = controller.start();
  assert.equal(controller.start(), null, "No admite dos ejecuciones");
  controller.togglePause();
  let continued = false;
  const paused = controller.checkpoint(run).then(ok => { continued = true; return ok; });
  await Promise.resolve();
  assert.equal(continued, false);
  controller.stop();
  assert.equal(await paused, false, "Detener libera una espera pausada");
  controller.finish(run);
  const next = controller.start();
  assert.equal(await controller.checkpoint(run), false, "Un recorrido anterior no puede continuar");
  controller.togglePause();
  const resume = controller.checkpoint(next);
  controller.togglePause();
  assert.equal(await resume, true);
  controller.finish(next);

  assert.deepEqual(Editor.editForKey("T = []", 5, 5, "Enter"), { start: 5, end: 5, text: "\n    \n", cursor: 10 });
  assert.equal(Editor.editForKey("    x = 1", 9, 9, "Enter").text, "\n    ");
  assert.equal(Editor.editForKey("P", 0, 1, "[").text, "[P]");
  assert.equal(Editor.editForKey("[]", 1, 1, "]").cursor, 2);
  assert.equal(Editor.editForKey("[]", 1, 1, "Backspace").text, "");
  assert.equal(Editor.editForKey("    a\n    b", 0, 11, "Tab", true).text, "a\nb");
  assert(!Editor.highlight('print("<img>")').includes("<img>"), "El resaltado escapa HTML");
  assert(Editor.highlight("# np.sin(1)").includes('syntax-comment'));

  const values = new Map();
  const memory = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  memory.setItem(Storage.HISTORY_KEY, '{"corrupto":true}');
  assert.deepEqual(Storage.loadHistory(memory), []);
  const activity = { format: Storage.FORMAT, version: 1, cells: [{ source: "x = 1" }], settings: { camera: { pitch: Math.PI / 2 } } };
  Storage.pushHistory(activity, memory);
  assert.equal(Storage.loadHistory(memory).length, 1);
  assert.equal(Storage.normalizeActivity(activity).settings.camera.pitch, Math.PI / 2, "Conserva la vista superior al reabrir");
  memory.setItem(Storage.AUTOSAVE_KEY, "{dañado");
  assert.equal(Storage.inspectAutosave(memory).status, "invalid");
  assert.equal(Storage.inspectAutosave({ getItem() { throw new Error("Bloqueado"); } }).status, "unavailable");
  Storage.saveAutosave(activity, memory);
  assert.equal(Storage.inspectAutosave(memory).status, "ready");
  console.log("Pruebas de ejecución, editor y recuperación: OK");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
