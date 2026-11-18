"use strict";
const { spawn } = require('node:child_process');
const { findPython, root } = require('./scripts/python-env');
const path = require('node:path');
const child = spawn(findPython(), [path.join(root, 'server.py')], { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
