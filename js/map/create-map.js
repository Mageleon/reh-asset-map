// @ts-check
/**
 * Creates the MapLibre map. If the online basemap cannot be reached, the map still works
 * on a plain background so the plots are always visible.
 */
import { appConfig } from "../config/app-config.js";
import { FitControl } from "./fit-control.js";

/** @returns {any} the MapLibre global, or null if the library did not load */
export function getMapLibre() {
  return /** @type {any} */ (window).maplibregl ?? null;
}

/** A minimal map style with no external dependencies. */
function plainStyle() {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": appConfig.map.fallbackBackgroundColor } }],
  };
}

/**
 * Fetch the basemap style with a timeout. Returns the style object, or null if unreachable.
 * @param {string} url
 * @param {number} timeoutMs
 */
async function fetchStyle(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @typedef {Object} MapStatus
 * @property {"online"|"plain"} basemap  "plain" = basemap unreachable, plain background used
 * @property {number} tileErrors         basemap tiles that failed to load (e.g. blocked by network)
 */

/**
 * @param {HTMLElement} container
 * @param {[number, number, number, number]} bounds  area to show first
 * @returns {Promise<{map: any, status: MapStatus, setBounds: (b: [number, number, number, number]) => void}>}
 */
export async function createMap(container, bounds) {
  const maplibregl = getMapLibre();
  if (!maplibregl) throw new Error("MapLibre is not loaded");

  const basemap = appConfig.map.basemaps.find((b) => b.id === appConfig.map.defaultBasemapId) ?? appConfig.map.basemaps[0];
  const style = await fetchStyle(basemap.styleUrl, appConfig.map.basemapTimeoutMs);
  /** @type {MapStatus} */
  const status = { basemap: style ? "online" : "plain", tileErrors: 0 };

  const map = new maplibregl.Map({
    container,
    style: style ?? plainStyle(),
    bounds,
    fitBoundsOptions: { padding: appConfig.map.fitPadding },
    maxZoom: appConfig.map.maxZoom,
    attributionControl: { compact: true },
  });
  /** @type {[number, number, number, number] | null} */
  let currentBounds = bounds;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
  map.addControl(new FitControl(() => currentBounds), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

  map.on("error", (/** @type {any} */ e) => {
    // Basemap tile failures should not break the app; count them for the system check.
    if (e?.sourceId && e.sourceId !== "plots") status.tileErrors += 1;
    else console.warn("[map]", e?.error ?? e);
  });

  await new Promise((resolve) => map.once("load", resolve));
  return {
    map,
    status,
    /** Change the area used by "zoom to whole development" and go there. */
    setBounds(b) {
      currentBounds = b;
      map.fitBounds(b, { padding: appConfig.map.fitPadding, duration: 0 });
    },
  };
}
