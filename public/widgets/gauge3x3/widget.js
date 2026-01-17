// public/widgets/gauge3x3/widget.js

export const meta = {
    type: "gauge3x3",
    label: "Gauge (3x3)",
    size: { w: 3, h: 3 },

    defaults: {
        title: "Gauge",
        refreshMs: 5000,
        endpoint: "/api/latest",
        paramKey: "key",
        paramValue: "value",

        min: 0,
        max: 2000,

        ranges: [ // Empty default ranges
        ],
    },

    fields: [
        { key: "title", label: "Title", kind: "text", max: 20, placeholder: "" },
        {
            key: "refreshMs",
            label: "Refresh Interval",
            kind: "select",
            required: true,
            placeholder: "",
            options: [
                { value: 1000, label: "1s" },
                { value: 2000, label: "2s" },
                { value: 5000, label: "5s" },
                { value: 10000, label: "10s" },
                { value: 30000, label: "30s" },
                { value: 60000, label: "1m" },
                { value: 300000, label: "5m" },
                { value: 3600000, label: "1h" },
            ],
        },

        { key: "endpoint", label: "Endpoint", kind: "text", required: true, placeholder: "/api/latest", help: "Example:", helpCode: "/api/latest?key=value" },
        { key: "paramKey", label: "Query key", kind: "text", placeholder: "key" },
        { key: "paramValue", label: "Query value", kind: "text", placeholder: "value" },

        { key: "min", label: "Min", kind: "number", required: true, placeholder: "" },
        { key: "max", label: "Max", kind: "number", required: true, placeholder: "" },

        // Custom field kind: colorranges (from/to/color rows)
        {
            key: "ranges",
            label: "Color ranges",
            kind: "colorranges",
            help: "Define colored segments on the gauge axis.",
        },
    ],
};

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function normalizeNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeRefreshMs(v, fallback = 5000) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1000, Math.min(3600000, Math.round(n)));
}

function buildUrl(cfg) {
    const endpoint = (cfg?.endpoint || meta.defaults.endpoint).trim();
    const u = new URL(endpoint, window.location.origin);

    const k = (cfg?.paramKey || "").trim();
    const v = (cfg?.paramValue || "").trim();
    if (k && v) u.searchParams.set(k, v);

    return u.toString();
}

// Convert absolute ranges to ECharts axisLine color stops:
// [ [stop0,color0], [stop1,color1], ... ] with stop in 0..1 (cumulative)
function buildAxisStops({ min, max, ranges }, fallbackColor = "#e6e6e6") {
    const span = max - min;
    if (!(span > 0)) return [[1, fallbackColor]];

    const cleaned = (Array.isArray(ranges) ? ranges : [])
        .map((r) => ({
            from: normalizeNumber(r.from, NaN),
            to: normalizeNumber(r.to, NaN),
            color: String(r.color || "").trim() || fallbackColor,
        }))
        .filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && r.to > r.from);

    const rs = cleaned.length ? cleaned : meta.defaults.ranges;

    const sorted = [...rs].sort((a, b) => a.from - b.from);

    const stops = [];
    for (const r of sorted) {
        const to = clamp(r.to, min, max);
        const stop = clamp((to - min) / span, 0, 1);
        stops.push([stop, r.color]);
    }

    // Ensure last stop reaches 1
    const last = stops[stops.length - 1];
    if (!last || last[0] < 1) stops.push([1, fallbackColor]);

    // Ensure monotonic increasing
    let prev = 0;
    for (const s of stops) {
        s[0] = Math.max(prev, s[0]);
        prev = s[0];
    }

    return stops;
}

async function fetchLatest(cfg, { signal } = {}) {
    const url = buildUrl(cfg);
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    return await r.json();
}

