// @ts-check
/** Summary figures for a precinct, computed from the loaded data (nothing hard-coded). */

import { colorClassOf } from "./colors.js";

/** @typedef {import("./types.js").PrecinctData} PrecinctData */

/**
 * @param {PrecinctData} data
 * @param {readonly {id: string, field: string}[]} filterDefinitions
 */
export function summarizePrecinct(data, filterDefinitions) {
  const plots = [...data.plotsById.values()];
  /** @type {Map<string, number>} */
  const landUseCounts = new Map();
  for (const plot of plots) {
    const key = plot.landUse ?? "Unknown";
    landUseCounts.set(key, (landUseCounts.get(key) ?? 0) + 1);
  }
  /** @type {Map<string, { label: string, color: string, count: number }>} */
  const colorClasses = new Map();
  for (const plot of plots) {
    const c = colorClassOf(plot);
    const entry = colorClasses.get(c.id) ?? { label: c.label, color: c.color, count: 0 };
    entry.count += 1;
    colorClasses.set(c.id, entry);
  }
  let documents = 0;
  let plotsWithSpaAnnex = 0;
  for (const docs of data.documentsByPlotId.values()) {
    documents += docs.length;
    if (docs.some((d) => d.type === "SPA_ANNEX")) plotsWithSpaAnnex += 1;
  }
  /** @type {Record<string, number>} */
  const filterOptionCounts = {};
  for (const def of filterDefinitions) {
    const values = new Set(plots.map((p) => /** @type {any} */ (p)[def.field]).filter((v) => v !== null && v !== undefined));
    filterOptionCounts[def.id] = values.size;
  }
  return {
    plots: plots.length,
    plotsWithDatabaseRecord: plots.filter((p) => p.hasDatabaseRecord).length,
    nonSalePlots: plots.filter((p) => p.isNonSale).length,
    plotsWithSpaAnnex,
    documents,
    /** sorted by count, largest first */
    landUseCounts: [...landUseCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    /** legend lines (colour classes), largest first */
    colorClassCounts: [...colorClasses.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    filterOptionCounts,
  };
}
