// public/api/dashboardsApi.js

export async function apiGetState() {
  const r = await fetch("/api/dashboards");
  if (!r.ok) throw new Error("GET /api/dashboards failed");
  return await r.json();
}

export async function apiPutState(nextState) {
  const r = await fetch("/api/dashboards", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextState),
  });
  if (!r.ok) throw new Error("PUT /api/dashboards failed");
}

export async function apiCreateDashboard(name = "New") {
  const r = await fetch("/api/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("POST /api/dashboards failed");
  return await r.json(); // {id}
}
