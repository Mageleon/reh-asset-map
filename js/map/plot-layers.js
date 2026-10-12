// @ts-check
/**
 * Plot polygons on the map and their visual states.
 *
 * Each plot can be in these states (MapLibre "feature state", keyed by plotId):
 *   hover        – mouse is over the plot
 *   selected     – the plot shown in the information panel
 *   highlighted  – matches the current search
 *   dimmed       – outside the active filters
 */
import { appConfig } from "../config/app-config.js";
import { fillColorExpression } from "../data/colors.js";

export const PLOT_SOURCE_ID = "plots";
export const LABEL_SOURCE_ID = "plot-labels";
export const PLOT_FILL_LAYER_ID = "plots-fill";

/** @param {string} key */
const state = (key) => ["boolean", ["feature-state", key], false];


export const LABEL_LAYER_ID = "plots-labels";
/** Latitude used to convert label sizes from metres to pixels (set when the layers are built). */
let labelLatitude = 0;

/**
 * Screen size (px) of a plot code at each zoom level: the plot's fitted text height in metres
 * (from the data build) divided by metres-per-pixel, capped at labelMaxPx.
 * Returns [zoom, sizeExpression] stops for an interpolate expression.
 * @param {number} latitude
 * @param {"labelSize"|"labelSizeView"} sizeProperty
 */
function labelSizeStops(latitude, sizeProperty) {
  const { labelMinZoom, labelMaxPx } = appConfig.map;
  const metresPerPixelAtZ0 = 78271.517 * Math.cos((latitude * Math.PI) / 180); // 512-px tiles
  /** @type {[number, any][]} */
  const stops = [];
  for (let z = Math.floor(labelMinZoom * 2) / 2; z <= 22; z += 0.5) {
    const pxPerMetre = 2 ** z / metresPerPixelAtZ0;
    stops.push([z, ["min", labelMaxPx, ["*", ["coalesce", ["get", sizeProperty], 0], pxPerMetre]]]);
  }
  return stops;
}

/** @param {any} map */
function buildLayers(map) {
  const s = appConfig.map.plotStyle;
  const lineWidth = (/** @type {number} */ atZ13, /** @type {number} */ atZ17) =>
    ["interpolate", ["linear"], ["zoom"], 13, atZ13, 17, atZ17];

  map.addLayer({ id: PLOT_FILL_LAYER_ID, type: "fill", source: PLOT_SOURCE_ID, paint: {
    "fill-color": fillColorExpression(),
    "fill-opacity": ["case",
      state("selected"), s.fillOpacitySelected,
      state("dimmed"), s.fillOpacityDimmed,
      state("hover"), s.fillOpacityHover,
      s.fillOpacity],
  } });
  map.addLayer({ id: "plots-outline", type: "line", source: PLOT_SOURCE_ID, paint: {
    "line-color": ["case", state("dimmed"), s.outlineColorDimmed, s.outlineColor],
    "line-width": lineWidth(0.3, 1),
  } });
  map.addLayer({ id: "plots-highlight", type: "line", source: PLOT_SOURCE_ID, paint: {
    "line-color": s.highlightColor,
    "line-width": lineWidth(1.5, 3),
    "line-opacity": ["case", state("highlighted"), 1, 0],
  } });
  map.addLayer({ id: "plots-hover", type: "line", source: PLOT_SOURCE_ID, paint: {
    "line-color": s.hoverColor,
    "line-width": lineWidth(1.2, 2.2),
    "line-opacity": ["case", ["all", state("hover"), ["!", state("selected")]], 1, 0],
  } });
  map.addLayer({ id: "plots-selected-casing", type: "line", source: PLOT_SOURCE_ID, paint: {
    "line-color": s.selectedCasingColor,
    "line-width": lineWidth(4, 7),
    "line-opacity": ["case", state("selected"), 1, 0],
  } });
  map.addLayer({ id: "plots-selected", type: "line", source: PLOT_SOURCE_ID, paint: {
    "line-color": s.selectedColor,
    "line-width": lineWidth(2, 3.5),
    "line-opacity": ["case", state("selected"), 1, 0],
  } });

  // Plot codes when zoomed in: one pre-computed point per plot (so each code appears once).
  // Rotation and size depend on the label mode – see setLabelMode().
  // Needs a font service, which the plain fallback background does not have.
  if (map.getStyle()?.glyphs) {
    labelLatitude = map.getCenter().lat;
    map.addLayer({ id: LABEL_LAYER_ID, type: "symbol", source: LABEL_SOURCE_ID, minzoom: appConfig.map.labelMinZoom,
      layout: {
        "text-field": ["get", "plotCode"],
        "text-font": [appConfig.map.labelFont],
        "text-max-width": 30,
        "text-anchor": "center",
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "map",
        // Every label is sized to fit inside its own plot, so labels cannot overlap each other
        // and none need to be hidden.
        "text-allow-overlap": true,
        "text-padding": 0,
      },
      paint: {
        "text-color": "#1d272b",
        "text-halo-color": "rgba(255,255,255,0.9)",
        "text-halo-width": 1.2,
      } });
    setLabelMode(map, appConfig.map.defaultLabelMode);
  }
}

