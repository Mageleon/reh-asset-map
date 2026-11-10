// @ts-check
/**
 * Plot filters (no page elements here, so it is easy to test).
 *
 * - Within one filter, ticked values are alternatives (Design Package = DP03 OR DP07).
 * - Different filters must all match (Design Package … AND Land Use …).
 * - Plots with no value in a field can be found with the "(Not set)" option.
 * - Option counts show how many plots each value would give together with the *other* active
 *   filters, so the user sees in advance what a tick will do.
 */

/** @typedef {import("./types.js").Plot} Plot */
/** @typedef {{ id: string, label: string, field: string }} FilterDefinition */
/** @typedef {Record<string, string[]>} ActiveFilters  filter id -> ticked values */

export const NOT_SET = "__not_set__";

/** @param {Plot} plot @param {FilterDefinition} def */
function valueOf(plot, def) {
  const value = /** @type {any} */ (plot)[def.field];
  return value === null || value === undefined || value === "" ? NOT_SET : String(value);
}

/** Number of filters with at least one ticked value. @param {ActiveFilters} active */
export function activeFilterCount(active) {
  return Object.values(active).filter((values) => values && values.length).length;
}

/**
 * @param {Plot} plot
 * @param {readonly FilterDefinition[]} defs
 * @param {ActiveFilters} active
 * @param {string} [ignoreId]  leave this filter out (used for option counts)
 */
export function plotMatches(plot, defs, active, ignoreId) {
  for (const def of defs) {
    if (def.id === ignoreId) continue;
    const ticked = active[def.id];
    if (ticked && ticked.length && !ticked.includes(valueOf(plot, def))) return false;
  }
  return true;
}

/**
 * Ids of plots matching all active filters (null when no filter is active = everything matches).
 * @param {Iterable<Plot>} plots
 * @param {readonly FilterDefinition[]} defs
 * @param {ActiveFilters} active
 * @returns {Set<string> | null}
 */
export function matchingPlotIds(plots, defs, active) {
  if (!activeFilterCount(active)) return null;
  const ids = new Set();
  for (const plot of plots) if (plotMatches(plot, defs, active)) ids.add(plot.id);
  return ids;
}

/**
 * Options for every filter with the number of plots each would give.
 * Values are sorted naturally (DP01, DP02 … DP10); "(Not set)" comes last.
 * @param {Iterable<Plot>} plots
 * @param {readonly FilterDefinition[]} defs
 * @param {ActiveFilters} active
 * @returns {Record<string, { value: string, count: number, total: number }[]>}
 */
export function filterOptions(plots, defs, active) {
  const list = [...plots];
  /** @type {Record<string, { value: string, count: number, total: number }[]>} */
  const result = {};
  for (const def of defs) {
    /** @type {Map<string, { count: number, total: number }>} */
    const counts = new Map();
    for (const plot of list) {
      const value = valueOf(plot, def);
      const entry = counts.get(value) ?? { count: 0, total: 0 };
      entry.total += 1;
      if (plotMatches(plot, defs, active, def.id)) entry.count += 1;
      counts.set(value, entry);
    }
    result[def.id] = [...counts.entries()]
      .map(([value, c]) => ({ value, ...c }))
      .sort((a, b) => Number(a.value === NOT_SET) - Number(b.value === NOT_SET)
        || a.value.localeCompare(b.value, "en", { numeric: true, sensitivity: "base" }));
  }
  return result;
}
