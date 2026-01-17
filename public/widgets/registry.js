// public/widgets/registry.js
import * as value1x1 from "./value1x1/widget.js";

export const WIDGETS = {
  value1x1,
};

export function getWidget(type) {
  return WIDGETS[type] || null;
}

export function createDefaultItem(type) {
  const mod = getWidget(type);
  if (!mod?.DEFAULT) throw new Error(`Unknown widget type: ${type}`);
  // clone
  return JSON.parse(JSON.stringify(mod.DEFAULT));
}
