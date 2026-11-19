(function (global) {
  "use strict";

  const escape = text => text.replace(/[&<>]/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[value]));
  const keywords = new Set("import from as and or not True False None if elif else for while def class return yield try except finally raise with lambda pass break continue in is global nonlocal async await assert del match case".split(" "));
  function highlight(source) {
    const tokens = /#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/g;
    let html = "";
    let cursor = 0;
    for (const match of source.matchAll(tokens)) {
      const token = match[0];
      const kind = token[0] === "#" ? "comment" : /^["']/.test(token) ? "string" : /^\d/.test(token) ? "number" : keywords.has(token) ? "keyword" : /^\s*\(/.test(source.slice(match.index + token.length)) || token === "np" ? "function" : "name";
      html += escape(source.slice(cursor, match.index)) + `<span class="syntax-${kind}">${escape(token)}</span>`;
      cursor = match.index + token.length;
    }
    return html + escape(source.slice(cursor)) + "\n";
  }

  function editForKey(value, start, end, key, shift = false) {
    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const prefix = value.slice(lineStart, start);
    if (key === "Enter") {
      const indent = prefix.match(/^\s*/)[0];
      const extra = /[([{:]\s*$/.test(prefix) ? "    " : "";
      const paired = extra && /^[)\]}]/.test(value.slice(end));
      const text = `\n${indent}${extra}${paired ? `\n${indent}` : ""}`;
      return { start, end, text, cursor: start + 1 + indent.length + extra.length };
    }
    if (key === "Tab") {
      if (selected.includes("\n") || shift) {
        const block = value.slice(lineStart, end);
        const lines = block.split("\n");
        const changed = lines.map(line => shift ? line.replace(/^( {1,4}|\t)/, "") : `    ${line}`);
        return { start: lineStart, end, text: changed.join("\n"), select: true };
      }
      return { start, end, text: "    " };
    }
    if (start === end && ")]}'\"".includes(key) && value[start] === key) return { skip: true, cursor: start + 1 };
    if (pairs[key]) {
      // Leave quotes inside words/strings and brackets inside comments to native input.
      if (prefix.includes("#") || (/['"]/.test(key) && /[\w'"\\]/.test(value[start - 1] || ""))) return null;
      return { start, end, text: key + selected + pairs[key], cursor: start + 1, selectionEnd: end + 1 };
    }
    if (key === "Backspace" && start === end && pairs[value[start - 1]] === value[start]) return { start: start - 1, end: start + 1, text: "" };
    return null;
  }

  function replace(editor, edit) {
    if (edit.skip) { editor.setSelectionRange(edit.cursor, edit.cursor); return; }
    editor.focus();
    editor.setSelectionRange(edit.start, edit.end);
    // Native insertText preserves the browser's undo stack; fallback supports other engines.
    if (!document.execCommand("insertText", false, edit.text)) {
      editor.setRangeText(edit.text, edit.start, edit.end, "end");
    }
    const cursor = edit.cursor ?? edit.start + edit.text.length;
    editor.setSelectionRange(edit.select ? edit.start : cursor, edit.select ? cursor : edit.selectionEnd ?? cursor);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function sync(editor) {
    const layer = editor.parentElement.querySelector(".syntax-layer");
    if (!layer) return;
    layer.style.width = `${editor.clientWidth}px`;
    layer.style.height = `${editor.clientHeight}px`;
    layer.innerHTML = highlight(editor.value);
    layer.scrollTop = editor.scrollTop;
    layer.scrollLeft = editor.scrollLeft;
  }

  let activeCompletion = null;
  let completionRequest = 0;
  const completionTimers = new WeakMap();
  const completionVersions = new WeakMap();

  function dismissCompletion() {
    if (!activeCompletion) return;
    activeCompletion.list.remove();
    activeCompletion.editor.removeAttribute("aria-expanded");
    activeCompletion = null;
  }

  function memberPrefix(editor) {
    if (editor.selectionStart !== editor.selectionEnd) return null;
    const line = editor.value.slice(0, editor.selectionStart).split("\n").at(-1);
    const match = line.match(/(?:^|[^\w])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.([A-Za-z_]\w*)?$/);
    if (!match) return null;
    const before = line.slice(0, match.index);
    if (before.includes("#") || (before.match(/(?<!\\)["']/g) || []).length % 2) return null;
    return match[2] || "";
  }

  function scheduleCompletion(editor, event) {
    clearTimeout(completionTimers.get(editor));
    completionVersions.set(editor, (completionVersions.get(editor) || 0) + 1);
    dismissCompletion();
    if (editor.readOnly || !["insertText", "deleteContentBackward"].includes(event.inputType)) return;
    if (memberPrefix(editor) === null) return;
    completionTimers.set(editor, setTimeout(() => complete(editor, true), 170));
  }

  function chooseCompletion(index) {
    const state = activeCompletion;
    if (!state) return;
    const item = state.items[index];
    if (!item || state.editor.readOnly) return;
    dismissCompletion();
    const suffix = item.complete + (item.type === "function" ? "()" : "");
    replace(state.editor, { start: state.position, end: state.position, text: suffix,
      cursor: state.position + suffix.length - (item.type === "function" ? 1 : 0) });
  }

  function selectCompletion(index) {
    const state = activeCompletion;
    if (!state) return;
    state.selected = (index + state.items.length) % state.items.length;
    state.list.querySelectorAll("button").forEach((button, buttonIndex) => {
      button.classList.toggle("selected", buttonIndex === state.selected);
      button.setAttribute("aria-selected", String(buttonIndex === state.selected));
    });
    state.list.querySelectorAll("button")[state.selected]?.scrollIntoView({ block: "nearest" });
  }

  function positionCompletion(list, editor) {
    const before = editor.value.slice(0, editor.selectionStart).split("\n");
    const rect = editor.getBoundingClientRect();
    const width = Math.min(300, innerWidth - 20);
    const x = rect.left + 12 + before.at(-1).length * 7.8 - editor.scrollLeft;
    const y = rect.top + 12 + (before.length - 1) * 21 - editor.scrollTop + 21;
    list.style.width = `${width}px`;
    list.style.left = `${Math.max(10, Math.min(x, innerWidth - width - 10))}px`;
    list.style.top = `${Math.max(10, Math.min(y, innerHeight - Math.min(list.scrollHeight, 230) - 10))}px`;
  }

  function attach(editor) {
    const surface = document.createElement("div");
    surface.className = "editor-surface";
    const layer = document.createElement("pre");
    layer.className = "syntax-layer";
    layer.setAttribute("aria-hidden", "true");
    editor.replaceWith(surface);
    surface.append(layer, editor);
    editor.wrap = "off";
    editor.autocomplete = "off";
    editor.setAttribute("autocapitalize", "off");
    editor.addEventListener("scroll", () => sync(editor));
    editor.addEventListener("input", event => { sync(editor); scheduleCompletion(editor, event); });
    editor.addEventListener("scroll", () => {
      completionVersions.set(editor, (completionVersions.get(editor) || 0) + 1);
      dismissCompletion();
    });
    editor.addEventListener("blur", event => {
      if (!activeCompletion?.list.contains(event.relatedTarget)) dismissCompletion();
    });
    new ResizeObserver(() => sync(editor)).observe(editor);
    editor.addEventListener("keydown", event => {
      if (activeCompletion?.editor === editor) {
        if (event.key === "Escape") { event.preventDefault(); dismissCompletion(); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          selectCompletion(activeCompletion.selected + (event.key === "ArrowDown" ? 1 : -1));
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault(); chooseCompletion(activeCompletion.selected); return;
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
        event.preventDefault();
        if (!editor.readOnly) complete(editor, false);
        return;
      }
      if (event.defaultPrevented || event.isComposing || editor.readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.shiftKey && event.key === "Enter") return;
      const edit = editForKey(editor.value, editor.selectionStart, editor.selectionEnd, event.key, event.shiftKey);
      if (!edit) return;
      event.preventDefault();
      replace(editor, edit);
    });
    sync(editor);
  }

  async function complete(editor, automatic = false) {
    const cell = editor.closest(".code-cell");
    dismissCompletion();
    if (!global.PythonRuntime?.available) return;
    const original = editor.value;
    const position = editor.selectionStart;
    const version = completionVersions.get(editor) || 0;
    const request = ++completionRequest;
    const editors = [...document.querySelectorAll(".cell-editor")];
    const previous = editors.slice(0, editors.indexOf(editor)).map(item => item.value).join("\n\n");
    const prefix = `import numpy as np\nfrom roboticalab import *\n${previous}\n`;
    const before = (prefix + original).slice(0, prefix.length + position).split("\n");
    try {
      const result = await PythonRuntime.complete({ source: prefix + original, line: before.length, column: before.at(-1).length });
      if (editor.value !== original || editor.selectionStart !== position || !cell.isConnected || document.activeElement !== editor ||
        version !== (completionVersions.get(editor) || 0) || request !== completionRequest) return;
      const items = (result.items || []).filter(item => !item.name.startsWith("_") && item.complete !== "");
      if (!items.length) return;
      const list = document.createElement("div");
      list.className = "completion-list";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Sugerencias de Python");
      items.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.innerHTML = `<span>${escape(item.name)}</span><small>${escape(item.type)}</small>`;
        button.addEventListener("mousedown", event => event.preventDefault());
        button.addEventListener("click", () => chooseCompletion(index));
        list.append(button);
      });
      document.body.append(list);
      activeCompletion = { editor, list, items, position, selected: 0 };
      editor.setAttribute("aria-expanded", "true");
      positionCompletion(list, editor);
      selectCompletion(0);
    } catch (error) { if (!automatic) global.console?.warn("Autocompletado:", error); }
  }

  const api = { highlight, editForKey, attach, sync, replace };
  global.RoboticaEditor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
