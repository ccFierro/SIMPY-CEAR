(function () {
  "use strict";

  let active = null;
  let timer = null;

  function dismiss() {
    if (timer) clearTimeout(timer);
    timer = null;
    active?.remove();
    active = null;
  }

  function show(message, { type = "error", within = document.body, duration = 12000 } = {}) {
    dismiss();
    const notice = document.createElement("div");
    notice.className = `app-notification app-notification-${type}`;
    notice.setAttribute("role", type === "error" ? "alert" : "status");

    const symbol = document.createElement("span");
    symbol.className = "app-notification-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = type === "error" ? "!" : "✓";

    const text = document.createElement("span");
    text.className = "app-notification-message";
    text.textContent = String(message);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "app-notification-close";
    close.setAttribute("aria-label", "Cerrar notificación");
    close.textContent = "×";
    close.addEventListener("click", dismiss);

    notice.append(symbol, text, close);
    within.append(notice);
    active = notice;
    if (duration > 0) timer = setTimeout(dismiss, duration);
    return notice;
  }

  window.RoboLabNotifications = { show, dismiss };
})();