export function mount(el, ctx) {
    if (typeof echarts === "undefined") {
        el.innerHTML = `<div class="text-muted small">ECharts not loaded.</div>`;
        return { dispose: () => { } };
    }

    el.classList.add("widget-gauge3x3");
    el.innerHTML = `
    <div class="gauge3x3-title"></div>
    <div class="gauge3x3-chart"></div>
  `;

    const elTitle = el.querySelector(".gauge3x3-title");
    const elChart = el.querySelector(".gauge3x3-chart");
    const ac = new AbortController();
    const chart = echarts.init(elChart);

    const inst = {
        ac,
        chart,
        elTitle,
        elChart,
        cfg: { ...(ctx.item?.config || {}) },
        timer: null,
        value: null,
    };

    function applyTitle() {
        const t = (inst.cfg.title || "").trim() || meta.defaults.title;
        elTitle.textContent = t;
    }

    function applyOption(value) {
        const min = normalizeNumber(inst.cfg.min, meta.defaults.min);
        const max = normalizeNumber(inst.cfg.max, meta.defaults.max);
        const axisStops = buildAxisStops({
            min,
            max,
            ranges: inst.cfg.ranges,
        });

        const v = Number.isFinite(value) ? clamp(value, min, max) : null;

        inst.chart.setOption(
            {
                series: [
                    {
                        type: "gauge",
                        center: ["50%", "56%"], 
                        radius: "68%",

                        min,
                        max,
                        splitNumber: 8,

                        axisLine: {
                            lineStyle: {
                                width: 10,
                                color: axisStops,
                            },
                        },

                        // --- OUTSIDE ticks/labels ---
                        axisTick: {
                            show: true,
                            distance: -10,
                            length: 6,
                            lineStyle: { width: 1 },
                        },
                        splitLine: {
                            show: true,
                            distance: -10,
                            length: 10,
                            lineStyle: { width: 2 },
                        },
                        axisLabel: {
                            show: true,
                            distance: -32,
                        },

                        // --- black pointer ---
                        pointer: {
                            show: true,
                            length: "60%",
                            width: 4,
                            itemStyle: { color: "#111" },
                        },

                        itemStyle: {
                            color: "#111",
                        },

                        title: { show: false },
                        detail: {
                            valueAnimation: true,
                            fontSize: 18,
                            offsetCenter: [0, "65%"],
                            formatter: (val) => (Number.isFinite(val) ? Math.round(val).toString() : "—"),
                        },

                        data: [{ value: v ?? 0 }],
                    }
                    ,
                ],
            },
            { notMerge: true }
        );
    }

    async function refresh() {
        try {
            const data = await fetchLatest(inst.cfg, { signal: ac.signal });

            // Erwartung: { value: number } (wie dein demo endpoint)
            // Falls du später andere Schemas hast, kannst du hier mappen.
            const value = Number(data?.value);
            inst.value = Number.isFinite(value) ? value : null;

            applyOption(inst.value);
        } catch (e) {
            if (e?.name === "AbortError") return;
            // auf Fehler: Gauge bleibt, aber ohne Update (optional: setOption mit NaN)
        }
    }

    function setTimer() {
        if (inst.timer) window.clearInterval(inst.timer);
        inst.timer = null;

        const ms = normalizeRefreshMs(inst.cfg.refreshMs, meta.defaults.refreshMs);
        inst.cfg.refreshMs = ms;

        inst.timer = window.setInterval(refresh, ms);
    }

    // initial
    applyTitle();
    applyOption(null);
    refresh();
    setTimer();

    // resize handling (grid rerender / window resize)
    const ro = new ResizeObserver(() => inst.chart.resize());
    ro.observe(elChart);
    inst.ro = ro;

    inst.refresh = refresh;
    inst.setTimer = setTimer;

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
    try { inst.ro?.disconnect(); } catch { }
    try { inst.ac?.abort(); } catch { }
    try { if (inst.timer) window.clearInterval(inst.timer); } catch { }
    try { inst.chart?.dispose(); } catch { }
}
