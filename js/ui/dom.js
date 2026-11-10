// @ts-check
/**
 * Small helper to build DOM elements. Text is always inserted as text (never as HTML),
 * so data values cannot inject markup.
 */

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]  class, dataset, style, on<Event> handlers, other attributes
 * @param {...any} children              strings, numbers, Nodes, arrays, null/false (ignored)
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

/** @param {Element} parent @param {any[]} children */
function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace all children of an element. @param {Element} el @param {...any} children */
export function replaceChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}
