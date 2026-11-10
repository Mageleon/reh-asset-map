// @ts-check
/**
 * Personal display preferences, remembered in this browser only (not shared with other users).
 * Storage can be unavailable (private windows, blocked site data) – then defaults are used.
 */

const LABEL_MODE_KEY = "reh-asset-map.labelMode";

/**
 * @param {string[]} validModes
 * @param {string} fallback
 * @returns {string}
 */
export function loadLabelMode(validModes, fallback) {
  try {
    const stored = window.localStorage.getItem(LABEL_MODE_KEY);
    return stored && validModes.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** @param {string} mode */
export function saveLabelMode(mode) {
  try {
    window.localStorage.setItem(LABEL_MODE_KEY, mode);
  } catch {
    // Not critical: the choice simply is not remembered.
  }
}
