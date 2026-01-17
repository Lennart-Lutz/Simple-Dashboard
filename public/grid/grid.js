// public/grid/grid.js

export function createGrid({
  mountEl,
  cell = 80,
  cols = 40,

  cellInset = 4,

  overlayCols = 40,
  overlayRows = 12,
  overlayBreakpoints = null,

  padding = { left: 12, right: 12, top: 12, bottom: 12 },
  paddingBreakpoints = null,

  onChange = async () => { },
}) {
  if (!mountEl) throw new Error("createGrid: mountEl is required");

  let isEditing = false;
  let items = [];
  let dragging = null;
  let saving = false;

  // ---------------- DOM ----------------
  const canvas = document.createElement("div");
  canvas.className = "grid-canvas";
  mountEl.innerHTML = "";
  mountEl.appendChild(canvas);

  const overlay = document.createElement("div");
  overlay.className = "grid-overlay";
  canvas.appendChild(overlay);

  // ---------------- helpers ----------------
  const clone = (v) =>
    typeof structuredClone === "function"
      ? structuredClone(v)
      : JSON.parse(JSON.stringify(v));

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function rectOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function collides(test, ignoreId) {
    return items.some(
      (it) => it.id !== ignoreId && rectOverlap(test, it)
    );
  }

  function pickOverlayDims() {
    if (!overlayBreakpoints) return { cols: overlayCols, rows: overlayRows };
    const w = window.innerWidth;
    for (const bp of overlayBreakpoints) {
      if (w <= bp.maxWidth) return { cols: bp.cols, rows: bp.rows };
    }
    return { cols: overlayCols, rows: overlayRows };
  }

  function normalizePad(p) {
    return {
      left: p?.left ?? 0,
      right: p?.right ?? 0,
      top: p?.top ?? 0,
      bottom: p?.bottom ?? 0,
    };
  }

  function pickPadding() {
    if (!paddingBreakpoints) return normalizePad(padding);
    const w = window.innerWidth;
    for (const bp of paddingBreakpoints) {
      if (w <= bp.maxWidth) return normalizePad(bp.padding);
    }
    return normalizePad(padding);
  }

  function applyCssVars() {
    const pad = pickPadding();
    canvas.style.setProperty("--grid-cell", `${cell}px`);
    canvas.style.setProperty("--cell-inset", `${cellInset}px`);
    canvas.style.setProperty("--grid-pad-left", `${pad.left}px`);
    canvas.style.setProperty("--grid-pad-right", `${pad.right}px`);
    canvas.style.setProperty("--grid-pad-top", `${pad.top}px`);
    canvas.style.setProperty("--grid-pad-bottom", `${pad.bottom}px`);
    return pad;
  }

  // ---------------- sizing ----------------
  function updateCanvasSize() {
    const pad = applyCssVars();
    const { rows: oRows } = pickOverlayDims();

    const maxRight = items.reduce((m, it) => Math.max(m, it.x + it.w), 0);
    const maxBottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);

    const neededCols = Math.max(cols, maxRight + 1);
    const neededRows = Math.max(oRows, maxBottom + 1);

    const pxW = neededCols * cell + pad.left + pad.right;
    const pxH = neededRows * cell + pad.top + pad.bottom;

    canvas.style.width = `${pxW}px`;
    canvas.style.height = `${pxH}px`;
  }

  // ---------------- overlay ----------------
  function renderOverlay() {
    overlay.innerHTML = "";
    if (!isEditing) return;

    const pad = pickPadding();
    const { cols: oCols, rows: oRows } = pickOverlayDims();

    const frag = document.createDocumentFragment();
    for (let y = 0; y < oRows; y++) {
      for (let x = 0; x < oCols; x++) {
        const c = document.createElement("div");
        c.className = "cell";
        c.style.left = `${pad.left + x * cell}px`;
        c.style.top = `${pad.top + y * cell}px`;
        frag.appendChild(c);
      }
    }
    overlay.appendChild(frag);
  }

  // ---------------- items ----------------
  function applyItemStyle(el, it) {
    const pad = pickPadding();
    el.style.left = `${pad.left + it.x * cell}px`;
    el.style.top = `${pad.top + it.y * cell}px`;
    el.style.width = `${it.w * cell}px`;
    el.style.height = `${it.h * cell}px`;
  }

  function renderItem(it) {
    const el = document.createElement("div");
    el.className = "grid-item";
    el.dataset.id = it.id;

    applyItemStyle(el, it);

    const widget = document.createElement("div");
    widget.className = "widget";
    widget.innerHTML = `<div class="hint">${it.id}</div>`;
    el.appendChild(widget);

    // -------- pointerdown --------
    el.addEventListener("pointerdown", (ev) => {
      if (!isEditing || saving || ev.button !== 0) return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);

      const pad = pickPadding();
      const rCanvas = canvas.getBoundingClientRect();
      const rEl = el.getBoundingClientRect();

      dragging = {
        id: it.id,
        start: clone(it),
        grab: {
          x: ev.clientX - rEl.left,
          y: ev.clientY - rEl.top,
        },
        origin: {
          x: rCanvas.left + pad.left,
          y: rCanvas.top + pad.top,
        },
      };

      el.classList.add("dragging");
    });

    // -------- pointermove (SNAPPED) --------
    el.addEventListener("pointermove", (ev) => {
      if (!dragging || dragging.id !== it.id) return;
      ev.preventDefault();

      const { cols: oCols, rows: oRows } = pickOverlayDims();
      const pad = pickPadding();

      const px = ev.clientX - dragging.origin.x - dragging.grab.x;
      const py = ev.clientY - dragging.origin.y - dragging.grab.y;

      const maxX = Math.max(0, oCols - dragging.start.w);
      const maxY = Math.max(0, oRows - dragging.start.h);

      const x = clamp(Math.round(px / cell), 0, maxX);
      const y = clamp(Math.round(py / cell), 0, maxY);

      dragging.preview = { x, y };

      el.style.left = `${pad.left + x * cell}px`;
      el.style.top = `${pad.top + y * cell}px`;
    });

    // -------- pointerup --------
    el.addEventListener("pointerup", async (ev) => {
      if (!dragging || dragging.id !== it.id) return;
      ev.preventDefault();
      el.releasePointerCapture(ev.pointerId);
      el.classList.remove("dragging");

      const idx = items.findIndex((x) => x.id === it.id);
      if (idx === -1) {
        dragging = null;
        return;
      }

      const start = dragging.start; // original item
      const nextItem = clone(items[idx]);
      nextItem.x = dragging.preview?.x ?? start.x;
      nextItem.y = dragging.preview?.y ?? start.y;

      // If collision, hard revert (no persistence attempt)
      if (collides(nextItem, it.id)) {
        applyItemStyle(el, start);
        dragging = null;
        return;
      }

      // Build next items array WITHOUT committing
      const nextItems = clone(items);
      nextItems[idx] = nextItem;

      saving = true;
      try {
        // Persist first (must throw on failure)
        await onChange(clone(nextItems));

        // Commit only on success
        items = nextItems;
        updateCanvasSize();
        renderAll();
      } catch (e) {
        // Rollback visuals to start position
        applyItemStyle(el, start);
        // Optional: ensure any preview doesn't linger
        throw e;
      } finally {
        saving = false;
        dragging = null;
      }
    });


    el.addEventListener("pointercancel", () => {
      if (!dragging || dragging.id !== it.id) return;
      applyItemStyle(el, dragging.start);
      dragging = null;
    });

    return el;
  }

  function renderAll() {
    [...canvas.querySelectorAll(".grid-item")].forEach((n) => n.remove());
    renderOverlay();
    items.forEach((it) => canvas.appendChild(renderItem(it)));
  }

  // ---------------- public API ----------------
  function setEditMode(v) {
    isEditing = v;
    mountEl.classList.toggle("is-editing", v);
    renderOverlay();
  }

  function setItems(next) {
    items = clone(next || []);
    updateCanvasSize();
    renderAll();
  }

  function getItems() {
    return clone(items);
  }

  async function addItem(it) {
    const next = clone(items);
    next.push(clone(it));

    saving = true;
    try {
      await onChange(clone(next));
      items = next;
      updateCanvasSize();
      renderAll();
    } finally {
      saving = false;
    }
  }

  window.addEventListener("resize", () => {
    updateCanvasSize();
    if (isEditing) renderAll();
  });

  // init
  updateCanvasSize();
  renderAll();

  return {
    setEditMode,
    setItems,
    getItems,
    addItem,
    get isEditing() {
      return isEditing;
    },
  };
}
