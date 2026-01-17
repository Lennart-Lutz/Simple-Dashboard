import { createGrid } from "./grid/grid.js";

const elTabs = document.getElementById("dashTabs");
const elBtnEdit = document.getElementById("btnEdit");
const elBtnAdd = document.getElementById("btnAdd");
const gridMount = document.getElementById("gridArea");

let state = null;

// ---------------- API ----------------
async function apiGetState() {
  const r = await fetch("/api/dashboards");
  if (!r.ok) throw new Error("GET /api/dashboards failed");
  return await r.json();
}
async function apiPutState(nextState) {
  const r = await fetch("/api/dashboards", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextState),
  });
  if (!r.ok) throw new Error("PUT /api/dashboards failed");
}
async function apiCreateDashboard(name = "New") {
  const r = await fetch("/api/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("POST /api/dashboards failed");
  return await r.json();
}

// ---------------- Grid ----------------
const grid = createGrid({
  mountEl: gridMount,
  cell: 80, // Zellen größe in Pixel (Quadrat)
  cols: 40,

  // Breakpoints: <= FullHD, <= 2k, sonst 4k+
  overlayBreakpoints: [
    { maxWidth: 1920, cols: 0, rows: 0 },
    { maxWidth: 2560, cols: 25, rows: 13 }, // Getestet bei 2560x1440 Fullscreen
    { maxWidth: 3840, cols: 0, rows: 0 }, 
  ],

  paddingBreakpoints: [
    { maxWidth: 1920, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
    { maxWidth: 2560, padding: { left: 12, right: 12, top: 0, bottom: 0 } }, // Getestet bei 2560x1440 Fullscreen
    { maxWidth: 3840, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
  ],

  onChange: async (items) => {
    const d = state.dashboards.find((x) => x.id === state.activeId);
    if (!d) return;
    d.items = items;
    try { await apiPutState(state); } catch (e) { console.error(e); }
  },
});

// ---------------- UI ----------------
function renderTabs() {
  elTabs.innerHTML = "";

  for (const d of state.dashboards) {
    const li = document.createElement("li");
    li.className = "nav-item";
    li.role = "presentation";

    const btn = document.createElement("button");
    btn.className = "nav-link" + (d.id === state.activeId ? " active" : "");
    btn.type = "button";
    btn.textContent = d.name;

    btn.addEventListener("click", async () => {
      state.activeId = d.id;
      renderTabs();
      renderActiveDashboard();
      try { await apiPutState(state); } catch (e) { console.error(e); }
    });

    li.appendChild(btn);
    elTabs.appendChild(li);
  }

  const liPlus = document.createElement("li");
  liPlus.className = "nav-item tab-plus";
  const btnPlus = document.createElement("button");
  btnPlus.className = "nav-link";
  btnPlus.type = "button";
  btnPlus.textContent = "+";
  btnPlus.title = "Neues Dashboard";

  btnPlus.addEventListener("click", async () => {
    try {
      await apiCreateDashboard("New");
      state = await apiGetState();
      renderTabs();
      renderActiveDashboard();
    } catch (e) {
      console.error(e);
    }
  });

  liPlus.appendChild(btnPlus);
  elTabs.appendChild(liPlus);
}

function renderActiveDashboard() {
  const d = state.dashboards.find((x) => x.id === state.activeId);
  if (!d) return;
  grid.setItems(d.items || []);
}

function nextWidgetId(d) {
  const used = new Set((d.items || []).map((x) => x.id));
  let i = 1;
  while (used.has(`w${i}`)) i++;
  return `w${i}`;
}

async function addWidget() {
  const d = state.dashboards.find((x) => x.id === state.activeId);
  if (!d) return;
  d.items = d.items || [];

  const id = nextWidgetId(d);
  const item = { id, x: 0, y: 0, w: 2, h: 2 }; // 160x160 px

  d.items.push(item);
  grid.addItem(item);
}

// ---------------- Boot ----------------
async function boot() {
  state = await apiGetState();

  renderTabs();
  renderActiveDashboard();
  grid.setEditMode(false);

  elBtnEdit.addEventListener("click", () => {
    const enabled = !grid.isEditing;
    grid.setEditMode(enabled);
    elBtnEdit.textContent = enabled ? "Done" : "Edit";
  });

  elBtnAdd.addEventListener("click", () => addWidget());
}

boot().catch(console.error);
