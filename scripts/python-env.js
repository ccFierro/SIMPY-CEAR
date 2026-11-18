"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
function findPython() {
  const candidates = [process.env.ROBOTICALAB_PYTHON,
    path.join(root, ".runtime", process.platform === "win32" ? "python.exe" : "bin/python3"),
    path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
    path.join(root, "..", "RoboticaLab", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")];
  const python = candidates.find(file => file && fs.existsSync(file));
  if (!python) throw new Error("Prepara Python para el cuaderno Coppelia o define ROBOTICALAB_PYTHON.");
  return python;
}
module.exports = { findPython, root };
