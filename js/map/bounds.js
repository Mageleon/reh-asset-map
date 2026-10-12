// @ts-check
/** Bounding-box helpers. */

/**
 * Smallest box containing all given boxes ([minLon, minLat, maxLon, maxLat]); null if none.
 * @param {(number[] | null | undefined)[]} boxes
 * @returns {[number, number, number, number] | null}
 */
export function merge(boxes) {
  const valid = boxes.filter((b) => Array.isArray(b) && b.length === 4);
  if (!valid.length) return null;
  return [
    Math.min(...valid.map((b) => /** @type {number[]} */ (b)[0])),
    Math.min(...valid.map((b) => /** @type {number[]} */ (b)[1])),
    Math.max(...valid.map((b) => /** @type {number[]} */ (b)[2])),
    Math.max(...valid.map((b) => /** @type {number[]} */ (b)[3])),
  ];
}
