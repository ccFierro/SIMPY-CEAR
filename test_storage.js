"use strict";
const assert = require("node:assert/strict");
const Storage = require("./storage");
const memoryStorage = (() => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
})();
const activity = Storage.normalizeActivity({
  format: "RoboticaLabActivity",
  version: 1,
  name: "Prueba",
  cells: [{ source: "P = [1, 2, 1]" }],
  settings: { viewMode: "3d", visiblePlanes: ["xy", "xz"], camera: { yaw: 1, pitch: 0.5 } }
});
Storage.saveAutosave(activity, memoryStorage);
assert.strictEqual(Storage.loadAutosave(memoryStorage).cells[0].source, "P = [1, 2, 1]");
assert.equal(Storage.loadAutosave(memoryStorage).cells[0].title, "");
assert.equal(Storage.loadAutosave(memoryStorage).cells[0].collapsed, false);
assert.equal(Storage.loadAutosave(memoryStorage).cells[0].enabled, true);
const namedCell = Storage.normalizeActivity({ ...activity, cells: [{ source: "def dh(): pass", title: "Función DH", collapsed: true }] });
assert.deepEqual(Storage.safeParse(JSON.stringify(namedCell)).cells[0], { source: "def dh(): pass", title: "Función DH", collapsed: true, enabled: true });
const reopenedActivity = Storage.safeParse(JSON.stringify(activity));
assert.equal(namedCell.cells[0].enabled, true);
const disabledCell = Storage.normalizeActivity({ ...activity, cells: [{ source: "print('omitida')", enabled: false }] });
assert.equal(Storage.safeParse(JSON.stringify(disabledCell)).cells[0].enabled, false);
assert.strictEqual(reopenedActivity.settings.viewMode, "3d");
assert.equal(reopenedActivity.settings.showGrid, true);
assert.equal(reopenedActivity.settings.showAxes, true);
assert.equal(reopenedActivity.settings.showLegend, true);
assert.equal(reopenedActivity.settings.showLocalFrames, false);
assert.equal(reopenedActivity.settings.compareLocalFrames, false);
assert.equal(reopenedActivity.settings.localFrameScale, 1);
assert.deepStrictEqual(reopenedActivity.settings.visiblePlanes, ["xy", "xz"]);
assert.equal(Storage.normalizeActivity({ ...activity, settings: { ...activity.settings, showGrid: false, showAxes: false, showLegend: false } }).settings.showLegend, false);
const frameSettings = Storage.normalizeActivity({ ...activity, settings: { ...activity.settings, showLocalFrames: true, compareLocalFrames: true, localFrameScale: 2.5 } }).settings;
assert.equal(frameSettings.showLocalFrames, true);
assert.equal(frameSettings.compareLocalFrames, true);
assert.equal(frameSettings.localFrameScale, 2.5);
Storage.pushHistory(activity, memoryStorage);
assert.strictEqual(Storage.loadHistory(memoryStorage).length, 1);
for (let index = 0; index < 15; index += 1) Storage.pushHistory({ ...activity, name: `Versión ${index}` }, memoryStorage);
assert.strictEqual(Storage.loadHistory(memoryStorage).length, Storage.MAX_HISTORY);
assert.strictEqual(Storage.loadHistory(memoryStorage)[0].name, "Versión 14");
assert.throws(() => Storage.safeParse('{"format":"otro"}'), /No se pudo abrir/);
console.log("Pruebas de almacenamiento: OK");

assert.equal(activity.version,2);
assert.equal(activity.settings.legacyMatmul,true);
assert.equal(Storage.normalizeActivity({...activity,settings:{}}).settings.legacyMatmul,false);
