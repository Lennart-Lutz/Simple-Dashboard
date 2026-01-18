// public/ui/addWidgetModal.js
//
// Generic widget creation modal driven by widget meta.fields.
//
// Layout:
// - Bootstrap grid layout (wrap, 2 columns on md+ for simple fields)
// - Complex editors span full width (col-12)
//
// Supported field kinds (case-insensitive):
// - text            -> string
// - number          -> number (empty => "")
// - select          -> string|number (based on options[0].value type)
// - ranges          -> [{ from:number, to:number }, ...]
// - colorranges     -> [{ from:number, to:number, color:string }, ...]  (hex)
// - singleValueSource    -> { endpoint:string, label?:string, paramKey?:string, paramValue?:string }
// - multiValueSource     -> [{ endpoint:string, label?:string, paramKey?:string, paramValue?:string }, ...] (max 3)
// - multiSeriesSource
//                   -> [{ endpoint:string, label:string, color:string, paramKey?:string, paramValue?:string }, ...] (max 3)
//                      Notes: label required; color required (defaults if empty).
//
// Color UX (for any kind that has a color):
// - User enters a hex string in a text box (default set, e.g. #0d6efd)
// - A small swatch is shown to the right (visual preview)
// - Clicking the swatch opens a native color picker and syncs back to the hex input

