// @ts-check
/** Inline SVG icons (static, trusted markup). 20×20, stroke uses currentColor. */

const PATHS = {
  search: '<circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/>',
  filter: '<path d="M3 4.5h14M5.5 10h9M8 15.5h4"/>',
  details: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M12 3v14"/>',
  close: '<path d="M5 5l10 10M15 5 5 15"/>',
  fit: '<path d="M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5"/>',
  chevron: '<path d="M7.5 5l5 5-5 5"/>',
  pointer: '<path d="M5 3l10 6.5-4.5 1 2.5 5-2 1-2.5-5L5 15z"/>',
  document: '<path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5z"/><path d="M11.5 2.5V6h3.5M8 10h5M8 13h5"/>',
  folder: '<path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z"/>',
  model: '<path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6z"/><path d="M3.5 6 10 9.5 16.5 6M10 9.5v8"/>',
  external: '<path d="M11 3.5h5.5V9M16.5 3.5 9 11M14 12v3.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8"/>',
  expand: '<path d="M3 7.5V3h4.5M3 3l5 5M17 12.5V17h-4.5M17 17l-5-5"/>',
  labels: '<path d="M3.5 4.5h9M8 4.5v11M11.5 10.5h5M14 10.5v5"/>',
  link: '<path d="M8.5 11.5l3-3M7 9.5 5.2 11.3a2.5 2.5 0 0 0 3.5 3.5l1.8-1.8M13 10.5l1.8-1.8a2.5 2.5 0 0 0-3.5-3.5L9.5 7"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {string} [className]
 * @returns {SVGSVGElement}
 */
export function icon(name, className = "icon") {
  const template = document.createElement("template");
  template.innerHTML = `<svg class="${className}" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
  return /** @type {SVGSVGElement} */ (template.content.firstElementChild);
}

/** Brand mark: four plots on a grid. */
export function brandMark() {
  const template = document.createElement("template");
  template.innerHTML = `<svg class="brand-mark" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="26" height="26" rx="6" fill="currentColor" opacity="0.14"/>
    <rect x="6" y="6" width="7" height="9" rx="1.2" fill="currentColor"/>
    <rect x="15" y="6" width="7" height="5" rx="1.2" fill="currentColor" opacity="0.75"/>
    <rect x="6" y="17" width="7" height="5" rx="1.2" fill="currentColor" opacity="0.75"/>
    <rect x="15" y="13" width="7" height="9" rx="1.2" fill="currentColor" opacity="0.5"/>
  </svg>`;
  return /** @type {SVGSVGElement} */ (template.content.firstElementChild);
}
