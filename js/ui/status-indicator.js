// @ts-check
/**
 * Small "system status" button in the header. Opens a panel listing the start-up checks
 * (data, map engine, background map) and which data version is loaded.
 */
import { h, replaceChildren } from "./dom.js";
import { formatDateTime } from "./format.js";

/** @typedef {"ok"|"warn"|"fail"|"pending"} CheckState */

const SUMMARY = {
  ok: "All systems OK",
  warn: "Running with warnings",
  fail: "Problem – see details",
  pending: "Starting…",
};

export function createStatusIndicator() {
  /** @type {Map<string, {state: CheckState, detail: string}>} */
  const checks = new Map();
  /** @type {{generatedAt?: string, sources?: Record<string, {path: string}>}} */
  let dataInfo = {};

  const dot = h("span", { class: "status__dot" });
  const label = h("span", { class: "status__label" });
  const panel = h("div", { class: "status__panel", id: "status-panel", role: "dialog", "aria-label": "System status", hidden: true });
  const button = h("button", { class: "status__button", type: "button", "aria-expanded": "false", "aria-controls": "status-panel",
    onclick: () => setOpen(panel.hidden) }, dot, label);
  const root = h("div", { class: "status" }, button, panel);

  /** @param {boolean} open */
  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  document.addEventListener("click", (e) => { if (!root.contains(/** @type {Node} */ (e.target))) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  function render() {
    const states = [...checks.values()].map((c) => c.state);
    /** @type {CheckState} */
    const overall = states.includes("fail") ? "fail" : states.includes("pending") ? "pending"
      : states.includes("warn") ? "warn" : "ok";
    root.dataset.state = overall;
    label.textContent = SUMMARY[overall];
    replaceChildren(panel,
      h("h3", { class: "status__title" }, "System status"),
      h("ul", { class: "status__list" }, [...checks.entries()].map(([name, c]) =>
        h("li", { class: `check check--${c.state}` }, h("span", { class: "check__label" }, name), h("span", { class: "check__detail" }, c.detail)))),
      dataInfo.generatedAt && h("p", { class: "status__meta" }, `Map data built ${formatDateTime(dataInfo.generatedAt)}`),
      dataInfo.sources && h("ul", { class: "status__sources" }, Object.entries(dataInfo.sources).map(([kind, s]) =>
        h("li", {}, h("span", { class: "status__source-kind" }, kind === "gis" ? "GIS" : "Database"), " ", s.path.split("/").pop()))),
    );
  }

  render();
  return {
    element: root,
    /** @param {string} name @param {CheckState} state @param {string} detail */
    report(name, state, detail) {
      checks.set(name, { state, detail });
      render();
    },
    /** @param {{generatedAt?: string, sources?: Record<string, {path: string}>}} info */
    setDataInfo(info) {
      dataInfo = info;
      render();
    },
  };
}
