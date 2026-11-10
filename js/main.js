// @ts-check
/**
 * Application start-up: builds the shell, loads the data for the selected precinct, starts the map
 * and connects map selection with the information panel and the page address.
 */
import { appConfig } from "./config/app-config.js";
import { DataLoadError, loadManifest, loadPrecinct } from "./data/load-data.js";
import { summarizePrecinct } from "./data/precinct-summary.js";
import { buildSearchIndex, searchPlots } from "./data/search.js";
import { matchingPlotIds } from "./data/filters.js";
import { createMap, getMapLibre } from "./map/create-map.js";
import { LabelModeControl } from "./map/label-mode-control.js";
import { bindPlotInteraction } from "./map/plot-interaction.js";
import { levelTextSizes, preparePlotShapes } from "./map/label-fit.js";
import { createPlotStateController, setLabelMode, setPlotData, setViewLabelSizes } from "./map/plot-layers.js";
import { zoomToBounds } from "./map/zoom.js";
import { merge } from "./map/bounds.js";
import { loadLabelMode, saveLabelMode } from "./state/preferences.js";
import { createStore } from "./state/store.js";
import { precinctOfPlotId, readPlotParam, writePlotToUrl } from "./state/url-state.js";
import { formatCount } from "./ui/format.js";
import { renderHeader } from "./ui/header.js";
import { bindLayout, isWideScreen } from "./ui/layout.js";
import { renderLeftPanel } from "./ui/left-panel.js";
import { renderRightPanel } from "./ui/right-panel.js";
import { createSearchBox } from "./ui/search-box.js";
import { createStatusIndicator } from "./ui/status-indicator.js";
import { createDocumentViewer } from "./ui/document-viewer.js";

/** @typedef {import("./data/types.js").PrecinctData} PrecinctData */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const appEl = byId("app");
const mapRegionEl = /** @type {HTMLElement} */ (document.querySelector(".map-region"));
const mapEl = byId("map");
const mapMessageEl = byId("map-message");

/** @type {ReturnType<typeof createStore<import("./state/store.js").AppState>>} */
const store = createStore({
  precinctCode: /** @type {string|null} */ (null),
  selectedPlotId: /** @type {string|null} */ (null),
  leftPanelOpen: isWideScreen(),
  rightPanelOpen: isWideScreen(),
  labelMode: /** @type {"aligned"|"horizontal"|"off"} */ (loadLabelMode(
    appConfig.map.labelModes.map((m) => m.id), appConfig.map.defaultLabelMode)),
  filters: /** @type {Record<string, string[]>} */ ({}),
});

/** Search index of the current precinct (rebuilt when the precinct changes). @type {ReturnType<typeof buildSearchIndex>} */
let searchIndex = [];
/** Plots matching the active filters (null = no filter active). @type {Set<string> | null} */
let filteredIds = null;
const searchBox = createSearchBox({
  // Search only within the plots that pass the active filters.
  search: (query) => {
    const results = searchPlots(searchIndex, query);
    return filteredIds ? results.filter((r) => filteredIds?.has(r.plotId)) : results;
  },
  scope: () => (filteredIds ? { filtered: filteredIds.size, total: currentData?.plotsById.size ?? 0 } : null),
  describe: (plotId) => {
    const plot = getPlot(plotId);
    const kind = [plot?.landUseDetail, plot?.landUse].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
    return { kind, context: plot?.marketingCommunity ?? plot?.engineeringName ?? plot?.subPrecinct ?? "" };
  },
  onResults: (results) => plotStates?.setHighlighted(results.map((r) => r.plotId)),
  onChoose: (plotId) => selectPlot(plotId, { zoom: true }),
  onShowAll: (plotIds) => {
    const box = merge(plotIds.map((id) => getPlot(id)?.bbox));
    if (box && mapController) zoomToBounds(mapController.map, box);
  },
});

