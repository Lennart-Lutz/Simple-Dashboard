// public/app.js

import { createGrid } from "./grid/grid.js";
import { createEditTabModal } from "./ui/editTabModal.js";
import { createAddWidgetModal } from "./ui/addWidgetModal.js";
import { showError, showSuccess, showInfo } from "./ui/toast.js";
import { createRangeControls } from "./ui/rangeControls.js";

import { createWidgetHost } from "./widgets/host.js";
import { listWidgetMetas, getWidget, createDefaultItem } from "./widgets/registry.js";

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

    const nextState =
      typeof structuredClone === "function"
        ? structuredClone(state)
        : JSON.parse(JSON.stringify(state));

    const nd = nextState.dashboards.find((x) => x.id === nextState.activeId);
    if (!nd) return;

    nd.items = items;

    try {
      await apiPutState(nextState);
      state = nextState; // Commit only on success
    } catch (e) {
      showError("Failed to save dashboard layout. (Check connection?)");
      throw e;
    }
  },
  onRender: () => syncWidgets(),
});

// ---------------- Widgets ----------------

const widgetHost = createWidgetHost();

function syncWidgets() {
  const d = getActiveDashboard(state);
  if (!d) return;
  widgetHost.sync({
    items: d.items || [],
    rootEl: gridMount,
    ctx: {
      getDashboard: () => getActiveDashboard(state),
    },
  });
}

// ---------------- UI: Edit Tab Modal ----------------
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
        rangeControls?.render();
        showSuccess("Dashboard has been reset.");
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
      rangeControls?.render();
    } catch {
      showError("Dashboard could not be deleted.");
    }
  },

});

// ---------------- UI: Add Widget Modal ----------------

const addWidgetModal = createAddWidgetModal({
  getWidgetMetas: () => listWidgetMetas(),
  getWidgetMeta: (type) => getWidget(type)?.meta || null,
  onAdd: async (payload) => {
    try {
      await addWidget(payload);
    } catch (e) {
      showError("Widget could not be added.");
      throw e;
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
      rangeControls?.render();
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
      rangeControls?.render();
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
  syncWidgets(); // Load active widgets
}

async function addWidget({ type, config }) {
  const d = getActiveDashboard(state);
  if (!d) return;

  d.items = d.items || [];

  const id = nextWidgetId(d);
  const base = createDefaultItem(type);

  const item = {
    id,
    x: 0,
    y: 0,
    w: base.w,
    h: base.h,
    type,
    config: {
      ...(base.config || {}),
      ...(config || {}),
    },
  };

  await grid.addItem(item);
}

function toggleEdit() {
  const enabled = !grid.isEditing;
  grid.setEditMode(enabled);
  elBtnEdit.textContent = enabled ? "Done" : "Edit";
  elBtnAdd.classList.toggle("d-none", !enabled); // Add button only in edit mode
  tabs.render();
}

// ---------------- Boot ----------------
let rangeControls = null;

async function boot() {
  state = await apiGetState();

  rangeControls = createRangeControls({
    getState: () => state,
    setState: (next) => { state = next; },
    apiPutState,
    showError,
    showSuccess,
    onRangeChanged: () => syncWidgets(),
  });

  tabs.render();
  renderActiveDashboard();
  grid.setEditMode(false);

  rangeControls.render();

  elBtnEdit.addEventListener("click", toggleEdit);
  elBtnAdd.addEventListener("click", () => addWidgetModal.open());
}

boot().catch(console.error);
