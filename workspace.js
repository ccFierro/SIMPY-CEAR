(function (global) {
  "use strict";
  const byId = id => document.getElementById(id);
  const diagnostics = new Map();
  let editorWidth = 42;

  function selectTab(id) {
    document.querySelectorAll("[data-result-tab]").forEach(tab => {
      const selected = tab.dataset.resultTab === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      byId(tab.dataset.resultTab).hidden = !selected;
    });
  }

  function renderDiagnostics() {
    const panel = byId("diagnosticsPanel");
    panel.replaceChildren();
    byId("diagnosticCount").textContent = String(diagnostics.size);
    for (const [cell, problem] of diagnostics) {
      const entry = document.createElement("button");
      entry.className = "diagnostic-entry";
      entry.textContent = `Celda ${cell.dataset.displayNumber || cell.dataset.cellNumber} · línea ${problem.line}: ${problem.simpleMessage || problem.message}`;
      entry.addEventListener("click", () => {
        setExpanded(false);
        cell.scrollIntoView({ block: "nearest" });
        global.RoboticaWorkspace.onFocusDiagnostic(problem, cell.querySelector(".cell-editor"));
      });
      panel.append(entry);
    }
    if (!diagnostics.size) panel.textContent = "Sin diagnósticos.";
  }

  function clearDiagnostic(cell) {
    if (cell) {
      diagnostics.delete(cell);
      delete cell.dataset.errorLine;
      cell.querySelector(".inline-diagnostic")?.remove();
      cell.classList.remove("error");
    } else {
      for (const existing of [...diagnostics.keys()]) clearDiagnostic(existing);
      diagnostics.clear();
    }
    renderDiagnostics();
  }

  function reportDiagnostic(cell, problem) {
    clearDiagnostic(cell);
    diagnostics.set(cell, problem);
    cell.dataset.errorLine = String(problem.line);
    const inline = document.createElement("div");
    inline.className = "inline-diagnostic";
    inline.setAttribute("role", "alert");
    inline.textContent = `Línea ${problem.line}: ${problem.simpleMessage || problem.message}`;
    cell.querySelector(".cell-code-wrap").after(inline);
    renderDiagnostics();
    selectTab("diagnosticsPanel");
    setResultsVisible(true);
  }

  function setExpanded(expanded) {
    document.body.classList.toggle("graph-expanded", expanded);
    byId("layoutToggle").textContent = expanded ? "Mostrar cuaderno" : document.body.classList.contains("view-coppelia") ? "Ampliar mandos" : "Ampliar gráfico";
    global.RoboticaIcons?.add(byId("layoutToggle"), "expand");
    byId("layoutToggle").setAttribute("aria-pressed", String(expanded));
  }

  function setResultsVisible(visible) {
    byId("resultsBody").hidden = !visible;
    byId("toggleResults").textContent = visible ? "Ocultar" : "Mostrar";
    global.RoboticaIcons?.add(byId("toggleResults"), "eye");
    byId("toggleResults").setAttribute("aria-expanded", String(visible));
  }

  function setWidth(width) {
    editorWidth = Math.max(28, Math.min(65, width));
    document.querySelector(".workspace").style.setProperty("--editor-width", `${editorWidth}%`);
    byId("panelDivider").setAttribute("aria-valuenow", String(Math.round(editorWidth)));
    try { localStorage.setItem("roboticalab.editorWidth", String(editorWidth)); } catch {}
  }

  function init() {
    try { const width = Number(localStorage.getItem("roboticalab.editorWidth")); if (width) setWidth(width); } catch {}
    byId("layoutToggle").addEventListener("click", () => setExpanded(!document.body.classList.contains("graph-expanded")));
    byId("toggleResults").addEventListener("click", () => setResultsVisible(byId("resultsBody").hidden));
    byId("guideButton").addEventListener("click", () => byId("referenceTrigger").click());
    const tabs = [...document.querySelectorAll("[data-result-tab]")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => { selectTab(tab.dataset.resultTab); setResultsVisible(true); });
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const target = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        target.click(); target.focus();
      });
    });
    const divider = byId("panelDivider");
    divider.addEventListener("pointerdown", event => { divider.setPointerCapture(event.pointerId); document.body.classList.add("resizing-panels"); });
    divider.addEventListener("pointermove", event => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      const rect = document.querySelector(".workspace").getBoundingClientRect();
      setWidth(100 * (event.clientX - rect.left) / rect.width);
    });
    divider.addEventListener("pointerup", event => { divider.releasePointerCapture(event.pointerId); document.body.classList.remove("resizing-panels"); });
    divider.addEventListener("lostpointercapture", () => document.body.classList.remove("resizing-panels"));
    divider.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      setWidth(event.key === "Home" ? 28 : event.key === "End" ? 65 : editorWidth + (event.key === "ArrowLeft" ? -2 : 2));
    });
    divider.addEventListener("dblclick", () => setWidth(42));

    let matches = [];
    let matchIndex = -1;
    const searchInput = byId("codeSearchInput");
    function search(reset = true, direction = 1) {
      const query = searchInput.value.toLocaleLowerCase("es");
      if (reset) {
        matches = [];
        matchIndex = -1;
        if (query) document.querySelectorAll(".cell-editor").forEach(editor => {
          const source = editor.value.toLocaleLowerCase("es");
          for (let index = source.indexOf(query); index >= 0; index = source.indexOf(query, index + query.length)) matches.push({ editor, index });
        });
      }
      if (matches.length) {
        matchIndex = (matchIndex + direction + matches.length) % matches.length;
        const { editor, index } = matches[matchIndex];
        editor.setSelectionRange(index, index + query.length);
        editor.scrollTop = Math.max(0, (editor.value.slice(0, index).split("\n").length - 2) * 21);
        RoboticaEditor.sync(editor);
        editor.closest(".code-cell").scrollIntoView({ block: "nearest" });
        if (!reset) editor.focus();
      }
      byId("searchCount").textContent = query ? `${matches.length ? matchIndex + 1 : 0} / ${matches.length}` : "";
    }
    function openSearch() { setExpanded(false); byId("codeSearch").hidden = false; searchInput.focus(); searchInput.select(); }
    byId("findCode").addEventListener("click", openSearch);
    byId("closeSearch").addEventListener("click", () => { byId("codeSearch").hidden = true; byId("findCode").focus(); });
    byId("searchNext").addEventListener("click", () => search(false));
    byId("searchPrevious").addEventListener("click", () => search(false, -1));
    searchInput.addEventListener("input", () => search());
    searchInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); search(false, event.shiftKey ? -1 : 1); } });
    byId("notebook").addEventListener("input", () => { if (!byId("codeSearch").hidden) search(); });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && (event.target.classList.contains("cell-editor") || event.target === searchInput)) { event.preventDefault(); openSearch(); }
      if (event.key === "Escape") byId("codeSearch").hidden = true;
    });
  }
  global.RoboticaWorkspace = { init, selectTab, setResultsVisible, reportDiagnostic, clearDiagnostic, setExpanded };
})(window);