const status = createStatusIndicator();
const header = renderHeader(byId("app-header"), { store, statusElement: status.element, searchElement: searchBox.element });
const leftPanel = renderLeftPanel(byId("left-panel"), {
  store,
  onClose: () => store.set({ leftPanelOpen: false }),
  onZoomToFiltered: () => {
    const box = filteredIds && merge([...filteredIds].map((id) => getPlot(id)?.bbox));
    if (box && mapController) zoomToBounds(mapController.map, box);
  },
});
const rightPanel = renderRightPanel(byId("right-panel"), { onClose: () => store.set({ rightPanelOpen: false }) });

/** @type {Awaited<ReturnType<typeof createMap>> | null} */
let mapController = null;
/** @type {ReturnType<typeof createPlotStateController> | null} */
let plotStates = null;
/** @type {ReturnType<typeof bindPlotInteraction> | null} */
let interaction = null;
bindLayout(appEl, store, () => mapController?.map);

/** @type {import("./data/types.js").Manifest | null} */
let manifest = null;
/** @type {Map<string, PrecinctData>} */
const precinctCache = new Map();
/** @type {PrecinctData | null} */
let currentData = null;
/** @type {ReturnType<typeof summarizePrecinct> | null} */
let currentSummary = null;
let loadToken = 0;
/** The precinct load in progress (started by the store subscription). @type {Promise<boolean>} */
let currentLoad = Promise.resolve(false);
let messageTimer = 0;
/** The address is only updated after a shared link (?plot=…) has been handled at start-up. */
let urlSyncReady = false;
/** In-app document viewer, created on first use (only when appConfig.documents.inAppPreview is on). @type {ReturnType<typeof createDocumentViewer> | null} */
let documentViewer = null;
/** Plot shapes in metres, for re-fitting level labels when the map is rotated (per precinct). @type {Map<string, any> | null} */
let labelShapes = null;
/** Bearing the level labels were last sized for. */
let labelBearing = 0;

/** @param {string|null} text @param {"info"|"error"} [kind] @param {number} [hideAfterMs] */
function showMapMessage(text, kind = "info", hideAfterMs = 0) {
  clearTimeout(messageTimer);
  mapMessageEl.hidden = !text;
  mapMessageEl.textContent = text ?? "";
  mapMessageEl.dataset.kind = kind;
  if (text && hideAfterMs) messageTimer = window.setTimeout(() => showMapMessage(null), hideAfterMs);
}

/** @param {string} id */
const getPlot = (id) => currentData?.plotsById.get(id);

// ------------------------------------------------------------------ selection

/**
 * Select a plot (or clear with null). Opens the information panel; zooms only when asked
 * (e.g. from a link or search), not when the user clicked the plot on the map.
 * @param {string|null} plotId
 * @param {{ zoom?: boolean, animate?: boolean }} [options]
 */
function selectPlot(plotId, { zoom = false, animate = true } = {}) {
  if (plotId && !getPlot(plotId)) return;
  store.set({ selectedPlotId: plotId, ...(plotId ? { rightPanelOpen: true } : {}) });
  if (plotId && zoom) zoomToPlot(plotId, animate);
}

/** @param {string} plotId @param {boolean} [animate] */
function zoomToPlot(plotId, animate = true) {
  const plot = getPlot(plotId);
  if (!plot || !mapController) return;
  // Panel open/closed state is applied synchronously, so the padding measured now is correct.
  zoomToBounds(mapController.map, plot.bbox, { animate });
}

function renderSelection() {
  const { selectedPlotId } = store.get();
  const plot = selectedPlotId ? getPlot(selectedPlotId) : undefined;
  plotStates?.setSelected(plot ? plot.id : null);
  if (plot) {
    rightPanel.showSelectedPlot(plot, currentData?.documentsByPlotId.get(plot.id) ?? [], manifest?.documentTypes ?? [], {
      onZoom: () => zoomToPlot(plot.id),
      onClear: () => selectPlot(null),
      onCopyLink: () => copyText(window.location.href),
      getLink: () => window.location.href,
      onPreview: (doc) => {
        documentViewer ??= createDocumentViewer();
        documentViewer.open(doc);
      },
    });
  } else if (currentData && currentSummary) {
    rightPanel.showEmptyState(currentData.precinct.name, currentSummary);
  }
  if (urlSyncReady) writePlotToUrl(plot ? plot.id : null);
}

