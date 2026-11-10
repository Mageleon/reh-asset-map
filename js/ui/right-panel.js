// @ts-check
/**
 * Right panel: plot information. Until a plot is selected it explains how to use the map
 * and shows the precinct at a glance.
 */
import { h, replaceChildren } from "./dom.js";
import { formatCount } from "./format.js";
import { icon } from "./icons.js";
import { renderPlotDetails } from "./plot-details.js";

const STEPS = ["Search or filter", "Select a plot on the map", "Review its information", "Open its documents"];

/**
 * @param {HTMLElement} root
 * @param {{ onClose: () => void }} deps
 */
export function renderRightPanel(root, { onClose }) {
  const body = h("div", { class: "panel__body" });
  replaceChildren(root,
    h("div", { class: "panel__header" },
      h("h2", { class: "panel__title" }, "Plot information"),
      h("button", { class: "icon-button panel__close", type: "button", "aria-label": "Close plot information", onclick: onClose }, icon("close"))),
    body);

  return {
    /**
     * @param {string} precinctName
     * @param {ReturnType<typeof import("../data/precinct-summary.js").summarizePrecinct>} summary
     */
    showEmptyState(precinctName, summary) {
      replaceChildren(body,
        h("div", { class: "empty-state" },
          h("div", { class: "empty-state__icon" }, icon("pointer")),
          h("p", { class: "empty-state__title" }, "No plot selected"),
          h("p", { class: "empty-state__text" }, "Select a plot to see its identifiers, development data and documents."),
          h("ol", { class: "steps" }, STEPS.map((step) => h("li", { class: "steps__item" }, step)))),
        h("section", { class: "panel-section" },
          h("div", { class: "panel-section__header" },
            h("h3", { class: "panel-section__title" }, `${precinctName} at a glance`)),
          h("dl", { class: "stat-grid" },
            stat("Plots on the map", summary.plots),
            stat("Linked to Master Asset Database", summary.plotsWithDatabaseRecord),
            stat("Open space & infrastructure", summary.nonSalePlots),
            stat("Plots with SPA Annex", summary.plotsWithSpaAnnex))));
    },

    /**
     * Full information for the selected plot.
     * @param {import("../data/types.js").Plot} plot
     * @param {import("../data/types.js").PlotDocument[]} documents
     * @param {{ id: string, label: string }[]} documentTypes
     * @param {{ onZoom: () => void, onClear: () => void, onCopyLink: () => Promise<boolean>, getLink: () => string,
     *           onPreview: (doc: import("../data/types.js").PlotDocument) => void }} actions
     */
    showSelectedPlot(plot, documents, documentTypes, actions) {
      replaceChildren(body, renderPlotDetails(plot, documents, documentTypes, actions));
      body.parentElement?.scrollTo({ top: 0 });
    },
  };
}

/** @param {string} label @param {number} value */
function stat(label, value) {
  return h("div", { class: "stat" }, h("dt", { class: "stat__label" }, label), h("dd", { class: "stat__value" }, formatCount(value)));
}