/**
 * How plot codes are written:
 *   "aligned"    – turned along the plot; turns with the map when it is rotated
 *   "horizontal" – level on screen, also when the map is rotated (size: labelSizeView)
 *   "off"        – no codes
 * @param {any} map
 * @param {string} mode
 */
export function setLabelMode(map, mode) {
  if (!map.getLayer(LABEL_LAYER_ID)) return;
  if (mode === "off") {
    map.setLayoutProperty(LABEL_LAYER_ID, "visibility", "none");
    return;
  }
  const horizontal = mode === "horizontal";
  const stops = labelSizeStops(labelLatitude, horizontal ? "labelSizeView" : "labelSize");
  const alignment = horizontal ? "viewport" : "map";
  map.setLayoutProperty(LABEL_LAYER_ID, "visibility", "visible");
  map.setLayoutProperty(LABEL_LAYER_ID, "text-rotate", horizontal ? 0 : ["get", "labelAngle"]);
  map.setLayoutProperty(LABEL_LAYER_ID, "text-rotation-alignment", alignment);
  map.setLayoutProperty(LABEL_LAYER_ID, "text-pitch-alignment", alignment);
  map.setLayoutProperty(LABEL_LAYER_ID, "text-size", ["interpolate", ["exponential", 2], ["zoom"], ...stops.flat()]);
  // Hidden while too small to read; faded for filtered-out plots.
  map.setPaintProperty(LABEL_LAYER_ID, "text-opacity", ["interpolate", ["linear"], ["zoom"], ...stops.flatMap(([z, size]) =>
    [z, ["case", [">=", size, appConfig.map.labelMinPx], ["case", state("dimmed"), 0.35, 1], 0]])]);
}

/**
 * Update the size of screen-level labels after the map was rotated.
 * @param {any} map
 * @param {GeoJSON.FeatureCollection} labels  label points (properties are updated in place)
 * @param {Map<string, number> | null} sizes  per plotId; null = map points north, use the built sizes
 */
export function setViewLabelSizes(map, labels, sizes) {
  for (const feature of labels.features) {
    const props = /** @type {any} */ (feature.properties);
    props.labelSizeView = sizes ? (sizes.get(props.plotId) ?? 0) : props.labelSizeHorizontal;
  }
  map.getSource(LABEL_SOURCE_ID)?.setData(labels);
}

/**
 * Add the plot layers, or replace their data if they already exist (e.g. after a precinct change).
 * @param {any} map
 * @param {GeoJSON.FeatureCollection} geometry  plot polygons
 * @param {GeoJSON.FeatureCollection} labels    one label point per plot
 */
export function setPlotData(map, geometry, labels) {
  const source = map.getSource(PLOT_SOURCE_ID);
  if (source) {
    for (const id of [PLOT_SOURCE_ID, LABEL_SOURCE_ID]) map.removeFeatureState({ source: id });
    source.setData(geometry);
    map.getSource(LABEL_SOURCE_ID)?.setData(labels);
    return;
  }
  map.addSource(PLOT_SOURCE_ID, { type: "geojson", data: geometry, promoteId: "plotId" });
  map.addSource(LABEL_SOURCE_ID, { type: "geojson", data: labels, promoteId: "plotId" });
  buildLayers(map);
}

/**
 * Which ids to switch on and off to go from one set to another.
 * @param {Iterable<string>} previous
 * @param {Iterable<string>} next
 */
export function diffIds(previous, next) {
  const prev = new Set(previous);
  const nxt = new Set(next);
  return {
    added: [...nxt].filter((id) => !prev.has(id)),
    removed: [...prev].filter((id) => !nxt.has(id)),
  };
}

/**
 * Keeps the map's plot states in step with the application. Only changed plots are updated,
 * so even thousands of dimmed plots stay fast.
 * @param {any} map
 */
export function createPlotStateController(map) {
  /** @type {Record<string, Set<string>>} */
  const current = { hover: new Set(), selected: new Set(), highlighted: new Set(), dimmed: new Set() };

  /** @param {keyof typeof current} key @param {Iterable<string>} ids */
  function setStateIds(key, ids) {
    const { added, removed } = diffIds(current[key], ids);
    // Labels follow the plot states too (e.g. faded labels for filtered-out plots).
    for (const source of [PLOT_SOURCE_ID, LABEL_SOURCE_ID]) {
      for (const id of removed) map.setFeatureState({ source, id }, { [key]: false });
      for (const id of added) map.setFeatureState({ source, id }, { [key]: true });
    }
    current[key] = new Set(ids);
  }

  return {
    /** @param {string|null} id */
    setHovered: (id) => setStateIds("hover", id ? [id] : []),
    /** @param {string|null} id */
    setSelected: (id) => setStateIds("selected", id ? [id] : []),
    /** @param {Iterable<string>} ids */
    setHighlighted: (ids) => setStateIds("highlighted", ids),
    /** @param {Iterable<string>} ids */
    setDimmed: (ids) => setStateIds("dimmed", ids),
    /** Forget all states (after the plot data was replaced). */
    reset() {
      for (const key of Object.keys(current)) current[/** @type {keyof typeof current} */ (key)] = new Set();
    },
  };
}
