// @ts-check
/**
 * Loads the processed data (data/processed, built by scripts/data_build.py) and joins
 * plots, geometry and documents in memory. No business data is hard-coded here.
 */
import { appConfig } from "../config/app-config.js";
import { spaAnnexState } from "./documents.js";

/** @typedef {import("./types.js").Manifest} Manifest */
/** @typedef {import("./types.js").PrecinctEntry} PrecinctEntry */
/** @typedef {import("./types.js").PrecinctData} PrecinctData */
/** @typedef {import("./types.js").Plot} Plot */
/** @typedef {import("./types.js").PlotDocument} PlotDocument */

/** An error with a message that is safe to show to a normal user. */
export class DataLoadError extends Error {
  /**
   * @param {string} userMessage  plain-language explanation
   * @param {string} [detail]     technical detail (console only)
   */
  constructor(userMessage, detail = "") {
    super(detail || userMessage);
    this.name = "DataLoadError";
    this.userMessage = userMessage;
  }
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 */
async function fetchJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    throw new DataLoadError("The map data could not be reached. Is the map started with run-app.bat?", `${url}: ${err}`);
  }
  if (!response.ok) {
    throw new DataLoadError("Part of the map data is missing. Please rebuild the data (run-data-build.bat).",
      `${url}: HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw new DataLoadError("The map data is damaged. Please rebuild the data (run-data-build.bat).", `${url}: ${err}`);
  }
}

/**
 * Check the manifest has the shape and version this app understands.
 * @param {any} manifest
 * @param {number} supportedVersion
 * @returns {Manifest}
 */
export function validateManifest(manifest, supportedVersion) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.precincts)) {
    throw new DataLoadError("The map data index is not valid. Please rebuild the data (run-data-build.bat).",
      "manifest.json: missing precincts list");
  }
  if (manifest.schemaVersion !== supportedVersion) {
    throw new DataLoadError("The map data was built for a different version of the application. Please rebuild the data.",
      `manifest schemaVersion ${manifest.schemaVersion}, app supports ${supportedVersion}`);
  }
  if (manifest.precincts.length === 0) {
    throw new DataLoadError("No precincts are available in the map data.", "manifest.precincts is empty");
  }
  return manifest;
}

/**
 * @param {string} baseUrl
 * @param {number} supportedVersion
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Manifest>}
 */
export async function loadManifest(baseUrl, supportedVersion, fetchImpl = fetch) {
  return validateManifest(await fetchJson(`${baseUrl}manifest.json`, fetchImpl), supportedVersion);
}

/**
 * Size of a bounding box in square degrees (only used to compare plots with each other).
 * @param {number[] | undefined} bbox
 */
export function bboxArea(bbox) {
  return bbox ? Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) : 0;
}

/**
 * Join the three files of one precinct. Inconsistencies are collected in `problems`, never thrown,
 * so one bad record cannot stop the whole map from loading.
 * @param {PrecinctEntry} precinct
 * @param {Plot[]} plots
 * @param {GeoJSON.FeatureCollection} geometry
 * @param {PlotDocument[]} documents
 * @returns {PrecinctData}
 */
export function joinPrecinctData(precinct, plots, geometry, documents) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, Plot>} */
  const plotsById = new Map();
  for (const plot of plots) {
    if (plotsById.has(plot.id)) problems.push(`duplicate plot record ${plot.id}`);
    else plotsById.set(plot.id, plot);
  }

  const withGeometry = new Set();
  const features = [];
  for (const feature of geometry.features) {
    const plotId = feature.properties?.plotId;
    const plot = plotId ? plotsById.get(plotId) : undefined;
    if (!plot) {
      problems.push(`map shape without plot record: ${plotId ?? "(no id)"}`);
      continue;
    }
    withGeometry.add(plotId);
    // A few plot properties are copied onto the shape so the map can style, label and filter it.
    features.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        plotId,
        plotCode: plot.plotCode,
        landUse: plot.landUse,
        landUseDetail: plot.landUseDetail,
        hasDatabaseRecord: plot.hasDatabaseRecord,
        isNonSale: plot.isNonSale,
      },
    });
  }
  // Draw large plots first so smaller plots lying on top of them stay visible and clickable.
  features.sort((a, b) => bboxArea(plotsById.get(b.properties.plotId)?.bbox) - bboxArea(plotsById.get(a.properties.plotId)?.bbox));
  for (const id of plotsById.keys()) {
    if (!withGeometry.has(id)) problems.push(`plot record without map shape: ${id}`);
  }

  // One label point per plot (a polygon cut into map tiles would otherwise be labelled once per tile).
  const labels = [];
  for (const plot of plotsById.values()) {
    if (!withGeometry.has(plot.id) || !Array.isArray(plot.labelPoint)) continue;
    labels.push({ type: "Feature", geometry: { type: "Point", coordinates: plot.labelPoint },
      properties: { plotId: plot.id, plotCode: plot.plotCode, labelAngle: plot.labelAngle ?? 0,
        labelSize: plot.labelSize ?? 0, labelSizeHorizontal: plot.labelSizeHorizontal ?? 0,
        // Size of screen-level text for the current map rotation (updated when the map is rotated).
        labelSizeView: plot.labelSizeHorizontal ?? 0 } });
  }

  /** @type {Map<string, PlotDocument[]>} */
  const documentsByPlotId = new Map();
  for (const doc of documents) {
    if (!plotsById.has(doc.plotId)) {
      problems.push(`document for unknown plot: ${doc.id}`);
      continue;
    }
    const list = documentsByPlotId.get(doc.plotId) ?? [];
    list.push(doc);
    documentsByPlotId.set(doc.plotId, list);
  }
  // Worked out here (not stored in the data files) so the "SPA Annex" filter can use it like any other field.
  for (const plot of plotsById.values()) plot.spaAnnex = spaAnnexState(plot, documentsByPlotId.get(plot.id) ?? [], appConfig.spaAnnexNotRequiredStatuses);

  return {
    precinct,
    plotsById,
    documentsByPlotId,
    geometry: /** @type {GeoJSON.FeatureCollection} */ ({ type: "FeatureCollection", features }),
    labels: /** @type {GeoJSON.FeatureCollection} */ ({ type: "FeatureCollection", features: labels }),
    problems,
  };
}

/**
 * @param {string} baseUrl
 * @param {PrecinctEntry} precinct
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<PrecinctData>}
 */
export async function loadPrecinct(baseUrl, precinct, fetchImpl = fetch) {
  const [plots, geometry, documents] = await Promise.all([
    fetchJson(baseUrl + precinct.files.plots, fetchImpl),
    fetchJson(baseUrl + precinct.files.geometry, fetchImpl),
    fetchJson(baseUrl + precinct.files.documents, fetchImpl),
  ]);
  const data = joinPrecinctData(precinct, plots, geometry, documents);
  if (data.problems.length) {
    console.warn(`[data] ${precinct.code}: ${data.problems.length} data problem(s)`, data.problems);
  }
  return data;
}
