// @ts-check
/** Application header: branding, panel toggles, global search, precinct selector, status. */
import { appConfig } from "../config/app-config.js";
import { h, replaceChildren } from "./dom.js";
import { brandMark, icon } from "./icons.js";

/**
 * @param {HTMLElement} root
 * @param {{
 *   store: ReturnType<typeof import("../state/store.js").createStore<import("../state/store.js").AppState>>,
 *   statusElement: HTMLElement,
 *   searchElement: HTMLElement,
 * }} deps
 */
export function renderHeader(root, { store, statusElement, searchElement }) {
  const filtersToggle = h("button", { class: "header-button", type: "button", "aria-controls": "left-panel",
    title: "Show or hide filters and layers", onclick: () => store.set({ leftPanelOpen: !store.get().leftPanelOpen }) },
  icon("filter"), h("span", { class: "header-button__text" }, "Filters"));

  const detailsToggle = h("button", { class: "header-button", type: "button", "aria-controls": "right-panel",
    title: "Show or hide plot information", onclick: () => store.set({ rightPanelOpen: !store.get().rightPanelOpen }) },
  icon("details"), h("span", { class: "header-button__text" }, "Details"));

  const precinctSelect = h("select", { class: "precinct-select__input", id: "precinct-select", "aria-label": "Precinct",
    onchange: (/** @type {Event} */ e) => store.set({ precinctCode: /** @type {HTMLSelectElement} */ (e.target).value, selectedPlotId: null, filters: {} }) });

  replaceChildren(root,
    h("div", { class: "app-header__start" },
      filtersToggle,
      h("div", { class: "brand" }, brandMark(),
        h("div", { class: "brand__text" },
          h("span", { class: "brand__title" }, appConfig.appName),
          h("span", { class: "brand__subtitle" }, appConfig.appSubtitle)))),
    h("div", { class: "app-header__center" }, searchElement),
    h("div", { class: "app-header__end" },
      h("label", { class: "precinct-select" }, h("span", { class: "precinct-select__label" }, "Precinct"), precinctSelect),
      statusElement,
      detailsToggle),
  );

  function syncToggles() {
    const s = store.get();
    filtersToggle.setAttribute("aria-expanded", String(s.leftPanelOpen));
    detailsToggle.setAttribute("aria-expanded", String(s.rightPanelOpen));
    precinctSelect.value = s.precinctCode ?? "";
  }
  store.subscribe(syncToggles);
  syncToggles();

  return {
    /** @param {import("../data/types.js").PrecinctEntry[]} precincts */
    setPrecincts(precincts) {
      replaceChildren(precinctSelect, precincts.map((p) => h("option", { value: p.code }, `${p.name} · ${p.code}`)));
      precinctSelect.disabled = precincts.length < 2;
      syncToggles();
    },
  };
}
