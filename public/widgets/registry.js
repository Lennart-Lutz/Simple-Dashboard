// public/widgets/registry.js
import * as value1x1 from "./value1x1/widget.js";

export const WIDGETS = {
  [value1x1.meta.type]: value1x1,
};

export function getWidget(type) {
  return WIDGETS[type] || null;
}

export function listWidgetMetas() {
  return Object.values(WIDGETS).map((m) => m.meta);
}

export function createDefaultItem(type) {
  const mod = getWidget(type);
  if (!mod?.meta) throw new Error(`Unknown widget type: ${type}`);

  const { size, defaults } = mod.meta;
  const clone = (v) =>
    typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));

  return {
    w: size.w,
    h: size.h,
    type,
    config: clone(defaults || {}),
  };
}
