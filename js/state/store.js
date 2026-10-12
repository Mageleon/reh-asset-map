// @ts-check
/**
 * Minimal application state container (no library needed).
 * Components read with get(), change with set({...}), and react with subscribe().
 */

/**
 * @template {object} T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = { ...initial };
  /** @type {Set<(state: T, previous: T) => void>} */
  const listeners = new Set();
  return {
    /** @returns {T} */
    get: () => state,
    /** @param {Partial<T>} patch */
    set(patch) {
      const previous = state;
      const next = { ...state, ...patch };
      const changed = Object.keys(patch).some((k) => /** @type {any} */ (previous)[k] !== /** @type {any} */ (next)[k]);
      if (!changed) return;
      state = next;
      for (const listener of listeners) listener(state, previous);
    },
    /** @param {(state: T, previous: T) => void} listener @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * @typedef {Object} AppState
 * @property {string|null} precinctCode
 * @property {string|null} selectedPlotId
 * @property {boolean} leftPanelOpen
 * @property {boolean} rightPanelOpen
 * @property {"aligned"|"horizontal"|"off"} labelMode  how plot codes are written on the map
 * @property {Record<string, string[]>} filters  active filters: filter id -> ticked values
 */
