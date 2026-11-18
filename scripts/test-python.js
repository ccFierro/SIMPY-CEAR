"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { findPython, root } = require("./python-env");
const env = { ...process.env, PYTHONPATH: [path.join(root, "python"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
const result = spawnSync(findPython(), ["-m", "unittest", "discover", "-s", "tests", "-v"], { cwd: root, env, stdio: "inherit", windowsHide: true });
process.exitCode = result.status ?? 1;
