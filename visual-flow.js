(function (global) {
  "use strict";

  const finite = value => typeof value === "number" && Number.isFinite(value);

  function isHomogeneousMatrix(value) {
    if (!Array.isArray(value) || ![3, 4].includes(value.length)) return false;
    const size = value.length;
    return value.every(row => Array.isArray(row) && row.length === size && row.every(finite))
      && value[size - 1].every((entry, index) => Math.abs(entry - (index === size - 1 ? 1 : 0)) < 1e-9);
  }

  function matrixNames(variables) {
    return Object.keys(variables).filter(name => isHomogeneousMatrix(variables[name]));
  }

  function pointNames(variables, size) {
    return Object.keys(variables).filter(name => {
      const value = variables[name];
      return Array.isArray(value) && [size - 1, size].includes(value.length)
        && value.every(finite) && (value.length !== size || Math.abs(value.at(-1) - 1) < 1e-9);
    });
  }

  function analyze(variables, matrixName, pointName) {
    const matrix = variables[matrixName];
    if (!isHomogeneousMatrix(matrix) || !pointNames(variables, matrix.length).includes(pointName)) return null;
    const point = variables[pointName];
    const input = point.length === matrix.length ? point.slice() : [...point, 1];
    const rows = matrix.map((row, index) => ({
      coordinate: ["x", "y", "z", "w"][index],
      terms: row.map((coefficient, column) => ({ coefficient, value: input[column], product: coefficient * input[column] })),
      total: row.reduce((sum, coefficient, column) => sum + coefficient * input[column], 0)
    }));
    const output = rows.map(row => row.total);
    if (!output.every(finite) || Math.abs(output.at(-1) - 1) > 1e-7) return null;
    return {
      matrixName, pointName, matrix, input, output, rows,
      from: input.slice(0, -1), to: output.slice(0, -1),
      dimension: matrix.length - 1
    };
  }

  function pointAt(analysis, progress) {
    const factor = Math.max(0, Math.min(1, progress));
    return analysis.from.map((coordinate, index) => coordinate + (analysis.to[index] - coordinate) * factor);
  }

  function localFrames(analysis, length = 1) {
    if (!analysis || !finite(length) || length <= 0 || length > 20) return null;
    const dimension = analysis.dimension;
    const rotation = analysis.matrix.slice(0, dimension).map(row => row.slice(0, dimension));
    const columns = Array.from({ length: dimension }, (_, column) => rotation.map(row => row[column]));
    for (let i = 0; i < dimension; i += 1) {
      for (let j = 0; j < dimension; j += 1) {
        const dot = columns[i].reduce((sum, value, row) => sum + value * columns[j][row], 0);
        if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-5) return null;
      }
    }
    const determinant = dimension === 2
      ? rotation[0][0] * rotation[1][1] - rotation[0][1] * rotation[1][0]
      : rotation[0][0] * (rotation[1][1] * rotation[2][2] - rotation[1][2] * rotation[2][1])
        - rotation[0][1] * (rotation[1][0] * rotation[2][2] - rotation[1][2] * rotation[2][0])
        + rotation[0][2] * (rotation[1][0] * rotation[2][1] - rotation[1][1] * rotation[2][0]);
    if (Math.abs(determinant - 1) > 1e-5) return null;
    const makeFrame = (origin, basis) => ({
      origin: origin.slice(),
      axes: basis.map(axis => origin.map((coordinate, row) => coordinate + length * axis[row]))
    });
    const identity = Array.from({ length: dimension }, (_, column) =>
      Array.from({ length: dimension }, (_, row) => Number(row === column)));
    return {
      initial: makeFrame(analysis.from, identity),
      final: makeFrame(analysis.to, columns)
    };
  }

  const api = { isHomogeneousMatrix, matrixNames, pointNames, analyze, pointAt, localFrames };
  global.RoboticaVisualFlow = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
