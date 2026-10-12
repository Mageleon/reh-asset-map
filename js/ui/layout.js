// @ts-check
/**
 * Keeps the page layout in sync with the state: which side panels are open, and whether
 * the screen is wide (panels beside the map) or narrow (panels slide over the map).
 */
import { appConfig } from "../config/app-config.js";

export function isWideScreen() {
  return window.matchMedia(`(min-width: ${appConfig.wideLayoutMinWidth}px)`).matches;
}

/**
 * @param {HTMLElement} appEl
 * @param {ReturnType<typeof import("../state/store.js").createStore<import("../state/store.js").AppState>>} store
 * @param {() => any} getMap
 */
export function bindLayout(appEl, store, getMap) {
  const wideQuery = window.matchMedia(`(min-width: ${appConfig.wideLayoutMinWidth}px)`);

  function apply() {
    const s = store.get();
    appEl.dataset.layout = wideQuery.matches ? "wide" : "narrow";
    appEl.dataset.left = s.leftPanelOpen ? "open" : "closed";
    appEl.dataset.right = s.rightPanelOpen ? "open" : "closed";
    // The map area changes size when panels open/close on wide screens.
    requestAnimationFrame(() => getMap()?.resize());
  }

  store.subscribe((s, prev) => {
    if (s.leftPanelOpen !== prev.leftPanelOpen || s.rightPanelOpen !== prev.rightPanelOpen) apply();
  });
  // Crossing the breakpoint: use the sensible default for the new layout.
  wideQuery.addEventListener("change", (e) => {
    store.set({ leftPanelOpen: e.matches, rightPanelOpen: e.matches });
    apply();
  });
  // On narrow screens, Escape closes the sliding panels.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !wideQuery.matches) store.set({ leftPanelOpen: false, rightPanelOpen: false });
  });
  apply();
}
