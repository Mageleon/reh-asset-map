// @ts-check
/**
 * Global search box in the header with a results list.
 *
 * - Typing shows matching plots (all matches are reported via onResults, e.g. to highlight them).
 * - Enter with exactly one match opens it; with several, the user chooses from the list.
 *   A plot is never picked arbitrarily.
 * - Arrow keys move through the list, Enter opens, Escape closes / clears. "/" focuses the box.
 */
import { appConfig } from "../config/app-config.js";
import { h, replaceChildren } from "./dom.js";
import { formatCount, plural } from "./format.js";
import { icon } from "./icons.js";

/** @typedef {import("../data/search.js").SearchResult} SearchResult */

/**
 * @param {{
 *   search: (query: string) => SearchResult[],
 *   scope: () => ({ filtered: number, total: number } | null),
 *   describe: (plotId: string) => { kind: string, context: string },
 *   onResults: (results: SearchResult[]) => void,
 *   onChoose: (plotId: string) => void,
 *   onShowAll: (plotIds: string[]) => void,
 * }} deps
 */
export function createSearchBox({ search, scope, describe, onResults, onChoose, onShowAll }) {
  const listId = "search-results";
  const input = /** @type {HTMLInputElement} */ (h("input", {
    class: "search__input", type: "text", autocomplete: "off", spellcheck: "false",
    role: "combobox", "aria-expanded": "false", "aria-controls": listId, "aria-autocomplete": "list",
    "aria-label": "Search plots", placeholder: "Search plot, block, project or community  ( / )",
  }));
  const clearButton = h("button", { class: "search__clear", type: "button", "aria-label": "Clear search", hidden: true,
    onclick: () => { clear(); input.focus(); } }, icon("close"));
  const panel = h("div", { class: "search__panel", hidden: true });
  const root = h("div", { class: "search" }, icon("search", "icon search__icon"), input, clearButton, panel);

  /** @type {SearchResult[]} */
  let results = [];
  let active = -1;
  let timer = 0;
  /** @type {HTMLElement[]} */
  let options = [];

  function open() {
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function close() {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  }
  function clear() {
    input.value = "";
    results = [];
    clearButton.hidden = true;
    replaceChildren(panel);
    close();
    onResults([]);
  }

  /** @param {number} index */
  function setActive(index) {
    active = index;
    options.forEach((el, i) => el.setAttribute("aria-selected", String(i === index)));
    if (index >= 0 && options[index]) {
      input.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  /** @param {string} plotId */
  function choose(plotId) {
    close();
    onChoose(plotId);
  }

  function render() {
    const query = input.value.trim();
    clearButton.hidden = !input.value;
    if (!query) {
      clear();
      return;
    }
    results = search(query);
    onResults(results);
    const listed = results.slice(0, appConfig.searchMaxListed);
    options = listed.map((r, i) => {
      const { kind, context } = describe(r.plotId);
      const why = r.matchLabel === "Plot Code" ? null : `${r.matchLabel}: ${r.matchValue}`;
      return h("li", { class: "search-result", id: `search-option-${i}`, role: "option", "aria-selected": "false",
        onmousedown: (/** @type {Event} */ e) => e.preventDefault(), // keep focus in the input
        onclick: () => choose(r.plotId),
        onmousemove: () => setActive(i) },
      h("span", { class: "search-result__main" },
        h("span", { class: "search-result__code" }, r.plotCode),
        kind && h("span", { class: "search-result__kind" }, kind)),
      h("span", { class: "search-result__meta" }, [why, context].filter(Boolean).join(" · ")));
    });

    const limited = scope();
    const filterNote = limited && h("div", { class: "search__filter-note" }, icon("filter"),
      h("span", {}, `Filters active – searching ${formatCount(limited.filtered)} of ${formatCount(limited.total)} plots.`));
    if (!results.length) {
      replaceChildren(panel,
        filterNote,
        h("div", { class: "search__empty" },
          h("strong", {}, limited ? `No plots match “${query}” within the active filters.` : `No plots match “${query}”.`),
          h("span", {}, limited
            ? "Clear or change the filters (left panel) to search all plots."
            : "Try a plot code (e.g. WE-01A), a block (BO-13), a project (South Plots) or a community (Wadi East).")));
    } else {
      replaceChildren(panel,
        filterNote,
        h("div", { class: "search__summary" },
          h("span", {}, results.length === 1 ? "1 plot matches – press Enter to open" : `${plural(results.length, "plot")} match – choose one`),
          results.length > 1 && h("button", { class: "text-button", type: "button",
            onmousedown: (/** @type {Event} */ e) => e.preventDefault(),
            onclick: () => { close(); onShowAll(results.map((r) => r.plotId)); } }, "Show all on map")),
        h("ul", { class: "search__list", id: listId, role: "listbox", "aria-label": "Matching plots" }, options),
        results.length > listed.length && h("p", { class: "search__more" },
          `Showing the best ${formatCount(listed.length)} of ${formatCount(results.length)} – type more to narrow down. All matches are outlined on the map.`));
    }
    open();
    setActive(-1);
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(render, 120);
  });
  input.addEventListener("focus", () => { if (input.value.trim() && results.length) open(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      open();
      setActive(Math.min(active + 1, options.length - 1));
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timer);
      if (panel.hidden || !results.length) render();
      if (active >= 0 && results[active]) choose(results[active].plotId);
      else if (results.length === 1) choose(results[0].plotId);
      else if (results.length > 1) setActive(0); // several matches: let the user choose
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (!panel.hidden) close();
      else clear();
    }
  });
  document.addEventListener("mousedown", (e) => { if (!root.contains(/** @type {Node} */ (e.target))) close(); });
  document.addEventListener("keydown", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (e.key === "/" && !target.closest?.("input, textarea, select")) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  return {
    element: root,
    /** Re-run the current search (e.g. after the precinct changed). */
    refresh() { if (input.value.trim()) render(); },
    clear,
  };
}
