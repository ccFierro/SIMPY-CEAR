"use strict";
const path = require("node:path");
const fs = require("node:fs");
const asar = require("@electron/asar");

const root = path.resolve(__dirname, "..");
const archive = path.join(root, "dist", "installer", "win-unpacked", "resources", "app.asar");
const version = require(path.join(root, "package.json")).version;
const installer = path.join(root, "dist", "installer", `SIMPY-CEAR-Setup-${version}-x64.exe`);
const update = path.join(root, "dist", "installer", "latest.yml");
if (!fs.existsSync(archive) || !fs.existsSync(installer) || !fs.existsSync(update)) {
  throw new Error("Faltan archivos del instalador.");
}

const entries = new Set(asar.listPackage(archive).map(item => item.replaceAll("\\", "/")));
for (const name of [
  "/desktop/main.cjs",
  "/desktop/preload.cjs",
  "/node_modules/electron-updater/package.json",
  "/node_modules/fs-extra/package.json",
  "/node_modules/builder-util-runtime/package.json",
  "/node_modules/js-yaml/package.json",
  "/node_modules/lazy-val/package.json",
]) {
  if (!entries.has(name)) throw new Error(`Dependencia ausente del instalador: ${name}`);
}
if (!fs.readFileSync(update, "utf8").includes(`version: ${version}`)) {
  throw new Error("latest.yml no coincide con el instalador.");
}
process.stdout.write(`Instalador ${version}: dependencias de inicio y actualización completas.\n`);