/**
 * Copy text to the clipboard. Browsers only allow this from the window the user is working in;
 * if both methods are refused, the caller shows the text for manual copying.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older method, still supported by browsers for user-initiated copies
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

/** Apply the active filters: fade other plots, update counts and the search results. */
function applyFilters() {
  if (!currentData) return;
  filteredIds = matchingPlotIds(currentData.plotsById.values(), appConfig.filterDefinitions, store.get().filters);
  plotStates?.setDimmed(filteredIds ? [...currentData.plotsById.keys()].filter((id) => !filteredIds?.has(id)) : []);
  leftPanel.setMatching(filteredIds);
  searchBox.refresh();
}

store.subscribe((s, prev) => {
  if (s.filters !== prev.filters) applyFilters();
  if (s.labelMode !== prev.labelMode) {
    saveLabelMode(s.labelMode);
    if (mapController) setLabelMode(mapController.map, s.labelMode);
    refitLevelLabels();
  }
  if (s.precinctCode && s.precinctCode !== prev.precinctCode) currentLoad = showPrecinct(s.precinctCode);
  else if (s.selectedPlotId !== prev.selectedPlotId) renderSelection();
});

document.addEventListener("keydown", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  if (e.key !== "Escape" || target.closest?.("input, select, textarea, .status")) return;
  if (store.get().selectedPlotId) selectPlot(null);
});

// ------------------------------------------------------------------ map

/**
 * Horizontal label view: labels stay level on screen, so after the map is rotated their size is
 * recalculated to keep them inside their plots.
 * @param {boolean} [force]
 */
function refitLevelLabels(force = false) {
  if (!mapController || !currentData || store.get().labelMode !== "horizontal") return;
  const bearing = Math.round(mapController.map.getBearing() * 10) / 10;
  if (!force && bearing === labelBearing) return;
  labelBearing = bearing;
  if (bearing === 0) {
    setViewLabelSizes(mapController.map, currentData.labels, null);
    return;
  }
  labelShapes ??= preparePlotShapes(currentData.geometry, currentData.plotsById);
  setViewLabelSizes(mapController.map, currentData.labels, levelTextSizes(labelShapes, bearing));
}

async function ensureMap(/** @type {import("./data/types.js").PrecinctEntry} */ entry) {
  if (mapController) {
    mapController.setBounds(entry.bbox);
    return true;
  }
  const maplibregl = getMapLibre();
  if (!maplibregl) {
    status.report("Map engine", "fail", "The map engine could not be downloaded. The network may be blocking cdn.jsdelivr.net.");
    showMapMessage("The map could not be started. Please check the internet connection and reload the page.", "error");
    return false;
  }
  status.report("Map engine", "ok", `MapLibre ${maplibregl.getVersion?.() ?? ""}`.trim());
  status.report("Background map", "pending", "Connecting…");
  try {
    performance.mark("app:map-start");
    mapController = await createMap(mapEl, entry.bbox);
    performance.mark("app:map-ready");
  } catch (err) {
    status.report("Background map", "fail", "The map could not be started.");
    showMapMessage("The map could not be started. Please reload the page.", "error");
    console.error(err);
    return false;
  }
  const mapStatus = mapController.status;
  setTimeout(() => {
    if (mapStatus.basemap === "plain") status.report("Background map", "warn", "Online background map unreachable – plain background used.");
    else if (mapStatus.tileErrors > 0) status.report("Background map", "warn", `${mapStatus.tileErrors} background tile(s) failed to load.`);
    else status.report("Background map", "ok", "OpenFreeMap (OpenStreetMap)");
  }, 3000);
  mapController.map.addControl(new LabelModeControl(store), "top-right");
  mapController.map.on("rotateend", () => refitLevelLabels());
  plotStates = createPlotStateController(mapController.map);
  interaction = bindPlotInteraction(mapController.map, {
    container: mapRegionEl,
    getPlot,
    states: plotStates,
    onSelect: (id) => selectPlot(id),
    onClear: () => selectPlot(null),
  });
  return true;
}

