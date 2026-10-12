// @ts-check
/**
 * Multi-field plot search (no page elements here, so it is easy to test).
 *
 * Matching ignores upper/lower case, spaces, dashes and other punctuation, so "we01a", "WE 01A"
 * and "WE-01A" are the same. Several words must all match (e.g. "wadi east 21").
 * Ranking: exact match > starts with > contains, multiplied by the field's weight (config).
 */

/** @typedef {import("./types.js").Plot} Plot */
/** @typedef {{ id: string, label: string, path: string, weight: number }} SearchField */
/**
 * @typedef {Object} SearchResult
 * @property {string} plotId
 * @property {string} plotCode
 * @property {number} score
 * @property {string} matchLabel   field that matched best (e.g. "Marketing Block")
 * @property {string} matchValue   the value that matched (e.g. "BO-13")
 * @property {boolean} exact       the whole query equals that value
 */

/** "WE-01A" -> "we01a" @param {string} text */
export function normalize(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** Split a query into normalized words ("Wadi East 21" -> ["wadi", "east", "21"]). @param {string} query */
export function queryTokens(query) {
  return query.split(/[\s,;/]+/).map(normalize).filter(Boolean);
}

/** @param {Plot} plot @param {string} path @returns {string[]} */
function valuesAt(plot, path) {
  if (path.startsWith("blocks.")) {
    const key = path.slice("blocks.".length);
    return plot.blocks.map((b) => /** @type {any} */ (b)[key]).filter((v) => typeof v === "string" && v);
  }
  const value = /** @type {any} */ (plot)[path];
  return typeof value === "string" && value ? [value] : [];
}

/**
 * Pre-computes the searchable values of every plot (once per precinct).
 * @param {Iterable<Plot>} plots
 * @param {readonly SearchField[]} fields
 */
export function buildSearchIndex(plots, fields) {
  const entries = [];
  for (const plot of plots) {
    const values = [];
    for (const field of fields) {
      for (const raw of new Set(valuesAt(plot, field.path))) {
        const norm = normalize(raw);
        if (norm) values.push({ field, raw, norm });
      }
    }
    if (values.length) entries.push({ plot, values });
  }
  return entries;
}

/**
 * How well one normalized token matches one normalized value (0 = no match).
 * Single characters only match the start of a value, to avoid noise.
 * @param {string} token @param {string} value @param {number} weight
 */
function matchScore(token, value, weight) {
  if (value === token) return weight;
  if (value.startsWith(token)) return weight * 0.7;
  if (token.length >= 2 && value.includes(token)) return weight * 0.4;
  return 0;
}

/**
 * @param {ReturnType<typeof buildSearchIndex>} index
 * @param {string} query
 * @returns {SearchResult[]} best first
 */
export function searchPlots(index, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const whole = normalize(query);
  /** @type {SearchResult[]} */
  const results = [];
  for (const { plot, values } of index) {
    let total = 0;
    /** @type {{ raw: string, label: string, score: number } | null} */
    let best = null;
    let allTokensMatch = true;
    for (const token of tokens) {
      let tokenBest = 0;
      for (const v of values) {
        const s = matchScore(token, v.norm, v.field.weight);
        if (s > tokenBest) tokenBest = s;
        if (s > 0 && (!best || s > best.score)) best = { raw: v.raw, label: v.field.label, score: s };
      }
      if (tokenBest === 0) {
        allTokensMatch = false;
        break;
      }
      total += tokenBest;
    }
    if (!allTokensMatch || !best) continue;
    // A value equal to the whole query (e.g. "Wadi East") outranks word-by-word matches.
    const exactValue = values.find((v) => v.norm === whole);
    if (exactValue) {
      best = { raw: exactValue.raw, label: exactValue.field.label, score: exactValue.field.weight };
      total = Math.max(total, exactValue.field.weight * tokens.length);
    }
    results.push({
      plotId: plot.id,
      plotCode: plot.plotCode,
      score: total,
      matchLabel: best.label,
      matchValue: best.raw,
      exact: Boolean(exactValue),
    });
  }
  return results.sort((a, b) => b.score - a.score
    || a.plotCode.localeCompare(b.plotCode, "en", { numeric: true, sensitivity: "base" }));
}
