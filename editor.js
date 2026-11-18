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
    editor.addEventListener("input", () => sync(editor));
    new ResizeObserver(() => sync(editor)).observe(editor);
    editor.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
        event.preventDefault();
        if (!editor.readOnly) complete(editor);
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

  async function complete(editor) {
    const cell = editor.closest(".code-cell");
    cell.querySelector(".completion-list")?.remove();
    if (!global.PythonRuntime?.available) return;
    const original = editor.value;
    const position = editor.selectionStart;
    const editors = [...document.querySelectorAll(".cell-editor")];
    const previous = editors.slice(0, editors.indexOf(editor)).map(item => item.value).join("\n\n");
    const prefix = `import numpy as np\nfrom roboticalab import *\n${previous}\n`;
    const before = (prefix + original).slice(0, prefix.length + position).split("\n");
    const list = document.createElement("div");
    list.className = "completion-list";
    list.setAttribute("aria-label", "Sugerencias de Python");
    list.textContent = "Buscando sugerencias…";
    cell.querySelector(".cell-code-wrap").after(list);
    try {
      const result = await PythonRuntime.complete({ source: prefix + original, line: before.length, column: before.at(-1).length });
      if (editor.value !== original || editor.selectionStart !== position || !cell.isConnected) { list.remove(); return; }
      list.replaceChildren();
      if (!result.items.length) list.textContent = "Sin sugerencias para esta posición.";
      result.items.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${item.name} · ${item.type}`;
        button.addEventListener("click", () => {
          if (!editor.readOnly && editor.value === original) replace(editor, { start: position, end: position, text: item.complete });
          list.remove();
        });
        button.addEventListener("keydown", event => {
          if (event.key === "Escape") { list.remove(); editor.focus(); }
          if (event.key === "ArrowDown") { event.preventDefault(); (button.nextElementSibling || list.firstElementChild)?.focus(); }
          if (event.key === "ArrowUp") { event.preventDefault(); (button.previousElementSibling || list.lastElementChild)?.focus(); }
        });
        list.append(button);
      });
      list.firstElementChild?.focus();
    } catch (error) { list.textContent = error.message; }
    const dismiss = event => {
      if (event.type === "input" || event.key === "Escape") { list.remove(); editor.removeEventListener("input", dismiss); editor.removeEventListener("keydown", dismiss); }
    };
    editor.addEventListener("input", dismiss);
    editor.addEventListener("keydown", dismiss);
  }

  const api = { highlight, editForKey, attach, sync, replace };
  global.RoboticaEditor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