// ------------------------------------------------------------------ precinct

/** @param {string} code @returns {Promise<boolean>} true when the precinct is shown */
async function showPrecinct(code) {
  const token = ++loadToken;
  const entry = manifest?.precincts.find((p) => p.code === code);
  if (!entry) return false;
  status.setDataInfo({ generatedAt: manifest?.generatedAt, sources: /** @type {any} */ (entry).sources });

  let data = precinctCache.get(code);
  if (!data) {
    showMapMessage(`Loading ${entry.name}…`);
    status.report("Map data", "pending", `Loading ${entry.name}…`);
    try {
      data = await loadPrecinct(appConfig.dataBaseUrl, entry);
      precinctCache.set(code, data);
    } catch (err) {
      if (token !== loadToken) return false;
      const message = err instanceof DataLoadError ? err.userMessage : "The map data could not be loaded.";
      status.report("Map data", "fail", message);
      showMapMessage(message, "error");
      console.error(err);
      return false;
    }
  }
  if (token !== loadToken) return false; // another precinct was chosen meanwhile
  performance.mark("app:data-ready");

  currentData = data;
  currentSummary = summarizePrecinct(data, appConfig.filterDefinitions);
  searchIndex = buildSearchIndex(data.plotsById.values(), appConfig.searchFields);
  status.report("Map data", data.problems.length ? "warn" : "ok",
    `${entry.name}: ${formatCount(currentSummary.plots)} plots, ${formatCount(currentSummary.documents)} documents`
    + (data.problems.length ? ` · ${data.problems.length} data problem(s), see browser console` : ""));
  leftPanel.setData([...data.plotsById.values()], currentSummary);
  renderSelection();

  if (!(await ensureMap(entry)) || token !== loadToken || !mapController) return false;
  setPlotData(mapController.map, data.geometry, data.labels);
  setLabelMode(mapController.map, store.get().labelMode);
  labelShapes = null;
  refitLevelLabels(true);
  plotStates?.reset();
  interaction?.reset();
  applyFilters(); // also re-runs the search for the new precinct
  renderSelection();
  status.report("Plot shapes", "ok", `${formatCount(data.geometry.features.length)} plots drawn`);
  performance.mark("app:plots-drawn");
  showMapMessage(null);
  /** @type {any} */ (window).__assetMap = { map: mapController.map, data, manifest, store, plotStates, selectPlot }; // debugging aid
  return true;
}

// ------------------------------------------------------------------ start

async function start() {
  showMapMessage("Loading map data…");
  status.report("Map data", "pending", "Loading…");
  try {
    manifest = await loadManifest(appConfig.dataBaseUrl, appConfig.supportedSchemaVersion);
  } catch (err) {
    const message = err instanceof DataLoadError ? err.userMessage : "The map data could not be loaded.";
    status.report("Map data", "fail", message);
    showMapMessage(message, "error");
    console.error(err);
    return;
  }
  header.setPrecincts(manifest.precincts);

  // A shared link may name a plot: open its precinct and select it.
  const linkedPlot = readPlotParam(window.location.search);
  const codes = manifest.precincts.map((p) => p.code);
  const precinctCode = (linkedPlot && precinctOfPlotId(linkedPlot, codes)) || codes[0];
  store.set({ precinctCode });
  const shown = await currentLoad;
  urlSyncReady = true;
  if (!linkedPlot || !shown) return;
  if (getPlot(linkedPlot)) selectPlot(linkedPlot, { zoom: true, animate: false });
  else {
    writePlotToUrl(null);
    showMapMessage(`The plot in the link (${linkedPlot}) was not found.`, "error", 6000);
  }
}

start();
