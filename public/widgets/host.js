// public/widgets/host.js
import { getWidget } from "./registry.js";

export function createWidgetHost() {
  /** id -> { type, instance, el } */
  const mounted = new Map();

  function unmount(id) {
    const m = mounted.get(id);
    if (!m) return;
    try {
      const mod = getWidget(m.type);
      mod?.unmount?.(m.instance);
    } finally {
      mounted.delete(id);
    }
  }

  function sync({ items, rootEl, ctx }) {
    // 1) Unmount missing items (DOM rerender or deleted)
    const present = new Set(items.map((x) => x.id));
    for (const id of mounted.keys()) {
      if (!present.has(id)) unmount(id);
    }

    // 2) Mount / update present items
    for (const it of items) {
      const type = it.type || "value1x1";
      const mod = getWidget(type);
      if (!mod) continue;

      const itemEl = rootEl.querySelector(`.grid-item[data-id="${it.id}"]`);
      if (!itemEl) continue;

      const bodyEl = itemEl.querySelector(".widget-body");
      if (!bodyEl) continue;

      const m = mounted.get(it.id);

      const widgetCtx = { ...ctx, item: it };

      // If not mounted or type changed or DOM node changed -> remount
      if (!m || m.type !== type || m.el !== bodyEl) {
        if (m) unmount(it.id);
        bodyEl.innerHTML = "";
        const instance = mod.mount(bodyEl, widgetCtx);
        mounted.set(it.id, { type, instance, el: bodyEl });
      } else {
        mod.update?.(m.instance, widgetCtx);
      }
    }
  }

  function dispose() {
    for (const id of mounted.keys()) unmount(id);
  }

  return { sync, dispose };
}
