// public/app.js

import { createGrid } from "./grid/grid.js";
import { createEditTabModal } from "./ui/editTabModal.js";
import { showError, showSuccess, showInfo } from "./ui/toast.js";

import { apiGetState, apiPutState, apiCreateDashboard } from "./api/dashboardsApi.js";
import { getActiveDashboard, nextWidgetId, renameDashboard, setActiveDashboard } from "./state/dashboardsState.js";
import { createTabsView } from "./ui/tabsView.js";

// ---------------- DOM ----------------
const elTabs = document.getElementById("dashTabs");
const elBtnEdit = document.getElementById("btnEdit");
const elBtnAdd = document.getElementById("btnAdd");
const gridMount = document.getElementById("gridArea");

// ---------------- State ----------------
let state = null;

// ---------------- Config ----------------
const GRID_CONFIG = {
  cell: 80,
  cols: 40,

  overlayBreakpoints: [
    { maxWidth: 1920, cols: 0, rows: 0 },
    { maxWidth: 2560, cols: 25, rows: 13 }, // tested 2560x1440 fullscreen
    { maxWidth: 3840, cols: 0, rows: 0 },
  ],

  paddingBreakpoints: [
    { maxWidth: 1920, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
    { maxWidth: 2560, padding: { left: 12, right: 12, top: 0, bottom: 0 } },
    { maxWidth: 3840, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
  ],
};

// ---------------- Grid ----------------
const grid = createGrid({
  mountEl: gridMount,
  ...GRID_CONFIG,
  onChange: async (items) => {
    const d = getActiveDashboard(state);
    if (!d) return;
    d.items = items;
    try {
      await apiPutState(state);
    } catch (e) {
      showError("Failed to save dashboard layout.");
      console.error(e);
    }
  },
});

// ---------------- UI: Edit Modal ----------------
const editor = createEditTabModal({
  onSave: async ({ id, name }) => {
    if (!renameDashboard(state, id, name)) return;

    try {
      await apiPutState(state);
      tabs.render();
    } catch (e) {
      showError("Dashboard renaming failed.");
    }
  },

  onDelete: async ({ id }) => {
    const idx = state.dashboards.findIndex((d) => d.id === id);
    if (idx === -1) return;

    // Last remaining dashboard => reset instead of delete
    if (state.dashboards.length === 1) {
      const d = state.dashboards[0];
      d.items = [];
      d.name = "Main";

      try {
        await apiPutState(state);
        tabs.render();
        renderActiveDashboard();
        showSuccess("Dashboard has been reseted.");
      } catch {
        showError("Dashboard could not be reset.");
      }
      return;
    }

    // Normal delete
    state.dashboards.splice(idx, 1);

    if (state.activeId === id) {
      state.activeId = state.dashboards[0]?.id ?? null;
    }

    try {
      await apiPutState(state);
      tabs.render();
      renderActiveDashboard();
      showSuccess("Dashboard deleted.");
    } catch {
      showError("Dashboard could not be deleted.");
    }
  },

});

// ---------------- UI: Tabs View ----------------
const tabs = createTabsView({
  elTabs,
  getState: () => state,
  isEditing: () => grid.isEditing,

  onSelect: async (d) => {
    setActiveDashboard(state, d.id);
    tabs.render();
    renderActiveDashboard();
    try {
      await apiPutState(state);
    } catch (e) {
      showError("Failed to switch dashboard.");
      console.error(e);
    }
  },

  onRename: (d) => {
    editor.open({
      id: d.id,
      currentName: d.name,
      validate: (next) => {
        const exists = state.dashboards.some(
          (x) => x.id !== d.id && (x.name || "").trim().toLowerCase() === next.trim().toLowerCase()
        );
        if (exists) return "This name is already in use.";
        return null;
      },
    });
  },

  onCreateNew: async () => {
    try {
      await apiCreateDashboard("New");
      state = await apiGetState();
      tabs.render();
      renderActiveDashboard();
    } catch (e) {
      showError("Failed to create new dashboard.");
      console.error(e);
    }
  },
});

// ---------------- Actions ----------------
function renderActiveDashboard() {
  const d = getActiveDashboard(state);
  if (!d) return;
  grid.setItems(d.items || []);
}

function addWidget() {
  const d = getActiveDashboard(state);
  if (!d) return;

  d.items = d.items || [];
  const id = nextWidgetId(d);

  const item = { id, x: 0, y: 0, w: 2, h: 2 };
  d.items.push(item);

  grid.addItem(item);
}

function toggleEdit() {
  const enabled = !grid.isEditing;
  grid.setEditMode(enabled);
  elBtnEdit.textContent = enabled ? "Done" : "Edit";
  tabs.render();
}

// ---------------- Boot ----------------
async function boot() {
  state = await apiGetState();

  tabs.render();
  renderActiveDashboard();
  grid.setEditMode(false);

  elBtnEdit.addEventListener("click", toggleEdit);
  elBtnAdd.addEventListener("click", addWidget);
}

boot().catch(console.error);
