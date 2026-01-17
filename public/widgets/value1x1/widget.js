// public/widgets/value1x1/widget.js

export const DEFAULT = {
    w: 1,
    h: 1,
    type: "value1x1",
    config: {
        title: "value",
        endpoint: "/api/latest",
        paramKey: "key",
        paramValue: "value",
        refreshMs: 5000,
    },
};

function buildUrl(cfg) {
    const endpoint = (cfg?.endpoint || DEFAULT.config.endpoint).trim();
    const u = new URL(endpoint, window.location.origin);

    const k = (cfg?.paramKey || DEFAULT.config.paramKey).trim();
    const v = (cfg?.paramValue || DEFAULT.config.paramValue).trim();

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
        const t = (inst.cfg.title || "").trim() || DEFAULT.config.title;
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
        const ms = normalizeRefreshMs(inst.cfg.refreshMs, DEFAULT.config.refreshMs);
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
    const t = (inst.cfg.title || "").trim() || DEFAULT.config.title;
    inst.elTitle.textContent = t;

    inst.setTimer?.();
    inst.refresh?.();
}

export function unmount(inst) {
    try { inst.ac.abort(); } catch { }
    try { window.clearInterval(inst.timer); } catch { }
}

