"use strict";
const assert = require("node:assert/strict");
const flow = require("./visual-flow");

const variables2D = {
  T: [[0, -1, 2], [1, 0, 1], [0, 0, 1]],
  P: [1, 1, 1],
  Pcart: [1, 1],
  malformed: [[1, 0, 0], [0, 1, 0], [0, 1, 1]],
  hidden: [Infinity, 1, 1]
};
assert.deepEqual(flow.matrixNames(variables2D), ["T"]);
assert.deepEqual(flow.pointNames(variables2D, 3), ["P", "Pcart"]);
const rotated = flow.analyze(variables2D, "T", "P");
assert.deepEqual(rotated.output, [1, 2, 1]);
assert.deepEqual(rotated.rows[0].terms.map(term => term.product), [0, -1, 2]);
assert.deepEqual(flow.pointAt(rotated, 0.5), [1, 1.5]);
assert.deepEqual(flow.pointAt(rotated, 2), [1, 2]);
assert.deepEqual(flow.localFrames(rotated, 2), {
  initial: { origin: [1, 1], axes: [[3, 1], [1, 3]] },
  final: { origin: [1, 2], axes: [[1, 4], [-1, 2]] }
});
assert.equal(flow.localFrames(rotated, 0), null);
assert.equal(flow.localFrames(rotated, 21), null);
assert.deepEqual(flow.analyze(variables2D, "T", "Pcart").output, [1, 2, 1]);
assert.equal(flow.analyze(variables2D, "malformed", "P"), null);

const variables3D = {
  H: [[1, 0, 0, 3], [0, 1, 0, -2], [0, 0, 1, 4], [0, 0, 0, 1]],
  Q: [2, 3, 5]
};
const translated = flow.analyze(variables3D, "H", "Q");
assert.deepEqual(translated.input, [2, 3, 5, 1]);
assert.deepEqual(translated.output, [5, 1, 9, 1]);
assert.deepEqual(flow.pointAt(translated, 0.5), [3.5, 2, 7]);
assert.deepEqual(flow.localFrames(translated, 1).final, {
  origin: [5, 1, 9], axes: [[6, 1, 9], [5, 2, 9], [5, 1, 10]]
});
assert.equal(flow.localFrames(flow.analyze({ T: [[2, 0, 0], [0, 1, 0], [0, 0, 1]], P: [1, 1] }, "T", "P")), null);
assert.equal(flow.localFrames(flow.analyze({ T: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]], P: [1, 1] }, "T", "P")), null);
console.log("Pruebas de visualización de transformaciones: OK");
