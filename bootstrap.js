"use strict";
(async () => {
  window.roboticalabBoot = await PythonRuntime.initialize();
  for (const file of ["app.js", "coppelia-panel.js", "notifications.js", "pose-marker.js", "robot-jog.js", "point-preview.js", "python-reference.js"]) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = file;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${file}`));
      document.body.append(script);
    });
  }
})();
