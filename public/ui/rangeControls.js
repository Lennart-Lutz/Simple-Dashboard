// public/ui/rangeControls.js
//
// Dashboard range controls (navbar-friendly, statusless).
// Behavior:
// - Preset clicked -> preset button becomes active, inputs updated, state persisted
// - Custom Apply -> preset active cleared, state persisted as custom
// - Custom input interaction -> clears preset active (visual hint), no state change until Apply
// - Strict persistence: PUT full state first, then commit; rollback UI on error
//
// State shape stored per dashboard:
// d.range = {
//   mode: "preset" | "custom",
//   preset: "6h" | "12h" | "24h" | "7d" | "30d" | null,
//   fromTsMs: number,
//   toTsMs: number
// }

function clone(v) {
    return typeof structuredClone === "function"
        ? structuredClone(v)
        : JSON.parse(JSON.stringify(v));
}

function presetToMs(preset) {
    const map = {
        "6h": 6 * 60 * 60 * 1000,
        "12h": 12 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
    };
    return map[preset] || null;
}

function parseDatetimeLocalToMs(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    const dt = new Date(s);
    const ms = dt.getTime();
    return Number.isFinite(ms) ? ms : null;
}

function msToDatetimeLocal(ms) {
    if (!Number.isFinite(ms)) return "";
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function createRangeControls({
    rootId = "rangeControls",
    getState,
    setState, // commit callback: (nextState) => void
    apiPutState,
    showError,
    showSuccess,
    onRangeChanged, // e.g. syncWidgets()
}) {
    const root = document.getElementById(rootId);
    if (!root) throw new Error(`RangeControls: root #${rootId} not found`);

    const elFrom = document.getElementById("rangeFrom");
    const elTo = document.getElementById("rangeTo");
    const elApply = document.getElementById("rangeApply");

    if (!elFrom || !elTo || !elApply) {
        throw new Error("RangeControls: required elements missing (#rangeFrom/#rangeTo/#rangeApply).");
    }

    const presetButtons = () => [...root.querySelectorAll("[data-range]")];

    let saving = false;

    function getActiveDashboard(state) {
        return state?.dashboards?.find((x) => x.id === state.activeId) || null;
    }

    function readDashboardRange(d) {
        const r = d?.range;
        if (!r) return null;

        const fromTsMs = Number(r.fromTsMs);
        const toTsMs = Number(r.toTsMs);
        if (!Number.isFinite(fromTsMs) || !Number.isFinite(toTsMs)) return null;

        return {
            mode: r.mode,
            preset: r.preset ?? null,
            fromTsMs,
            toTsMs,
        };
    }

    function clearPresetActive() {
        for (const b of presetButtons()) b.classList.remove("active");
    }

    function setPresetActive(preset) {
        clearPresetActive();
        for (const b of presetButtons()) {
            if (b.dataset.range === preset) b.classList.add("active");
        }
    }

    function applyUiFromState() {
        const state = getState();
        const d = getActiveDashboard(state);
        const r = readDashboardRange(d);

        if (!r) {
            clearPresetActive();
            setCustomActive(false);
            elFrom.value = "";
            elTo.value = "";
            return;
        }

        elFrom.value = msToDatetimeLocal(r.fromTsMs);
        elTo.value = msToDatetimeLocal(r.toTsMs);

        if (r.mode === "preset" && r.preset) {
            setPresetActive(r.preset);
            setCustomActive(false);
        } else {
            clearPresetActive();
            setCustomActive(true);
        }
    }

    async function persist(nextState) {
        saving = true;
        try {
            await apiPutState(nextState);
            setState(nextState); // commit
            onRangeChanged?.();
        } catch (e) {
            showError?.("Failed to save range. (Check connection?)");
            // rollback UI to committed state
            applyUiFromState();
            throw e;
        } finally {
            saving = false;
            // ensure UI matches committed state
            applyUiFromState();
        }
    }

    async function setPreset(preset) {
        if (saving) return;

        const dur = presetToMs(preset);
        if (!dur) return;

        const state = getState();
        const d = getActiveDashboard(state);
        if (!d) return;

        const now = Date.now();
        const nextRange = {
            mode: "preset",
            preset,
            fromTsMs: now - dur,
            toTsMs: now,
        };

        const nextState = clone(state);
        const nd = nextState.dashboards.find((x) => x.id === nextState.activeId);
        if (!nd) return;

        nd.range = nextRange;

        // optimistic UI (no disabling)
        setPresetActive(preset);
        setCustomActive(false);
        elFrom.value = msToDatetimeLocal(nextRange.fromTsMs);
        elTo.value = msToDatetimeLocal(nextRange.toTsMs);

        await persist(nextState);
    }

    function setCustomActive(v) {
        elApply.classList.toggle("btn-dark", !!v);
        elApply.classList.toggle("btn-outline-dark", !v);
    }

    async function applyCustom() {
        if (saving) return;

        const fromTsMs = parseDatetimeLocalToMs(elFrom.value);
        const toTsMs = parseDatetimeLocalToMs(elTo.value);

        if (!Number.isFinite(fromTsMs) || !Number.isFinite(toTsMs) || !(toTsMs > fromTsMs)) {
            showError?.("Invalid custom range. Ensure 'to' is after 'from'.");
            return;
        }

        const state = getState();
        const d = getActiveDashboard(state);
        if (!d) return;

        const nextRange = {
            mode: "custom",
            preset: null,
            fromTsMs,
            toTsMs,
        };

        const nextState = clone(state);
        const nd = nextState.dashboards.find((x) => x.id === nextState.activeId);
        if (!nd) return;

        nd.range = nextRange;

        // optimistic UI: custom -> clear active preset
        clearPresetActive();
        setCustomActive(true);

        await persist(nextState);
    }

    function onCustomInteraction() {
        if (saving) return;
        // Only a visual hint; no state change until Apply
        clearPresetActive();
        setCustomActive(true);
    }

    // Events
    root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-range]");
        if (!btn) return;
        e.preventDefault();
        setPreset(btn.dataset.range);
    });

    elApply.addEventListener("click", applyCustom);

    elFrom.addEventListener("focus", onCustomInteraction);
    elTo.addEventListener("focus", onCustomInteraction);
    elFrom.addEventListener("input", onCustomInteraction);
    elTo.addEventListener("input", onCustomInteraction);

    return {
        render: applyUiFromState,
    };
}
