"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");

if (process.platform !== "win32") throw new Error("Este paquete se genera en Windows.");
const script = path.join(__dirname, "build-windows.ps1");
const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
