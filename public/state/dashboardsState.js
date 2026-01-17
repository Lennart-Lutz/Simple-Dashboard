// public/state/dashboardsState.js

export function getActiveDashboard(state) {
  return state?.dashboards?.find((x) => x.id === state.activeId) || null;
}

export function nextWidgetId(dashboard) {
  const used = new Set((dashboard?.items || []).map((x) => x.id));
  let i = 1;
  while (used.has(`w${i}`)) i++;
  return `w${i}`;
}

export function renameDashboard(state, id, name) {
  const d = state.dashboards.find((x) => x.id === id);
  if (!d) return false;
  d.name = name;
  return true;
}

export function setActiveDashboard(state, id) {
  state.activeId = id;
}
