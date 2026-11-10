// @ts-check
/** Map button that zooms back to the whole development (current precinct). */
import { appConfig } from "../config/app-config.js";
import { icon } from "../ui/icons.js";

export class FitControl {
  /** @param {() => [number, number, number, number] | null} getBounds */
  constructor(getBounds) {
    this.getBounds = getBounds;
    /** @type {any} */
    this.map = null;
    this.container = document.createElement("div");
  }

  /** @param {any} map */
  onAdd(map) {
    this.map = map;
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fit-control";
    button.title = "Zoom to whole development";
    button.setAttribute("aria-label", "Zoom to whole development");
    button.append(icon("fit"));
    button.addEventListener("click", () => this.fit());
    this.container.append(button);
    return this.container;
  }

  fit() {
    const bounds = this.getBounds();
    if (this.map && bounds) this.map.fitBounds(bounds, { padding: appConfig.map.fitPadding, duration: 600 });
  }

  onRemove() {
    this.container.remove();
    this.map = null;
  }
}
