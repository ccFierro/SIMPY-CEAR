"use strict";

const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("desktop-window");
  for (const action of ["minimize", "maximize", "close"]) {
    document.getElementById(`window-${action}`)?.addEventListener("click", () => {
      ipcRenderer.send("simpy:window-action", action);
    });
  }
});
