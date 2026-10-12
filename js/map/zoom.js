// @ts-check
/** Zooming helpers that keep plots clear of panels lying over the map. */
import { appConfig } from "../config/app-config.js";

/**
 * Map padding so a zoom target is not hidden behind sliding panels (narrow layout only;
 * on wide screens the panels sit beside the map).
 * @param {{ base: number, leftOverlay: number, rightOverlay: number }} input  overlay widths in px (0 if none)
 */
export function computeMapPadding({ base, leftOverlay, rightOverlay }) {
  return { top: base, bottom: base, left: base + leftOverlay, right: base + rightOverlay };
}

/** Measures panels that currently lie over the map. */
export function currentMapPadding() {
  const app = document.getElementById("app");
  const narrow = app?.dataset.layout === "narrow";
  const width = (/** @type {string} */ selector, /** @type {string} */ flag) =>
    narrow && app?.dataset[flag] === "open" ? (document.querySelector(selector)?.getBoundingClientRect().width ?? 0) : 0;
  return computeMapPadding({
    base: appConfig.map.fitPadding,
    leftOverlay: width(".panel--left", "left"),
    rightOverlay: width(".panel--right", "right"),
  });
}

/**
 * @param {any} map
 * @param {[number, number, number, number]} bbox
 * @param {{ animate?: boolean }} [options]
 */
export function zoomToBounds(map, bbox, { animate = true } = {}) {
  map.fitBounds(bbox, { padding: currentMapPadding(), maxZoom: appConfig.map.plotZoomMax, duration: animate ? 700 : 0 });
}
