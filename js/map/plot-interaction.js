// @ts-check
/**
 * Mouse interaction with plots: hover outline + tooltip, click to select, click on empty map to clear.
 */
import { bboxArea } from "../data/load-data.js";
import { h, replaceChildren } from "../ui/dom.js";
import { PLOT_FILL_LAYER_ID } from "./plot-layers.js";

/** @typedef {import("../data/types.js").Plot} Plot */

/**
 * Of several plots under the mouse, pick the smallest – it is the one the user is pointing at
 * (large open-space or sea plots can lie underneath smaller plots).
 * @param {string[]} plotIds
 * @param {(id: string) => Plot | undefined} getPlot
 * @returns {string|null}
 */
export function pickPlotId(plotIds, getPlot) {
  let best = null;
  let bestArea = Infinity;
  for (const id of plotIds) {
    const area = bboxArea(getPlot(id)?.bbox);
    if (area < bestArea) {
      best = id;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Short description shown next to the mouse.
 * @param {Plot} plot
 */
export function tooltipLines(plot) {
  const kind = [plot.landUseDetail, plot.landUse].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const context = plot.engineeringName ?? plot.marketingCommunity ?? plot.subPrecinct;
  return {
    title: plot.plotCode,
    lines: [kind, context, plot.hasDatabaseRecord ? null : "No Master Asset Database record"].filter(Boolean),
  };
}

/**
 * @param {any} map
 * @param {{
 *   container: HTMLElement,
 *   getPlot: (id: string) => Plot | undefined,
 *   states: ReturnType<typeof import("./plot-layers.js").createPlotStateController>,
 *   onSelect: (id: string) => void,
 *   onClear: () => void,
 * }} deps
 */
export function bindPlotInteraction(map, { container, getPlot, states, onSelect, onClear }) {
  const tooltip = h("div", { class: "plot-tooltip", role: "tooltip", hidden: true });
  container.append(tooltip);
  /** @type {string|null} */
  let hoveredId = null;

  /** @param {any} point */
  function plotAt(point) {
    const features = map.queryRenderedFeatures(point, { layers: [PLOT_FILL_LAYER_ID] });
    return pickPlotId(features.map((/** @type {any} */ f) => String(f.id ?? f.properties?.plotId)), getPlot);
  }

  /** @param {string|null} id */
  function setHover(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    states.setHovered(id);
    map.getCanvas().style.cursor = id ? "pointer" : "";
  }

  /** @param {Plot} plot @param {{x: number, y: number}} point */
  function showTooltip(plot, point) {
    const { title, lines } = tooltipLines(plot);
    replaceChildren(tooltip, h("strong", { class: "plot-tooltip__title" }, title), lines.map((l) => h("span", {}, l)));
    tooltip.hidden = false;
    // Keep the tooltip inside the map area.
    const box = container.getBoundingClientRect();
    const flipX = point.x + 16 + tooltip.offsetWidth > box.width;
    const flipY = point.y + 16 + tooltip.offsetHeight > box.height;
    tooltip.style.left = `${flipX ? point.x - tooltip.offsetWidth - 12 : point.x + 14}px`;
    tooltip.style.top = `${flipY ? point.y - tooltip.offsetHeight - 12 : point.y + 14}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  map.on("mousemove", (/** @type {any} */ e) => {
    const id = plotAt(e.point);
    setHover(id);
    const plot = id ? getPlot(id) : undefined;
    if (plot) showTooltip(plot, e.point);
    else hideTooltip();
  });
  map.on("mouseout", () => {
    setHover(null);
    hideTooltip();
  });
  map.on("movestart", hideTooltip);
  map.on("click", (/** @type {any} */ e) => {
    const id = plotAt(e.point);
    if (id) onSelect(id);
    else onClear();
  });

  return {
    /** Call after the plot data was replaced (precinct change). */
    reset() {
      hoveredId = null;
      hideTooltip();
    },
  };
}
