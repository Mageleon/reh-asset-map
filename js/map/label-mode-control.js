// @ts-check
/**
 * Map button (under the zoom / compass buttons) that opens the "Plot codes on the map" options:
 * aligned to plot, horizontal or off. The choice lives in the app store (saved in the browser).
 */
import { appConfig } from "../config/app-config.js";
import { h } from "../ui/dom.js";
import { icon } from "../ui/icons.js";

/** @typedef {"aligned"|"horizontal"|"off"} LabelMode */

export class LabelModeControl {
  /**
   * @param {{ get: () => { labelMode: LabelMode }, set: (patch: { labelMode: LabelMode }) => void,
   *           subscribe: (fn: (s: any, prev: any) => void) => any }} store
   */
  constructor(store) {
    this.store = store;
    this.container = h("div", { class: "maplibregl-ctrl label-mode-control" });
    /** @type {(() => void) | null} */
    this.cleanup = null;
  }

  onAdd() {
    const popover = h("div", { class: "label-mode-control__popover", id: "label-mode-popover", role: "dialog",
      "aria-labelledby": "label-mode-title", hidden: true });
    const toggle = /** @type {HTMLButtonElement} */ (h("button", { class: "label-mode-control__button", type: "button",
      title: "Plot codes on the map", "aria-label": "Plot codes on the map", "aria-expanded": "false",
      "aria-controls": "label-mode-popover" }, icon("labels")));

    const options = appConfig.map.labelModes.map((mode) =>
      h("button", { class: "segmented__option", type: "button", role: "radio", dataset: { mode: mode.id },
        onclick: () => this.store.set({ labelMode: /** @type {LabelMode} */ (mode.id) }) }, mode.label));
    const sync = () => {
      for (const option of options) {
        const active = option.dataset.mode === this.store.get().labelMode;
        option.setAttribute("aria-checked", String(active));
        option.tabIndex = active ? 0 : -1;
      }
    };

    popover.append(
      h("p", { class: "field-label", id: "label-mode-title" }, "Plot codes on the map"),
      h("div", { class: "segmented", role: "radiogroup", "aria-labelledby": "label-mode-title" }, options),
      h("p", { class: "panel-note" }, "Codes appear when you zoom in. They are sized to fit inside each plot."));

    /** @param {boolean} open */
    const setOpen = (open) => {
      popover.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("is-active", open);
    };
    toggle.addEventListener("click", () => setOpen(popover.hidden));
    /** @param {MouseEvent} e */
    const onDocClick = (e) => { if (!this.container.contains(/** @type {Node} */ (e.target))) setOpen(false); };
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === "Escape" && !popover.hidden) {
        setOpen(false);
        toggle.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    this.container.addEventListener("keydown", onKey);
    const unsubscribe = this.store.subscribe((s, prev) => { if (s.labelMode !== prev.labelMode) sync(); });
    this.cleanup = () => {
      document.removeEventListener("click", onDocClick);
      if (typeof unsubscribe === "function") unsubscribe();
    };
    sync();

    this.container.append(h("div", { class: "maplibregl-ctrl-group" }, toggle), popover);
    return this.container;
  }

  onRemove() {
    this.cleanup?.();
    this.container.remove();
  }
}
