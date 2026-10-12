// @ts-check
/**
 * Size of level (screen-horizontal) plot codes when the map is rotated.
 *
 * The data build already provides `labelSizeHorizontal` for a north-up map. When the user rotates
 * the map, a label that stays level on screen crosses each plot at a different angle, so the size
 * that fits inside the plot changes. This module recalculates it for the current rotation, using
 * the same rules as scripts/rhdata/labels.py (text box must lie inside the plot, 85 % margin).
 */

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON_EQUATOR = 111320;
const CHAR_WIDTH_EM = 0.65;
const FILL = 0.85;

/**
 * @typedef {Object} PlotShape
 * @property {number[][][]} rings  largest polygon part, in metres around the label point
 * @property {number} chars        text length in character widths (CHAR_WIDTH_EM × characters)
 * @property {number} extent       largest dimension of the plot (m), upper bound for the search
 */

/** @param {number[][][]} polygon */
function ringArea(polygon) {
  const ring = polygon[0];
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

/**
 * Convert each plot to local metres around its label point, once per precinct.
 * @param {GeoJSON.FeatureCollection} geometry
 * @param {Map<string, import("../data/types.js").Plot>} plotsById
 * @returns {Map<string, PlotShape>}
 */
export function preparePlotShapes(geometry, plotsById) {
  /** @type {Map<string, PlotShape>} */
  const shapes = new Map();
  for (const feature of geometry.features) {
    const plot = plotsById.get(feature.properties?.plotId);
    const geom = /** @type {any} */ (feature.geometry);
    if (!plot || !plot.labelPoint || !geom) continue;
    const [lon0, lat0] = plot.labelPoint;
    const kx = M_PER_DEG_LON_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
    const toM = (/** @type {number[]} */ p) => [(p[0] - lon0) * kx, (p[1] - lat0) * M_PER_DEG_LAT];
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    const metric = polygons.map((/** @type {number[][][]} */ poly) => poly.map((ring) => ring.slice(0, -1).map(toM)));
    const rings = metric.reduce((best, poly) => (ringArea(poly) > ringArea(best) ? poly : best));
    const xs = rings[0].map((p) => p[0]);
    const ys = rings[0].map((p) => p[1]);
    shapes.set(plot.id, {
      rings,
      chars: CHAR_WIDTH_EM * plot.plotCode.length,
      extent: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
    });
  }
  return shapes;
}

/** @param {number[]} pt @param {number[][][]} rings */
function inside(pt, rings) {
  const inRing = (/** @type {number[][]} */ ring) => {
    let isIn = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) isIn = !isIn;
    }
    return isIn;
  };
  return inRing(rings[0]) && !rings.slice(1).some(inRing);
}

/** True if a box of half-size (hw, hh) centred on the label point lies inside the plot. */
function boxFits(/** @type {number[][][]} */ rings, /** @type {number} */ hw, /** @type {number} */ hh) {
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  if (!corners.every((c) => inside(c, rings))) return false;
  return !rings.some((ring) => ring.some(([x, y]) => Math.abs(x) < hw && Math.abs(y) < hh));
}

/**
 * Largest text height (metres) for a label that is level on screen while the map is rotated.
 * @param {PlotShape} shape
 * @param {number} bearingDeg  map bearing (degrees, as reported by MapLibre)
 */
export function levelTextSize(shape, bearingDeg) {
  // Screen-horizontal at bearing b is the map direction -b; turning the plot by +b lines it up
  // with an ordinary horizontal text box.
  const a = (bearingDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rings = shape.rings.map((ring) => ring.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]));
  let lo = 0;
  let hi = shape.extent;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (boxFits(rings, (mid * shape.chars) / 2, mid / 2)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * FILL * 100) / 100;
}

/**
 * Sizes for all plots at the given bearing.
 * @param {Map<string, PlotShape>} shapes
 * @param {number} bearingDeg
 * @returns {Map<string, number>}
 */
export function levelTextSizes(shapes, bearingDeg) {
  /** @type {Map<string, number>} */
  const sizes = new Map();
  for (const [id, shape] of shapes) sizes.set(id, levelTextSize(shape, bearingDeg));
  return sizes;
}
