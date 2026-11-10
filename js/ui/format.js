// @ts-check
/** Display formatting. One place, so numbers and dates look the same everywhere. */

const numberFormat = new Intl.NumberFormat("en-GB");

/** @param {number|null|undefined} value */
export function formatCount(value) {
  return value === null || value === undefined ? "–" : numberFormat.format(value);
}

/** 1 -> '1 option', 8 -> '8 options' @param {number} count @param {string} noun */
export function plural(count, noun) {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** '2026-10-11T10:55:17+03:00' -> '11 Oct 2026, 10:55' @param {string|null|undefined} iso */
export function formatDateTime(iso) {
  if (!iso) return "–";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
