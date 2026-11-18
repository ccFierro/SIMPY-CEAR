"use strict";

const TIMED_OUT = Symbol("update-check-timeout");

async function checkWithTimeout(check, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise(resolve => { timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runStartupUpdate(updater, onState, timeoutMs = 12000) {
  onState({ phase: "checking" });
  const result = await checkWithTimeout(() => updater.checkForUpdates(), timeoutMs);
  if (result === TIMED_OUT) return { action: "open", reason: "timeout" };
  if (!result?.isUpdateAvailable) return { action: "open", reason: "current" };

  const version = result.updateInfo.version;
  onState({ phase: "downloading", version, percent: 0 });
  const progress = info => onState({ phase: "downloading", version, percent: Math.max(0, Math.min(100, Math.floor(info.percent || 0))) });
  updater.on("download-progress", progress);
  try {
    await updater.downloadUpdate(result.cancellationToken);
  } finally {
    updater.off("download-progress", progress);
  }
  onState({ phase: "installing", version, percent: 100 });
  return { action: "install", version };
}

module.exports = { runStartupUpdate };
