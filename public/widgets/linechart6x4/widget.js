// public/widgets/linechart6x4/widget.js
//
// ECharts line chart widget (6x4).
// - Reads dashboard-wide time range from ctx.getDashboard().range (if present)
// - Falls no dashboard range exists: uses widget-local rangeMs
// - Fetches timeseries from endpoint with query params:
//   - from_ts_ms, to_ts_ms, max_points
//   - optional paramKey/paramValue pair

export const meta = {
    type: "linechart6x4",
    label: "Line Chart (6x4)",
    size: { w: 6, h: 4 },

    defaults: {
        title: "LineChart",
        refreshMs: 60000,
        rangeMs: 6 * 60 * 60 * 1000,
        maxPoints: 400,
        yMin: "",
        yMax: "",
        sources: [], // created via modal
    },

    fields: [
        { key: "title", label: "Title", kind: "text", max: 20, placeholder: "" },
        {
            key: "refreshMs",
            label: "Refresh Interval",
            kind: "select",
            required: true,
            options: [
                { value: 60000, label: "1m" },
                { value: 300000, label: "5m" },
                { value: 600000, label: "10m" },
                { value: 1800000, label: "30m" },
                { value: 3600000, label: "1h" },
            ],
        },
        {
            key: "rangeMs",
            label: "Fallback range",
            kind: "select",
            required: true,
            options: [
                { value: 6 * 60 * 60 * 1000, label: "6h" },
                { value: 12 * 60 * 60 * 1000, label: "12h" },
                { value: 24 * 60 * 60 * 1000, label: "24h" },
                { value: 7 * 24 * 60 * 60 * 1000, label: "7d" },
                { value: 30 * 24 * 60 * 60 * 1000, label: "30d" },
            ],
            help: "Used when no time range is set.",
        },

        { key: "maxPoints", label: "Max points", kind: "number", required: true, placeholder: "", help: "Maximum data points to display." },

        {
            key: "sources",
            label: "Time Series",
            kind: "multiSeriesSource",
            required: true,
            maxRows: 3,
            help: "Up to 3 series. Each series defines endpoint + label + color.",
        },

        { key: "yMin", label: "Y min", kind: "number", required: false, placeholder: "auto", help: "Leave empty for auto." },
        { key: "yMax", label: "Y max", kind: "number", required: false, placeholder: "auto", help: "Leave empty for auto." },
    ],

};

function normalizeRefreshMs(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1000, Math.min(3600000, Math.round(n)));
}

function normalizeMaxPoints(v, fallback = 600) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(10, Math.min(20000, Math.round(n)));
}

function normalizeRangeMs(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(60_000, Math.min(30 * 24 * 60 * 60 * 1000, Math.round(n)));
}

