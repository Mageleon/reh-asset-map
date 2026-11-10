// @ts-check
/** Left panel: filters and land-use legend. (Plot-code display options are a map button: map/label-mode-control.js.) */
import { appConfig } from "../config/app-config.js";
import { colorClassOf } from "../data/colors.js";
import { activeFilterCount, filterOptions, NOT_SET } from "../data/filters.js";
import { h, replaceChildren } from "./dom.js";
import { formatCount } from "./format.js";
import { icon } from "./icons.js";

/** @typedef {import("../data/types.js").Plot} Plot */
/** @typedef {import("../data/filters.js").ActiveFilters} ActiveFilters */

/**
 * @param {HTMLElement} root
 * @param {{
 *   onClose: () => void,
 *   onZoomToFiltered: () => void,
 *   store: ReturnType<typeof import("../state/store.js").createStore<import("../state/store.js").AppState>>,
 * }} deps
 */
export function renderLeftPanel(root, { onClose, onZoomToFiltered, store }) {
  const filtersBody = h("div", { class: "panel-section__body" });
  const filterSummary = h("div", { class: "filter-summary", "aria-live": "polite" });
  const legendBody = h("div", { class: "panel-section__body" });
  const activeBadge = h("span", { class: "count-badge", hidden: true });
  const clearAll = /** @type {HTMLButtonElement} */ (h("button", { class: "text-button", type: "button", disabled: true,
    onclick: () => store.set({ filters: {} }) }, "Clear all"));

  /** @type {Plot[]} */
  let plots = [];
  /** Filter groups the user has opened (kept while the list is redrawn). */
  const expanded = new Set();

  // ---------------------------------------------------------------- filters
  /** @param {string} filterId @param {string} value @param {boolean} checked */
  function toggleValue(filterId, value, checked) {
    expanded.add(filterId); // keep the group open while the user is ticking
    const current = /** @type {ActiveFilters} */ (store.get().filters);
    const values = new Set(current[filterId] ?? []);
    if (checked) values.add(value);
    else values.delete(value);
    store.set({ filters: { ...current, [filterId]: [...values] } });
  }

  function renderFilters() {
    const active = /** @type {ActiveFilters} */ (store.get().filters);
    const options = filterOptions(plots, appConfig.filterDefinitions, active);
    const focusedKey = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.filterKey;

    replaceChildren(filtersBody, h("ul", { class: "filter-groups" }, appConfig.filterDefinitions.map((def) => {
      const ticked = active[def.id] ?? [];
      const isOpen = expanded.has(def.id);
      const bodyId = `filter-${def.id}`;
      const header = h("button", { class: "filter-group__header", type: "button", "aria-expanded": String(isOpen),
        "aria-controls": bodyId, dataset: { filterKey: `group:${def.id}` },
        onclick: () => {
          if (expanded.has(def.id)) expanded.delete(def.id);
          else expanded.add(def.id);
          renderFilters();
        } },
      h("span", { class: "filter-group__label" }, def.label),
      ticked.length ? h("span", { class: "count-badge" }, String(ticked.length))
        : h("span", { class: "filter-group__meta" }, `${options[def.id].length}`),
      icon("chevron", "icon filter-group__chevron"));

      const list = isOpen && h("ul", { class: "filter-options", id: bodyId },
        options[def.id].map((opt) => {
          const checked = ticked.includes(opt.value);
          const label = opt.value === NOT_SET ? appConfig.filterNotSetLabel : opt.value;
          const key = `${def.id}:${opt.value}`;
          return h("li", { class: opt.count === 0 && !checked ? "filter-option filter-option--empty" : "filter-option" },
            h("label", { class: "filter-option__label" },
              h("input", { type: "checkbox", checked, dataset: { filterKey: key },
                onchange: (/** @type {Event} */ e) => toggleValue(def.id, opt.value,
                  /** @type {HTMLInputElement} */ (e.target).checked) }),
              h("span", { class: "filter-option__text" }, label),
              h("span", { class: "filter-option__count" }, formatCount(opt.count))));
        }));
      return h("li", { class: "filter-group" }, header, list);
    })));

    // Keep keyboard focus on the same control after redrawing.
    if (focusedKey) /** @type {HTMLElement|null} */ (filtersBody.querySelector(`[data-filter-key="${CSS.escape(focusedKey)}"]`))?.focus();

    const count = activeFilterCount(active);
    activeBadge.hidden = count === 0;
    activeBadge.textContent = String(count);
    clearAll.disabled = count === 0;
  }

  /** @type {ReturnType<typeof import("../data/precinct-summary.js").summarizePrecinct>["colorClassCounts"]} */
  let legendTotals = [];

  /**
   * Land-use legend. With filters active each line shows "matching / total" plots.
   * @param {Set<string> | null} matchingIds
   */
  function renderLegend(matchingIds) {
    /** @type {Map<string, number>} */
    const matching = new Map();
    if (matchingIds) {
      for (const plot of plots) {
        if (!matchingIds.has(plot.id)) continue;
        const label = colorClassOf(plot).label;
        matching.set(label, (matching.get(label) ?? 0) + 1);
      }
    }
    replaceChildren(legendBody,
      h("ul", { class: "legend" }, legendTotals.map((c) => {
        const shown = matchingIds ? (matching.get(c.label) ?? 0) : c.count;
        return h("li", { class: matchingIds && shown === 0 ? "legend__item legend__item--empty" : "legend__item" },
          h("span", { class: "legend__swatch", style: { background: c.color } }),
          h("span", { class: "legend__label" }, c.label),
          h("span", { class: "legend__count" },
            matchingIds ? [h("strong", {}, formatCount(shown)), ` / ${formatCount(c.count)}`] : formatCount(c.count)));
      })),
      matchingIds && h("p", { class: "panel-note" }, "Matching plots / all plots, for the active filters."));
  }

  /** @param {Set<string>|null} matchingIds  null = no filter active */
  function renderFilterSummary(matchingIds) {
    renderLegend(matchingIds);
    const matching = matchingIds ? matchingIds.size : null;
    if (matching === null) {
      replaceChildren(filterSummary, h("span", {}, `All ${formatCount(plots.length)} plots shown`));
      return;
    }
    if (matching === 0) {
      replaceChildren(filterSummary,
        h("span", { class: "filter-summary__empty" },
          h("strong", {}, "No plots match all these filters."), " Untick an option or use “Clear all”."));
      return;
    }
    replaceChildren(filterSummary,
      h("span", {}, h("strong", {}, formatCount(matching)), ` of ${formatCount(plots.length)} plots match`),
      h("button", { class: "text-button", type: "button", onclick: onZoomToFiltered }, "Zoom to these"));
  }

  replaceChildren(root,
    h("div", { class: "panel__header" },
      h("h2", { class: "panel__title" }, "Explore"),
      h("button", { class: "icon-button panel__close", type: "button", "aria-label": "Close filters", onclick: onClose }, icon("close"))),
    h("section", { class: "panel-section", "aria-labelledby": "filters-title" },
      h("div", { class: "panel-section__header" },
        h("h3", { class: "panel-section__title", id: "filters-title" }, "Filters ", activeBadge),
        clearAll),
      filterSummary,
      filtersBody),
    h("section", { class: "panel-section", "aria-labelledby": "layers-title" },
      h("div", { class: "panel-section__header" },
        h("h3", { class: "panel-section__title", id: "layers-title" }, "Land use")),
      legendBody),
  );

  store.subscribe((s, prev) => {
    if (s.filters !== prev.filters) renderFilters();
  });

  return {
    /**
     * New precinct data.
     * @param {Plot[]} precinctPlots
     * @param {ReturnType<typeof import("../data/precinct-summary.js").summarizePrecinct>} summary
     */
    setData(precinctPlots, summary) {
      plots = precinctPlots;
      legendTotals = summary.colorClassCounts;
      renderFilters();
      renderLegend(null);
    },
    /** Update counts and legend for the active filters. @param {Set<string>|null} matchingIds */
    setMatching: renderFilterSummary,
  };
}
