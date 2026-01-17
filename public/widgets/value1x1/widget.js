// public/widgets/value1x1/widget.js

export const meta = {
  type: "value1x1",
  label: "Value (1x1)",
  size: { w: 1, h: 1 },

  defaults: {
    title: "value",
    refreshMs: 5000,
    endpoint: "/api/latest",
    paramKey: "key",
    paramValue: "value",
  },

  fields: [
    { key: "title", label: "Title", kind: "text", max: 10, placeholder: "" },
    {
      key: "refreshMs",
      label: "Refresh Interval",
      kind: "select",
      required: true,
      options: [
        { value: 1000, label: "1s" },
        { value: 2000, label: "2s" },
        { value: 5000, label: "5s" },
        { value: 10000, label: "10s" },
        { value: 30000, label: "30s" },
        { value: 60000, label: "1m" },
        { value: 300000, label: "5m" },
        { value: 600000, label: "10m" },
        { value: 1800000, label: "30m" },
        { value: 3600000, label: "1h" },
      ],
    },
    { key: "endpoint", label: "Endpoint", kind: "text", required: true, placeholder: "/api/latest", help: "Example:", helpCode: "/api/latest?key=value" },
    { key: "paramKey", label: "Query key", kind: "text", placeholder: "key" },
    { key: "paramValue", label: "Query value", kind: "text", placeholder: "value" },
  ],
};

function buildUrl(cfg) {
    const endpoint = (cfg?.endpoint || meta.defaults.endpoint).trim();
    const u = new URL(endpoint, window.location.origin);

    const k = (cfg?.paramKey || meta.defaults.paramKey).trim();
    const v = (cfg?.paramValue || meta.defaults.paramValue).trim();
    if (k && v) u.searchParams.set(k, v);
    return u.toString();
}

async function fetchLatest(cfg, { signal } = {}) {
    const url = buildUrl(cfg);
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    return await r.json();
}

function normalizeRefreshMs(v, fallback = 5000) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;

    return Math.max(1000, Math.round(n));
}

export function mount(el, ctx) {
    el.classList.add("widget-value1x1");
    el.innerHTML = `
    <div class="value1x1-title"></div>
    <div class="value1x1-value">—</div>
  `;

    const elTitle = el.querySelector(".value1x1-title");
    const elValue = el.querySelector(".value1x1-value");

    const ac = new AbortController();

    const inst = {
        ac,
        elTitle,
        elValue,
        cfg: { ...(ctx.item?.config || {}) },
        timer: null,
    };

    function applyAll() {
        const t = (inst.cfg.title || "").trim() || meta.defaults.title;
        inst.elTitle.textContent = t;
    }

    async function refresh() {
        try {
            const data = await fetchLatest(inst.cfg, { signal: ac.signal });
            inst.elValue.textContent = data?.value == null ? "—" : String(data.value);
        } catch (e) {
            if (e?.name === "AbortError") return;
            inst.elValue.textContent = "ERR";
        }
    }

    function setTimer() {
        if (inst.timer) window.clearInterval(inst.timer);
        const ms = normalizeRefreshMs(inst.cfg.refreshMs, meta.defaults.refreshMs);
        inst.cfg.refreshMs = ms; // normalize back into cfg for consistency
        inst.timer = window.setInterval(refresh, ms);
    }

    inst.refresh = refresh;
    inst.setTimer = setTimer;

    applyAll();
    refresh();
    setTimer();

    return inst;
}

export function update(inst, ctx) {
    inst.cfg = { ...(ctx.item?.config || {}) };
    const t = (inst.cfg.title || "").trim() || meta.defaults.title;
    inst.elTitle.textContent = t;

    inst.setTimer?.();
    inst.refresh?.();
}

export function unmount(inst) {
    try { inst.ac.abort(); } catch { }
    try { window.clearInterval(inst.timer); } catch { }
}