function optionalNumber(v) {
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function normalizeColor(v, fallback = meta.defaults.lineColor) {
    const s = String(v ?? "").trim();
    return s || fallback;
}

function getDashboardRange(ctx) {
    try {
        const d = ctx?.getDashboard?.();
        const r = d?.range;
        if (!r) return null;
        const from = Number(r.fromTsMs);
        const to = Number(r.toTsMs);
        if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
        return { fromTsMs: from, toTsMs: to, mode: r.mode, preset: r.preset ?? null };
    } catch {
        return null;
    }
}

function buildUrlForSource(src, cfg, ctx) {
    const endpoint = String(src?.endpoint || "").trim();
    const u = new URL(endpoint, window.location.origin);

    const dash = getDashboardRange(ctx);
    let fromTsMs, toTsMs;

    if (dash) {
        fromTsMs = dash.fromTsMs;
        toTsMs = dash.toTsMs;
    } else {
        const now = Date.now();
        const rangeMs = normalizeRangeMs(cfg?.rangeMs, meta.defaults.rangeMs);
        fromTsMs = now - rangeMs;
        toTsMs = now;
    }

    const maxPoints = normalizeMaxPoints(cfg?.maxPoints, meta.defaults.maxPoints);

    u.searchParams.set("from_ts_ms", String(fromTsMs));
    u.searchParams.set("to_ts_ms", String(toTsMs));
    u.searchParams.set("max_points", String(maxPoints));

    const k = String(src?.paramKey ?? "").trim();
    const v = String(src?.paramValue ?? "").trim();
    if (k && v) u.searchParams.set(k, v);

    return u.toString();
}


function parsePoints(payload) {
    // Accept:
    // { points: [[ts,value], ...] }  (recommended)
    // { data:   [[ts,value], ...] }
    // [[ts,value], ...]
    const raw =
        (payload && Array.isArray(payload.points) && payload.points) ||
        (payload && Array.isArray(payload.data) && payload.data) ||
        (Array.isArray(payload) && payload) ||
        [];

    const out = [];
    for (const p of raw) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const ts = Number(p[0]);
        const val = Number(p[1]);
        if (!Number.isFinite(ts) || !Number.isFinite(val)) continue;
        out.push([ts, val]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
}

async function fetchSeries(src, cfg, ctx, { signal } = {}) {
    const url = buildUrlForSource(src, cfg, ctx);
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    const payload = await r.json();
    return parsePoints(payload);
}

function makeOption({ title, series, yMin, yMax }) {
    const yAxis = { type: "value", scale: true };
    if (Number.isFinite(yMin)) yAxis.min = yMin;
    if (Number.isFinite(yMax)) yAxis.max = yMax;

    return {
        animation: false,

        title: {
            show: true,
            text: title,
            left: 0,
            top: 1,
            textStyle: { fontSize: 16, fontWeight: 400 },
        },

        legend: {
            show: true,
            top: 8,
            right: 8,
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { fontSize: 11, color: "#666" },
        },

        tooltip: { trigger: "axis" },

        grid: { left: 4, right: 8, top: 40, bottom: 18, containLabel: true },

        xAxis: { type: "time", boundaryGap: false },
        yAxis,

        series: series.map((s) => ({
            name: s.name,
            type: "line",
            showSymbol: false,
            data: s.points.map(([ts, v]) => [ts, v]),
            lineStyle: { width: 2, color: s.color },
            itemStyle: { color: s.color },
            areaStyle: { opacity: 0 },
        })),
    };
}

export function mount(el, ctx) {
    if (typeof echarts === "undefined") {
        el.innerHTML = `<div class="text-muted small">ECharts not loaded.</div>`;
        return { dispose: () => { } };
    }

    el.classList.add("widget-linechart6x4");
    el.innerHTML = `
        <div class="linechart6x4-chart"></div>
    `;

    const elChart = el.querySelector(".linechart6x4-chart");

    const chart = echarts.init(elChart);
    const ac = new AbortController();

    const inst = {
        chart,
        ac,
        elChart,
        cfg: { ...(ctx?.item?.config || {}) },
        timer: null,
        ro: null,
        lastCtx: ctx,
    };

    async function refresh() {
        inst.lastCtx = ctx;

        const sources = Array.isArray(inst.cfg.sources) ? inst.cfg.sources : [];
        if (!sources.length) return;

        try {
            const title = String(inst.cfg.title || "").trim() || meta.defaults.title;
            const yMin = optionalNumber(inst.cfg.yMin);
            const yMax = optionalNumber(inst.cfg.yMax);

            const results = await Promise.all(
                sources.map(async (src) => {
                    const name = String(src?.label || "").trim() || String(src?.paramValue || "").trim() || "Series";
                    const color = normalizeColor(src?.color, "#0d6efd");
                    const points = await fetchSeries(src, inst.cfg, inst.lastCtx, { signal: ac.signal });
                    return { name, color, points };
                })
            );

            inst.chart.setOption(
                makeOption({ title, series: results, yMin, yMax }),
                { notMerge: true }
            );
        } catch (e) {
            if (e?.name === "AbortError") return;
            // optional: show empty/ERR state
        }
    }

    function setTimer() {
        if (inst.timer) window.clearInterval(inst.timer);
        const ms = normalizeRefreshMs(inst.cfg.refreshMs, meta.defaults.refreshMs);
        inst.cfg.refreshMs = ms;
        inst.timer = window.setInterval(refresh, ms);
    }

    inst.ro = new ResizeObserver(() => {
        try { inst.chart.resize(); } catch { }
    });
    inst.ro.observe(elChart);

    const title = String(inst.cfg.title || "").trim() || meta.defaults.title;
    const yMin = optionalNumber(inst.cfg.yMin);
    const yMax = optionalNumber(inst.cfg.yMax);

    const sources = Array.isArray(inst.cfg.sources) ? inst.cfg.sources : [];
    const initialSeries = sources.map((src) => ({
        name: String(src?.label || "").trim() || String(src?.paramValue || "").trim() || "Series",
        color: normalizeColor(src?.color),
        points: [],
    }));

    inst.chart.setOption(
        makeOption({ title, series: initialSeries, yMin, yMax }),
        { notMerge: true }
    );

    refresh();
    setTimer();

    inst.refresh = refresh;
    inst.setTimer = setTimer;

    return inst;
}

export function update(inst, ctx) {
    inst.cfg = { ...(ctx?.item?.config || {}) };

    inst.setTimer?.();
    inst.refresh?.();
}

export function unmount(inst) {
    try { inst.ro?.disconnect(); } catch { }
    try { inst.ac?.abort(); } catch { }
    try { if (inst.timer) window.clearInterval(inst.timer); } catch { }
    try { inst.chart?.dispose(); } catch { }
}