export function createAddWidgetModal({ getWidgetMetas, getWidgetMeta, onAdd }) {
  const elModal = document.getElementById("addWidgetModal");
  const elBtnAdd = document.getElementById("addWidgetConfirm");
  const elType = document.getElementById("addWidgetType");
  const elOptions = document.getElementById("addWidgetOptions");

  if (!elModal || !elBtnAdd || !elType || !elOptions) throw new Error("AddWidget modal elements missing.");
  if (typeof bootstrap === "undefined" || !bootstrap.Modal) throw new Error("Bootstrap JS Modal not available.");

  const modal = bootstrap.Modal.getOrCreateInstance(elModal);

  // ---------------- utils ----------------
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fieldId(key) {
    return `addWidgetField_${key}`;
  }

  function renderHelp(field) {
    const help = field.help ? `<div class="form-text">${esc(field.help)}</div>` : "";
    const helpCode = field.helpCode ? `<div class="form-text"><code>${esc(field.helpCode)}</code></div>` : "";
    if (field.help && field.helpCode) {
      return `<div class="form-text">${esc(field.help)} <code>${esc(field.helpCode)}</code></div>`;
    }
    return help || helpCode;
  }

  function colClass(field) {
    const c = Number(field?.col);
    if (Number.isFinite(c) && c >= 1 && c <= 12) return `col-12 col-md-${c}`;
    return "col-12 col-md-6";
  }

  function reqMark(field) {
    return field.required ? ` <span class="text-danger">*</span>` : "";
  }

  function getRootFor(field) {
    return document.getElementById(fieldId(field.key));
  }

  function normalizeMaxRows(field, fallback = 3) {
    const n = Number(field?.maxRows);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(3, Math.round(n)));
  }

  function normalizeHexColor(v, fallback = "#0d6efd") {
    const s = String(v ?? "").trim();
    if (!s) return fallback;
    // accept #RGB or #RRGGBB
    if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    return fallback;
  }

  function makeHexColorInput({ key = "color", value = "#0d6efd", placeholder = "#RRGGBB" } = {}) {
    const hex = normalizeHexColor(value, "#0d6efd");
    return `
      <div class="input-group input-group-sm">
        <input type="text"
               class="form-control"
               placeholder="${esc(placeholder)}"
               data-k="${esc(key)}"
               value="${esc(hex)}"
               autocomplete="off" />
        <button class="btn btn-outline-secondary"
                type="button"
                title="Pick color"
                data-action="color-pick"
                style="padding: 0.15rem 0.4rem;">
          <span data-k="${esc(key)}-swatch"
                style="display:inline-block;width:16px;height:16px;border-radius:3px;border:1px solid rgba(0,0,0,.2);background:${esc(hex)};"></span>
        </button>
        <input type="color"
               class="d-none"
               data-k="${esc(key)}-picker"
               value="${esc(hex)}" />
      </div>
    `;
  }

  function syncColorUi(rowEl, key = "color") {
    const elHex = rowEl.querySelector(`[data-k='${key}']`);
    const elSwatch = rowEl.querySelector(`[data-k='${key}-swatch']`);
    const elPicker = rowEl.querySelector(`[data-k='${key}-picker']`);
    if (!elHex || !elSwatch) return;

    const hex = normalizeHexColor(elHex.value, "#0d6efd");
    elSwatch.style.background = hex;
    if (elPicker) elPicker.value = hex;
  }

  // ---------------- source editors (generic row list) ----------------
  function sourceEditorTemplate({ id, label, required, helpHtml, maxRows, headerText, addAction }) {
    return `
      <div class="col-12 mb-1">
        <label class="form-label">${esc(label)}${required ? reqMark({ required: true }) : ""}</label>

        <div id="${id}" class="border rounded-3 p-2">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="text-muted small">${esc(headerText || "")}</div>
            <button type="button"
                    class="btn btn-sm btn-outline-dark"
                    data-action="${esc(addAction)}"
                    data-max="${esc(maxRows)}">
              Add
            </button>
          </div>

          <div class="src-list"></div>
        </div>

        ${helpHtml || ""}
      </div>
    `;
  }

  function makeSourceRow({ endpoint = "", label = "", paramKey = "", paramValue = "", removable = true } = {}) {
    // endpoint (wide) + label + key + value + remove
    // key/value optional; but if one is set, require both.
    return `
      <div class="src-row row g-2 align-items-center mb-2">
        <div class="col-12">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="/api"
                 data-k="endpoint"
                 value="${esc(endpoint)}"
                 autocomplete="off" />
        </div>

        <div class="col-12">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="label (optional)"
                 data-k="label"
                 value="${esc(label)}"
                 autocomplete="off" />
        </div>

        <div class="col-6">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="key"
                 data-k="paramKey"
                 value="${esc(paramKey)}"
                 autocomplete="off" />
        </div>

        <div class="col-6">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="value"
                 data-k="paramValue"
                 value="${esc(paramValue)}"
                 autocomplete="off" />
        </div>

        <div class="col-12 d-flex justify-content-end">
          ${removable
        ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="src-remove">&times;</button>`
        : ``
      }
        </div>
      </div>
    `;
  }

  function makeTimeseriesRow({
    endpoint = "",
    label = "",
    color = "#0d6efd",
    paramKey = "",
    paramValue = "",
    removable = true,
  } = {}) {
    return `
      <div class="ts-row border rounded-3 p-2 mb-2">
        <!-- Row 1: endpoint + remove -->
        <div class="row g-2 align-items-center">
          <div class="col-11">
            <input type="text"
                  class="form-control form-control-sm"
                  placeholder="/api"
                  data-k="endpoint"
                  value="${esc(endpoint)}"
                  autocomplete="off" />
          </div>

          <div class="col-1 d-flex justify-content-end">
            ${removable
          ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="ts-remove">&times;</button>`
          : ``
        }
          </div>
        </div>

        <!-- Row 2: key + value -->
        <div class="row g-2 align-items-center mt-0">
          <div class="col-6">
            <input type="text"
                  class="form-control form-control-sm"
                  placeholder="key"
                  data-k="paramKey"
                  value="${esc(paramKey)}"
                  autocomplete="off" />
          </div>

          <div class="col-6">
            <input type="text"
                  class="form-control form-control-sm"
                  placeholder="value"
                  data-k="paramValue"
                  value="${esc(paramValue)}"
                  autocomplete="off" />
          </div>
        </div>

        <!-- Row 3: label + color -->
        <div class="row g-2 align-items-center mt-0">
          <div class="col-12">
            <input type="text"
                  class="form-control form-control-sm"
                  placeholder="label"
                  data-k="label"
                  value="${esc(label)}"
                  autocomplete="off" />
          </div>

          <div class="col-12">
            ${makeHexColorInput({ key: "color", value: color })}
          </div>
        </div>
      </div>
    `;
  }

  function addRow(rootEl, { maxRows, rowHtml, rowSelector, focusSelector }) {
    const list = rootEl.querySelector(".src-list");
    if (!list) return;

    const rows = list.querySelectorAll(rowSelector);
    if (rows.length >= maxRows) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = rowHtml;
    const row = wrap.firstElementChild;
    if (!row) return;

    list.appendChild(row);
    row.querySelector(focusSelector)?.focus?.();

    // Sync color preview for newly added rows (if present)
    if (row.classList.contains("ts-row")) syncColorUi(row, "color");
  }

  function readRows(rootEl, { rowSelector, parseRow }) {
    const rows = [...rootEl.querySelectorAll(rowSelector)];
    return rows.map((row) => parseRow(row)).filter(Boolean);
  }

  function parseBaseRow(row, { requireLabel = false, includeColor = false } = {}) {
    const endpoint = String(row.querySelector("[data-k='endpoint']")?.value || "").trim();
    const label = String(row.querySelector("[data-k='label']")?.value || "").trim();
    const paramKey = String(row.querySelector("[data-k='paramKey']")?.value || "").trim();
    const paramValue = String(row.querySelector("[data-k='paramValue']")?.value || "").trim();
    const color = includeColor ? normalizeHexColor(row.querySelector("[data-k='color']")?.value, "#0d6efd") : null;

    const touched = endpoint || label || paramKey || paramValue || (includeColor && String(color || "").trim());
    if (!touched) return null;

    if (!endpoint) return { __invalid: true, __focus: row.querySelector("[data-k='endpoint']") };

    if (requireLabel && !label) {
      return { __invalid: true, __focus: row.querySelector("[data-k='label']") };
    }

    const hasK = !!paramKey;
    const hasV = !!paramValue;
    if (hasK !== hasV) {
      return {
        __invalid: true,
        __focus: row.querySelector(hasK ? "[data-k='paramValue']" : "[data-k='paramKey']"),
      };
    }

    const out = { endpoint };
    if (label) out.label = label;
    if (includeColor) out.color = color;
    if (hasK && hasV) {
      out.paramKey = paramKey;
      out.paramValue = paramValue;
    }
    return out;
  }

  // ---------------- field renderers ----------------
  const renderers = {
    text(field) {
      const id = fieldId(field.key);
      const label = esc(field.label || field.key);
      const max = field.max ? ` maxlength="${esc(field.max)}"` : "";
      const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";

      return `
        <div class="${colClass(field)} mb-1">
          <label class="form-label">${label}${reqMark(field)}</label>
          <input id="${id}" type="text" class="form-control"${max}${ph} autocomplete="off" />
          ${renderHelp(field)}
        </div>
      `;
    },

    number(field) {
      const id = fieldId(field.key);
      const label = esc(field.label || field.key);
      const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";

      return `
        <div class="${colClass(field)} mb-1">
          <label class="form-label">${label}${reqMark(field)}</label>
          <input id="${id}" type="number" class="form-control"${ph} autocomplete="off" />
          ${renderHelp(field)}
        </div>
      `;
    },

    select(field) {
      const id = fieldId(field.key);
      const label = esc(field.label || field.key);
      const opts = (field.options || [])
        .map((o) => `<option value="${esc(o.value)}">${esc(o.label ?? o.value)}</option>`)
        .join("");

      return `
        <div class="${colClass(field)} mb-1">
          <label class="form-label">${label}${reqMark(field)}</label>
          <select id="${id}" class="form-select">${opts}</select>
          ${renderHelp(field)}
        </div>
      `;
    },

    ranges(field) {
      const id = fieldId(field.key);
      const label = esc(field.label || field.key);

      return `
        <div class="col-12 mb-1">
          <label class="form-label">${label}${reqMark(field)}</label>

          <div id="${id}" class="border rounded-3 p-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-muted small">from / to</div>
              <button type="button" class="btn btn-sm btn-outline-dark" data-action="range-add">Add range</button>
            </div>
            <div class="range-list"></div>
          </div>

          ${renderHelp(field)}
        </div>
      `;
    },

    colorranges(field) {
      const id = fieldId(field.key);
      const label = esc(field.label || field.key);

      return `
        <div class="col-12 mb-1">
          <label class="form-label">${label}${reqMark(field)}</label>

          <div id="${id}" class="border rounded-3 p-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-muted small">from / to / color</div>
              <button type="button" class="btn btn-sm btn-outline-dark" data-action="color-range-add">Add range</button>
            </div>
            <div class="range-list"></div>
          </div>

          ${renderHelp(field)}
        </div>
      `;
    },

    // ---------- new kinds ----------
    singlevaluesource(field) {
      const id = fieldId(field.key);
      return sourceEditorTemplate({
        id,
        label: field.label || field.key,
        required: !!field.required,
        helpHtml: renderHelp(field),
        maxRows: 1,
        headerText: "Entry",
        addAction: "src-add",
      });
    },

    multivaluesource(field) {
      const id = fieldId(field.key);
      const maxRows = normalizeMaxRows(field, 3);
      return sourceEditorTemplate({
        id,
        label: field.label || field.key,
        required: !!field.required,
        helpHtml: renderHelp(field),
        maxRows,
        headerText: "Entry",
        addAction: "src-add",
      });
    },

    multiseriessource(field) {
      const id = fieldId(field.key);
      const maxRows = normalizeMaxRows(field, 3);
      return sourceEditorTemplate({
        id,
        label: field.label || field.key,
        required: !!field.required,
        helpHtml: renderHelp(field),
        maxRows,
        headerText: "Entry",
        addAction: "ts-add",
      });
    },
  };

  // ---------------- field readers ----------------
  const readers = {
    text(field) {
      const el = getRootFor(field);
      if (!el) return undefined;
      return String(el.value || "").trim();
    },

    number(field) {
      const el = getRootFor(field);
      if (!el) return undefined;
      const s = String(el.value || "").trim();
      if (!s) return "";
      return Number(s);
    },

    select(field) {
      const el = getRootFor(field);
      if (!el) return undefined;
      const v = el.value;
      return typeof field.options?.[0]?.value === "number" ? Number(v) : v;
    },

    ranges(field) {
      const root = getRootFor(field);
      if (!root) return [];

      const rows = [...root.querySelectorAll(".range-row")];
      return rows
        .map((row) => {
          const from = Number(row.querySelector("[data-k='from']")?.value);
          const to = Number(row.querySelector("[data-k='to']")?.value);
          if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
          return { from, to };
        })
        .filter(Boolean);
    },

    colorranges(field) {
      const root = getRootFor(field);
      if (!root) return [];

      const rows = [...root.querySelectorAll(".range-row")];
      return rows
        .map((row) => {
          const from = Number(row.querySelector("[data-k='from']")?.value);
          const to = Number(row.querySelector("[data-k='to']")?.value);
          const color = normalizeHexColor(row.querySelector("[data-k='color']")?.value, "#2ecc71");
          if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from) || !color) return null;
          return { from, to, color };
        })
        .filter(Boolean);
    },

    // ---------- new kinds ----------
    singlevaluesource(field) {
      const root = getRootFor(field);
      if (!root) return undefined;

      const rows = readRows(root, {
        rowSelector: ".src-row",
        parseRow: (row) => parseBaseRow(row, { requireLabel: false, includeColor: false }),
      });

      const bad = rows.find((x) => x.__invalid);
      if (bad) {
        bad.__focus?.focus?.();
        return { __invalid: true };
      }

      const first = rows[0] || null;
      return first || "";
    },

    multivaluesource(field) {
      const root = getRootFor(field);
      if (!root) return undefined;

      const rows = readRows(root, {
        rowSelector: ".src-row",
        parseRow: (row) => parseBaseRow(row, { requireLabel: false, includeColor: false }),
      });

      const bad = rows.find((x) => x.__invalid);
      if (bad) {
        bad.__focus?.focus?.();
        return { __invalid: true };
      }

      return rows.length ? rows : "";
    },

    multiseriessource(field) {
      const root = getRootFor(field);
      if (!root) return undefined;

      const rows = readRows(root, {
        rowSelector: ".ts-row",
        parseRow: (row) => parseBaseRow(row, { requireLabel: true, includeColor: true }),
      });

      const bad = rows.find((x) => x.__invalid);
      if (bad) {
        bad.__focus?.focus?.();
        return { __invalid: true };
      }

      return rows.length ? rows : "";
    },
  };

  // ---------------- rendering ----------------
  function renderTypeOptions() {
    const metas = getWidgetMetas() || [];
    const prev = elType.value;

    elType.innerHTML = metas
      .map((m) => `<option value="${esc(m.type)}">${esc(m.label || m.type)}</option>`)
      .join("");

    if (prev) elType.value = prev;
  }

  function renderOptions() {
    const type = elType.value;
    const meta = getWidgetMeta(type);
    if (!meta) {
      elOptions.innerHTML = `<div class="text-muted small">Unknown widget type.</div>`;
      return;
    }

    const fields = meta.fields || [];

    elOptions.innerHTML = `
      <div class="row g-2">
        ${fields
        .map((f) => {
          const kind = String(f.kind || "text").toLowerCase();
          const r = renderers[kind] || renderers.text;
          return r(f);
        })
        .join("")}
      </div>
    `;
  }

  // ---------------- events: dynamic editors (delegated) ----------------
  elOptions.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    // ----- color swatch -> open picker -----
    if (action === "color-pick") {
      const row = btn.closest(".ts-row") || btn.closest(".range-row");
      if (!row) return;

      const picker = row.querySelector("[data-k='color-picker']");
      if (!picker) return;

      syncColorUi(row, "color");
      picker.click();
      return;
    }

    // ----- sources (single/multi) -----
    if (action === "src-add") {
      const root = btn.closest("div[id^='addWidgetField_']");
      if (!root) return;

      const maxRows = Number(btn.dataset.max) || 1;
      const removable = maxRows > 1;

      addRow(root, {
        maxRows,
        rowSelector: ".src-row",
        focusSelector: "[data-k='endpoint']",
        rowHtml: makeSourceRow({ removable }),
      });
      return;
    }

    if (action === "src-remove") {
      btn.closest(".src-row")?.remove();
      return;
    }

    // ----- multiseriessource -----
    if (action === "ts-add") {
      const root = btn.closest("div[id^='addWidgetField_']");
      if (!root) return;

      const maxRows = Number(btn.dataset.max) || 3;

      addRow(root, {
        maxRows,
        rowSelector: ".ts-row",
        focusSelector: "[data-k='endpoint']",
        rowHtml: makeTimeseriesRow({ removable: true }),
      });
      return;
    }

    if (action === "ts-remove") {
      btn.closest(".ts-row")?.remove();
      return;
    }

    // ----- existing range editors -----
    if (action === "color-range-add") {
      const root = btn.closest("div[id^='addWidgetField_']");
      if (!root) return;

      const list = root.querySelector(".range-list");
      if (!list) return;

      const row = document.createElement("div");
      row.className = "range-row row g-2 align-items-center mb-2";
      row.innerHTML = `
        <div class="col-3"><input type="number" class="form-control form-control-sm" placeholder="from" data-k="from"></div>
        <div class="col-3"><input type="number" class="form-control form-control-sm" placeholder="to" data-k="to"></div>
        <div class="col-5">${makeHexColorInput({ key: "color", value: "#2ecc71" })}</div>
        <div class="col-1 d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="range-remove">&times;</button>
        </div>
      `;
      list.appendChild(row);
      syncColorUi(row, "color");
      return;
    }

    if (action === "range-add") {
      const root = btn.closest("div[id^='addWidgetField_']");
      if (!root) return;

      const list = root.querySelector(".range-list");
      if (!list) return;

      const row = document.createElement("div");
      row.className = "range-row row g-2 align-items-center mb-2";
      row.innerHTML = `
        <div class="col-4"><input type="number" class="form-control form-control-sm" placeholder="from" data-k="from"></div>
        <div class="col-4"><input type="number" class="form-control form-control-sm" placeholder="to" data-k="to"></div>
        <div class="col-1 d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="range-remove">&times;</button>
        </div>
      `;
      list.appendChild(row);
      return;
    }

    if (action === "range-remove") {
      btn.closest(".range-row")?.remove();
      return;
    }
  });

  // Keep color swatches in sync (hex typing + picker)
  elOptions.addEventListener("input", (e) => {
    const t = e.target;

    // Hex text input typed
    if (t?.matches?.("[data-k='color']")) {
      const row = t.closest(".ts-row") || t.closest(".range-row");
      if (!row) return;
      syncColorUi(row, "color");
      return;
    }

    // Native picker changed
    if (t?.matches?.("[data-k='color-picker']")) {
      const row = t.closest(".ts-row") || t.closest(".range-row");
      if (!row) return;
      const hexInput = row.querySelector("[data-k='color']");
      if (!hexInput) return;
      hexInput.value = normalizeHexColor(t.value, "#0d6efd");
      syncColorUi(row, "color");
      return;
    }
  });

  // ---------------- validation + submit ----------------
  function readField(field) {
    const kind = String(field.kind || "text").toLowerCase();
    const reader = readers[kind] || readers.text;
    return reader(field);
  }

  function validate(meta) {
    for (const f of meta.fields || []) {
      const v = readField(f);

      if (v && typeof v === "object" && v.__invalid) return false;

      if (!f.required) continue;

      if (v === undefined || v === null || v === "") {
        document.getElementById(fieldId(f.key))?.focus?.();
        return false;
      }

      const kind = String(f.kind || "").toLowerCase();
      if ((kind === "multivaluesource" || kind === "multiseriessource") && Array.isArray(v) && v.length === 0) {
        document.getElementById(fieldId(f.key))?.querySelector("[data-action]")?.focus?.();
        return false;
      }
    }
    return true;
  }

  async function submit() {
    elBtnAdd.disabled = true;
    try {
      const type = elType.value;
      const meta = getWidgetMeta(type);
      if (!meta) return;

      if (!validate(meta)) return;

      const config = {};
      for (const f of meta.fields || []) {
        const v = readField(f);
        if (v === "" || v === undefined) continue;
        config[f.key] = v;
      }

      await onAdd({ type, config });
      modal.hide();
    } finally {
      elBtnAdd.disabled = false;
    }
  }

  // ---------------- lifecycle ----------------
  elBtnAdd.addEventListener("click", submit);
  elType.addEventListener("change", renderOptions);

  elModal.addEventListener("shown.bs.modal", () => {
    renderTypeOptions();
    renderOptions();

    const meta = getWidgetMeta(elType.value);
    const first = meta?.fields?.[0]?.key;
    if (!first) return;

    const root = document.getElementById(fieldId(first));
    if (!root) return;

    const kind = String(meta?.fields?.[0]?.kind || "text").toLowerCase();
    if (kind === "singlevaluesource" || kind === "multivaluesource" || kind === "multiseriessource") {
      root.querySelector("[data-action]")?.focus?.();
    } else {
      root.focus?.();
    }
  });

  function open() {
    modal.show();
  }

  return { open };
}