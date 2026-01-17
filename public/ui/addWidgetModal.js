// public/ui/addWidgetModal.js

export function createAddWidgetModal({ getWidgetMetas, getWidgetMeta, onAdd }) {
  const elModal = document.getElementById("addWidgetModal");
  const elBtnAdd = document.getElementById("addWidgetConfirm");
  const elType = document.getElementById("addWidgetType");
  const elOptions = document.getElementById("addWidgetOptions");

  if (!elModal || !elBtnAdd || !elType || !elOptions) throw new Error("AddWidget modal elements missing.");
  if (typeof bootstrap === "undefined" || !bootstrap.Modal) throw new Error("Bootstrap JS Modal not available.");

  const modal = bootstrap.Modal.getOrCreateInstance(elModal);

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderTypeOptions() {
    const metas = getWidgetMetas() || [];

    // preserve selection
    const prev = elType.value;

    elType.innerHTML = metas
      .map((m) => `<option value="${esc(m.type)}">${esc(m.label || m.type)}</option>`)
      .join("");

    // restore selection if possible
    if (prev) elType.value = prev;
  }

  function renderField(field, value) {
    const id = `addWidgetField_${field.key}`;
    const label = esc(field.label || field.key);
    const req = field.required ? ` <span class="text-danger">*</span>` : "";
    const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";

    if (field.kind === "select") {
      const opts = (field.options || [])
        .map((o) => {
          const sel = String(o.value) === String(value) ? " selected" : "";
          return `<option value="${esc(o.value)}"${sel}>${esc(o.label ?? o.value)}</option>`;
        })
        .join("");
      return `
        <div class="mb-3">
          <label class="form-label">${label}${req}</label>
          <select id="${id}" class="form-select">${opts}</select>
          ${renderHelp(field)}
        </div>
      `;
    }

    if (field.kind === "number") {
      return `
        <div class="mb-2">
          <label class="form-label">${label}${req}</label>
          <input id="${id}" type="number" class="form-control"${ph} autocomplete="off" />
          ${renderHelp(field)}
        </div>
      `;
    }

    if (field.kind === "ranges") {
      const cid = `addWidgetField_${field.key}`;
      return `
        <div class="mb-2">
          <label class="form-label">${label}${req}</label>

          <div id="${cid}" class="border rounded-3 p-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-muted small">from / to</div>
              <button type="button" class="btn btn-sm btn-outline-dark" data-action="range-add">Add range</button>
            </div>
            <div class="range-list"></div>
          </div>

          ${renderHelp(field)}
        </div>
      `;
    }

    if (field.kind === "colorranges") {
      const cid = `addWidgetField_${field.key}`;
      return `
        <div class="mb-2">
          <label class="form-label">${label}${req}</label>

          <div id="${cid}" class="border rounded-3 p-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-muted small">from / to / color</div>
              <button type="button" class="btn btn-sm btn-outline-dark" data-action="color-range-add">Add range</button>
            </div>
            <div class="range-list"></div>
          </div>

          ${renderHelp(field)}
        </div>
      `;
    }

    function renderHelp(field) {
      const help = field.help ? `<div class="form-text">${esc(field.help)}</div>` : "";
      const helpCode = field.helpCode
        ? `<div class="form-text">${field.help ? "" : ""}<code>${esc(field.helpCode)}</code></div>`
        : "";

      if (field.help && field.helpCode) {
        return `<div class="form-text">${esc(field.help)} <code>${esc(field.helpCode)}</code></div>`;
      }
      return help || helpCode;
    }

    // text (default)
    const max = field.max ? ` maxlength="${esc(field.max)}"` : "";
    return `
      <div class="mb-2">
        <label class="form-label">${label}${req}</label>
        <input id="${id}" type="text" class="form-control"${max}${ph} value="${esc(value)}" autocomplete="off" />
        ${renderHelp(field)}
      </div>
    `;
  }

  function renderOptions() {
    const type = elType.value;
    const meta = getWidgetMeta(type);
    if (!meta) {
      elOptions.innerHTML = `<div class="text-muted small">Unknown widget type.</div>`;
      return;
    }

    const fields = meta.fields || [];
    const defaults = meta.defaults || {};

    elOptions.innerHTML = `
      ${fields.map((f) => renderField(f, "")).join("")}
    `;
  }

  elOptions.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "color-range-add") {
      const container = btn.closest('[id^="addWidgetField_colorranges"]') || btn.closest("#addWidgetField_colorranges");
      const root = btn.closest("div[id^='addWidgetField_']");
      if (!root) return;

      const list = root.querySelector(".range-list");
      if (!list) return;

      const row = document.createElement("div");
      row.className = "range-row row g-2 align-items-center mb-2";
      row.innerHTML = `
      <div class="col-4"><input type="number" class="form-control form-control-sm" placeholder="from" data-k="from"></div>
      <div class="col-4"><input type="number" class="form-control form-control-sm" placeholder="to" data-k="to"></div>
      <div class="col-3"><input type="color" class="form-control form-control-sm form-control-color w-100" value="#2ecc71" data-k="color"></div>
      <div class="col-1 d-flex justify-content-end">
        <button type="button" class="btn btn-sm btn-outline-danger" data-action="range-remove">&times;</button>
      </div>
    `;
      list.appendChild(row);
      return;
    }

    if (action === "range-add") {
      const container = btn.closest('[id^="addWidgetField_ranges"]') || btn.closest("#addWidgetField_ranges");
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
      const row = btn.closest(".range-row");
      row?.remove();
    }
  });

  function readField(field) {
    const id = `addWidgetField_${field.key}`;
    const el = document.getElementById(id);
    if (!el) return undefined;

    if (field.kind === "select") {
      const v = el.value;
      return typeof field.options?.[0]?.value === "number" ? Number(v) : v;
    }

    if (field.kind === "number") {
      const el = document.getElementById(`addWidgetField_${field.key}`);
      const v = (el?.value || "").trim();
      if (!v) return "";
      return Number(v);
    }

    if (field.kind === "ranges") {
      const root = document.getElementById(`addWidgetField_${field.key}`);
      if (!root) return [];

      const rows = [...root.querySelectorAll(".range-row")];
      const ranges = rows
        .map((row) => {
          const from = Number(row.querySelector('[data-k="from"]')?.value);
          const to = Number(row.querySelector('[data-k="to"]')?.value);
          if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
          return { from, to };
        })
        .filter(Boolean);

      return ranges;
    }

    if (field.kind === "colorranges") {
      const root = document.getElementById(`addWidgetField_${field.key}`);
      if (!root) return [];

      const rows = [...root.querySelectorAll(".range-row")];
      const ranges = rows
        .map((row) => {
          const from = Number(row.querySelector('[data-k="from"]')?.value);
          const to = Number(row.querySelector('[data-k="to"]')?.value);
          const color = (row.querySelector('[data-k="color"]')?.value || "").trim();
          if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from) || !color) return null;
          return { from, to, color };
        })
        .filter(Boolean);

      return ranges;
    }

    return (el.value || "").trim();
  }

  function validate(meta) {
    for (const f of meta.fields || []) {
      if (!f.required) continue;
      const v = readField(f);
      if (v === undefined || v === null || v === "") {
        // focus missing required field
        document.getElementById(`addWidgetField_${f.key}`)?.focus();
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
        // allow optional empty strings -> omit or keep; here: keep if not empty, else omit
        if (v !== "" && v !== undefined) config[f.key] = v;
      }

      await onAdd({ type, config });
      modal.hide();
    } finally {
      elBtnAdd.disabled = false;
    }
  }

  elBtnAdd.addEventListener("click", submit);
  elType.addEventListener("change", renderOptions);

  elModal.addEventListener("shown.bs.modal", () => {
    renderTypeOptions();
    renderOptions();
    // focus first field
    const meta = getWidgetMeta(elType.value);
    const first = meta?.fields?.[0]?.key;
    if (first) document.getElementById(`addWidgetField_${first}`)?.focus();
  });

  function open() {
    modal.show();
  }

  return { open };
}
