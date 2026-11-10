// @ts-check
/**
 * In-app document viewer (only used when appConfig.documents.inAppPreview is switched on).
 *
 * It simply shows the SharePoint page inside the map. SharePoint keeps checking the user's sign-in
 * and permissions; nothing is downloaded or bypassed. Page navigation, zoom, fit and download are
 * provided by SharePoint's own PDF viewer inside the frame. "Open in SharePoint" is always offered,
 * because the browser may refuse to show SharePoint inside another site.
 */
import { h, replaceChildren } from "./dom.js";
import { icon } from "./icons.js";

export function createDocumentViewer() {
  const frameHolder = h("div", { class: "viewer__body" });
  const title = h("h2", { class: "viewer__title" });
  const openLink = /** @type {HTMLAnchorElement} */ (h("a", { class: "button button--small", target: "_blank", rel: "noopener noreferrer" },
    icon("external"), "Open in SharePoint"));
  const dialog = h("div", { class: "viewer", role: "dialog", "aria-modal": "true", "aria-labelledby": "viewer-title", hidden: true },
    h("div", { class: "viewer__window" },
      h("div", { class: "viewer__header" },
        title,
        h("div", { class: "viewer__actions" },
          openLink,
          h("button", { class: "button button--small", type: "button", title: "Full screen",
            onclick: () => dialog.querySelector(".viewer__window")?.requestFullscreen?.() }, icon("expand"), "Full screen"),
          h("button", { class: "icon-button", type: "button", "aria-label": "Close document", onclick: () => close() }, icon("close")))),
      h("p", { class: "viewer__hint" },
        "Shown from SharePoint. If it stays blank or shows a sign-in or refusal message, use “Open in SharePoint”."),
      frameHolder));
  title.id = "viewer-title";
  document.body.append(dialog);

  function close() {
    dialog.hidden = true;
    replaceChildren(frameHolder); // unload the document
    if (document.fullscreenElement) document.exitFullscreen?.();
  }
  // Escape closes only the viewer (caught first, so it does not also clear the selected plot).
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dialog.hidden) {
      e.stopPropagation();
      close();
    }
  }, true);

  return {
    /** @param {import("../data/types.js").PlotDocument} doc */
    open(doc) {
      title.textContent = doc.title;
      openLink.href = doc.url;
      replaceChildren(frameHolder, h("iframe", { class: "viewer__frame", src: doc.url, title: doc.title,
        referrerpolicy: "no-referrer" }));
      dialog.hidden = false;
    },
    close,
  };
}
