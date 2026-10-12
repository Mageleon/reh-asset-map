// @ts-check
/**
 * Map colour classes: one place deciding which colour (and legend line) a plot gets.
 * Detailed land use (e.g. Ocean, Beach) wins over the general land use (e.g. Open Spaces).
 */
import { appConfig } from "../config/app-config.js";

/** @typedef {{ id: string, label: string, color: string }} ColorClass */

/**
 * @param {{ landUse: string|null, landUseDetail: string|null }} plot
 * @returns {ColorClass}
 */
export function colorClassOf(plot) {
  const detail = appConfig.landUseDetailColors.find((c) => plot.landUseDetail && c.details.includes(plot.landUseDetail));
  if (detail) return { id: detail.id, label: detail.label, color: detail.color };
  const colors = /** @type {Record<string, string>} */ (appConfig.landUseColors);
  const landUse = plot.landUse ?? "Unknown";
  return { id: `landUse:${landUse}`, label: landUse, color: colors[landUse] ?? colors.default };
}

/** MapLibre expression giving each plot shape its fill colour (same rules as colorClassOf). */
export function fillColorExpression() {
  const colors = /** @type {Record<string, string>} */ (appConfig.landUseColors);
  /** @type {any[]} */
  const byLandUse = ["match", ["coalesce", ["get", "landUse"], ""]];
  for (const [landUse, color] of Object.entries(colors)) {
    if (landUse !== "default") byLandUse.push(landUse, color);
  }
  byLandUse.push(colors.default);
  /** @type {any[]} */
  const expression = ["case"];
  for (const c of appConfig.landUseDetailColors) {
    expression.push(["in", ["coalesce", ["get", "landUseDetail"], ""], ["literal", c.details]], c.color);
  }
  expression.push(byLandUse);
  return expression;
}
