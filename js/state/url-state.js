// @ts-check
/**
 * Keeps the selected plot in the page address (e.g. ?plot=MD01-WE-V001) so a link opens
 * the map on that plot.
 */

const PLOT_PARAM = "plot";

/** @param {string} search  e.g. location.search */
export function readPlotParam(search) {
  const value = new URLSearchParams(search).get(PLOT_PARAM);
  return value && value.trim() ? value.trim() : null;
}

/**
 * Precinct code at the start of a plot id ('MD01-WE-V001' -> 'MD01'), if it is a known precinct.
 * @param {string} plotId
 * @param {string[]} precinctCodes
 */
export function precinctOfPlotId(plotId, precinctCodes) {
  const code = plotId.split("-", 1)[0];
  return precinctCodes.includes(code) ? code : null;
}

/**
 * New search string with the plot set or removed; other parameters are kept.
 * @param {string} search
 * @param {string|null} plotId
 */
export function withPlotParam(search, plotId) {
  const params = new URLSearchParams(search);
  if (plotId) params.set(PLOT_PARAM, plotId);
  else params.delete(PLOT_PARAM);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** @param {string|null} plotId */
export function writePlotToUrl(plotId) {
  const search = withPlotParam(window.location.search, plotId);
  if (search !== window.location.search) {
    window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
  }
}
