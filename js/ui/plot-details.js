// @ts-check
/**
 * Plot information panel content.
 *
 * The "describe…" functions turn a plot into plain display rows (easy to test); the "render…"
 * functions turn those rows into page elements. Missing values are always shown as
 * "Not available" – never guessed.
 */
import { appConfig } from "../config/app-config.js";
import { annexesForBlock, checkDocumentLink, openLabel, SPA_ANNEX_STATES } from "../data/documents.js";
import { h } from "./dom.js";
import { formatCount } from "./format.js";
import { icon } from "./icons.js";

/** @typedef {import("../data/types.js").Plot} Plot */
/** @typedef {import("../data/types.js").PlotDocument} PlotDocument */
/** @typedef {ReturnType<typeof describeDocumentItem>} DocumentItem */
/** @typedef {{ label: string, value: string|null, emptyText?: string }} Row */

export const NOT_AVAILABLE = "Not available";

// ------------------------------------------------------------------ describe (pure)

/** @param {Plot} plot @returns {Row[]} */
export function describeOverview(plot) {
  const single = plot.blocks.length === 1 ? plot.blocks[0] : null;
  const many = plot.blocks.length > 1 ? `${formatCount(plot.blocks.length)} blocks / units – see below` : null;
  const community = plot.marketingCommunity
    ? plot.marketingCommunity + (plot.marketingCommunityAbbreviation ? ` (${plot.marketingCommunityAbbreviation})` : "")
    : null;
  return [
    { label: "Plot Code", value: plot.plotCode },
    { label: "Precinct", value: [plot.precinctName, plot.precinctCode].filter(Boolean).join(" · ") || null },
    { label: "Sub-precinct", value: plot.subPrecinct },
    { label: "Design Package", value: plot.designPackage },
    { label: "Land Use – Level 1", value: plot.landUse },
    { label: "Land Use – Level 2", value: plot.landUseLevel2 ?? null },
    { label: "Land Use – Level 3", value: plot.landUseDetail },
    { label: "Engineering Name", value: plot.engineeringName },
    { label: "Marketing Community", value: community },
    { label: "LDC Super Plot", value: plot.ldcSuperPlot },
    { label: "LDC Sub Plot", value: many ?? single?.ldcSubPlot ?? null },
    { label: "Marketing Block", value: many ?? blockLabel(single) },
  ];
}

/**
 * Plots with a Blocks & units table (several blocks / units) show their SPA Annex links in that table,
 * one per unit, instead of under Documents (no duplicate list).
 * @param {Plot} plot
 */
export function annexesInUnitsTable(plot) {
  return plot.blocks.length > 1;
}

/**
 * One document link, checked before it may be opened.
 * @param {Plot} plot
 * @param {PlotDocument} d
 */
export function describeDocumentItem(plot, d) {
  return {
    doc: d,
    link: d.linkWithheld
      ? { ok: false, withheld: true, reason: "Opening documents is not available in this shared version of the map." }
      : checkDocumentLink(d.url, appConfig.documents.allowedHosts),
    kind: d.linkKind,
    kindLabel: d.linkKind === "folder" ? "SharePoint folder" : d.linkKind === "file" ? "PDF document"
      : d.linkKind === "model" ? "Federated model (ACC)" : "Link",
    appliesTo: d.appliesTo.length && !(d.appliesTo.length === 1 && d.appliesTo[0] === plot.plotCode)
      ? `Covers ${d.appliesTo.join(", ")}` : null,
    title: d.title,
  };
}

/** @param {import("../data/types.js").Block | null} block */
function blockLabel(block) {
  if (!block) return null;
  if (block.marketingBlockName) return block.marketingBlockName;
  return block.marketingBlockNumber ? `Block ${block.marketingBlockNumber}` : null;
}

/**
 * @param {number|null|undefined} value
 * @param {{ unit: string, decimals: number }} def
 */
export function formatMetric(value, def) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const text = new Intl.NumberFormat("en-GB", { maximumFractionDigits: def.decimals }).format(value);
  return def.unit ? `${text} ${def.unit}` : text;
}

/** @param {Plot} plot @returns {Row[]} */
export function describeMetrics(plot) {
  return appConfig.metricDefinitions.map((def) => ({
    label: def.label,
    value: formatMetric(/** @type {any} */ (plot.metrics)[def.key], def),
  }));
}

/**
 * Document sections: always-shown types (SPA Annex, DCR) plus any other type the plot has.
 * ACC models are shown in the ACC section; SPA Annexes of plots with several units in Blocks & units.
 * @param {Plot} plot
 * @param {PlotDocument[]} documents
 * @param {{ id: string, label: string }[]} documentTypes  from the manifest
 */
export function describeDocuments(plot, documents, documentTypes) {
  const elsewhere = [...appConfig.accDocumentTypes, ...(annexesInUnitsTable(plot) ? appConfig.unitTableDocumentTypes : [])];
  const shownTypes = documentTypes.filter((t) => !elsewhere.includes(t.id)
    && (appConfig.alwaysShownDocumentTypes.includes(t.id) || documents.some((d) => d.type === t.id)));
  return shownTypes.map((type) => {
    const docs = documents.filter((d) => d.type === type.id);
    const notRequired = type.id === "SPA_ANNEX" && plot.spaAnnex === SPA_ANNEX_STATES.notRequired;
    return {
      id: type.id,
      label: type.label,
      available: docs.length > 0,
      emptyText: notRequired ? SPA_ANNEX_STATES.notRequired : NOT_AVAILABLE,
      items: docs.map((d) => describeDocumentItem(plot, d)),
    };
  });
}

/** Notices shown at the top of the panel. @param {Plot} plot */
export function describeNotices(plot) {
  /** @type {string[]} */
  const notices = [];
  if (!plot.hasDatabaseRecord) {
    notices.push(plot.isNonSale
      ? "Open space / infrastructure plot – it has no record in the Master Asset Database."
      : "This plot has no record in the Master Asset Database yet.");
  }
  if (plot.isDesignPackagePending) {
    notices.push(`${plot.designPackage ?? "This design package"} is not final yet – some development data may be missing.`);
  }
  return notices;
}

// ------------------------------------------------------------------ render

/** @param {Row[]} rows */
function definitionList(rows) {
  return h("dl", { class: "detail-list" }, rows.map((row) => [
    h("dt", { class: "detail-list__label" }, row.label),
    h("dd", { class: row.value === null ? "detail-list__value detail-list__value--empty" : "detail-list__value" },
      row.value ?? row.emptyText ?? NOT_AVAILABLE),
  ]));
}

/**
 * One document with its open button (or the reason it cannot be opened).
 * @param {DocumentItem} item
 * @param {(doc: PlotDocument) => void} [onPreview]
 */
function documentItem(item, onPreview) {
  return h("li", { class: "doc-item" },
    h("span", { class: "doc-item__icon" }, icon(item.kind === "folder" ? "folder" : item.kind === "model" ? "model" : "document")),
    h("span", { class: "doc-item__text" },
      h("span", { class: "doc-item__title" }, item.kindLabel),
      item.appliesTo && h("span", { class: "doc-item__meta" }, item.appliesTo),
      item.link.ok
        ? h("span", { class: "doc-item__actions" },
          // A normal link: SharePoint checks the user's sign-in and permissions in the new tab.
          h("a", { class: "button button--small button--primary", href: item.doc.url, target: "_blank",
            rel: "noopener noreferrer" }, icon("external"), openLabel(item.kind)),
          appConfig.documents.inAppPreview && onPreview && item.kind === "file" &&
            h("button", { class: "button button--small", type: "button", onclick: () => onPreview(item.doc) },
              icon("document"), "Preview"))
        : /** @type {any} */ (item.link).withheld
          ? h("span", { class: "doc-item__meta" }, item.link.reason)
          : h("span", { class: "doc-item__error" }, `Link not valid – ${item.link.reason} Please report it to the data team.`)));
}

/**
 * "Open folder" / "Open PDF" button(s) for one block's SPA Annex in the Blocks & units table.
 * @param {Plot} plot
 * @param {PlotDocument[]} annexes
 */
function blockAnnexCell(plot, annexes) {
  if (!annexes.length) {
    return h("span", { class: "block-table__none" },
      plot.spaAnnex === SPA_ANNEX_STATES.notRequired ? SPA_ANNEX_STATES.notRequired : NOT_AVAILABLE);
  }
  return annexes.map((d) => {
    const item = describeDocumentItem(plot, d);
    if (!item.link.ok) {
      const withheld = /** @type {any} */ (item.link).withheld;
      return h("span", { class: withheld ? "doc-item__meta" : "doc-item__error", title: item.link.reason },
        withheld ? "Withheld" : "Link not valid");
    }
    // Same look as the Documents buttons; the full wording ("Open folder in SharePoint – Covers …") is the tooltip.
    return h("a", { class: "button button--small button--primary block-table__link", href: d.url, target: "_blank",
      rel: "noopener noreferrer", title: `${openLabel(item.kind)}${item.appliesTo ? ` – ${item.appliesTo}` : ""}` },
    icon("external"), item.kind === "folder" ? "Open folder" : item.kind === "file" ? "Open PDF" : "Open");
  });
}

/** @param {string} title @param {...any} children */
function section(title, ...children) {
  return h("section", { class: "panel-section" },
    h("div", { class: "panel-section__header" }, h("h3", { class: "panel-section__title" }, title)),
    ...children);
}

/** @param {Plot} plot @param {PlotDocument[]} documents */
function blocksSection(plot, documents) {
  if (plot.blocks.length < 2) return null;
  const preview = appConfig.blocksPreviewCount;
  const annexes = documents.filter((d) => d.type === "SPA_ANNEX");
  const rows = plot.blocks.map((b) => h("tr", {},
    h("td", {}, blockLabel(b) ?? NOT_AVAILABLE),
    h("td", {}, b.ldcSubPlot ?? "–"),
    h("td", {}, blockAnnexCell(plot, annexesForBlock(b.marketingBlockName, annexes)))));
  const tbody = h("tbody", {}, rows.slice(0, preview));
  const table = h("table", { class: "block-table" },
    h("thead", {}, h("tr", {}, h("th", {}, "Marketing Block"), h("th", {}, "LDC Sub Plot"), h("th", {}, "SPA Annex"))),
    tbody);
  const more = rows.length > preview
    ? h("button", { class: "text-button block-table__more", type: "button",
      onclick: (/** @type {Event} */ e) => {
        tbody.append(...rows.slice(preview));
        /** @type {HTMLElement} */ (e.currentTarget).remove();
      } }, `Show all ${formatCount(rows.length)}`)
    : null;
  const note = annexes.some((d) => !d.linkWithheld) && h("p", { class: "panel-note" },
    "SPA Annexes open in SharePoint in a new tab. You need a Modon Microsoft 365 account with access to the site.");
  return section(`Blocks & units (${formatCount(plot.blocks.length)})`, table, more, note);
}

/**
 * @param {ReturnType<typeof describeDocuments>} groups
 * @param {(doc: PlotDocument) => void} onPreview
 */
function documentsSection(groups, onPreview) {
  const anyAvailable = groups.some((g) => g.available);
  if (!groups.length) return null;
  return section("Documents",
    h("ul", { class: "doc-groups" }, groups.map((group) => h("li", { class: "doc-group" },
      h("div", { class: "doc-group__header" },
        h("span", { class: "doc-group__label" }, group.label),
        h("span", { class: group.available ? "badge badge--ok" : "badge badge--muted" },
          group.available ? `${group.items.length} available` : group.emptyText)),
      group.items.length > 0 && h("ul", { class: "doc-list" }, group.items.map((item) => documentItem(item, onPreview)))))),
    anyAvailable && !groups.some((g) => g.items.some((i) => /** @type {any} */ (i.link).withheld)) && h("p", { class: "panel-note" },
      "Documents open in SharePoint in a new tab. You need a Modon Microsoft 365 account with access to the site."));
}

/**
 * ACC section: design federated model link(s), plus placeholders for what is not connected yet.
 * @param {Plot} plot
 * @param {PlotDocument[]} documents
 */
function accSection(plot, documents) {
  const modelDocs = documents.filter((d) => d.type === "DESIGN_MODEL");
  const items = modelDocs.map((doc) => {
    const link = doc.linkWithheld
      ? { ok: false, withheld: true, reason: "Opening is not available in this shared version of the map." }
      : checkDocumentLink(doc.url, appConfig.documents.allowedHosts);
    const covers = doc.appliesTo.length && !(doc.appliesTo.length === 1 && doc.appliesTo[0] === plot.plotCode)
      ? `Covers ${doc.appliesTo.join(", ")}` : null;
    return h("li", { class: "doc-item" },
      h("span", { class: "doc-item__icon" }, icon("model")),
      h("span", { class: "doc-item__text" },
        h("span", { class: "doc-item__title" }, "Federated model (ACC)"),
        covers && h("span", { class: "doc-item__meta" }, covers),
        link.ok
          ? h("span", { class: "doc-item__actions" },
            h("a", { class: "button button--small button--primary", href: doc.url, target: "_blank",
              rel: "noopener noreferrer" }, icon("external"), openLabel("model")))
          : h("span", { class: /** @type {any} */ (link).withheld ? "doc-item__meta" : "doc-item__error" },
            /** @type {any} */ (link).withheld ? link.reason : `Link not valid – ${link.reason}`)));
  });
  return section("ACC",
    h("ul", { class: "doc-groups" }, h("li", { class: "doc-group" },
      h("div", { class: "doc-group__header" },
        h("span", { class: "doc-group__label" }, "Design Federated Model"),
        h("span", { class: items.length ? "badge badge--ok" : "badge badge--muted" },
          items.length ? `${items.length} available` : NOT_AVAILABLE)),
      items.length > 0 && h("ul", { class: "doc-list" }, items))),
    definitionList([
      { label: "Project Environment", value: null, emptyText: "Not yet connected" },
      { label: "Milestone Submissions", value: null, emptyText: "Not yet connected" },
    ]),
    h("p", { class: "panel-note" }, items.length
      ? "Models open in Autodesk Construction Cloud in a new tab. You need an Autodesk account with access to the project."
      : "Links to Autodesk Construction Cloud (project environment and milestone submissions) are planned for a later version."));
}

/**
 * Full panel body for a selected plot.
 * @param {Plot} plot
 * @param {PlotDocument[]} documents
 * @param {{ id: string, label: string }[]} documentTypes
 * @param {{ onZoom: () => void, onClear: () => void, onCopyLink: () => Promise<boolean>, getLink: () => string,
 *           onPreview: (doc: PlotDocument) => void }} actions
 */
export function renderPlotDetails(plot, documents, documentTypes, actions) {
  const kind = [plot.landUseDetail, plot.landUse].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const copyLabel = h("span", {}, "Copy link");
  // Shown only if the browser refuses to copy: the link, selected, for copying with Ctrl+C.
  const manualLink = /** @type {HTMLInputElement} */ (h("input", { class: "manual-link", type: "text", readonly: true,
    "aria-label": "Link to this plot", hidden: true }));
  const copyButton = h("button", { class: "button", type: "button", title: "Copy a link that opens the map on this plot",
    onclick: async () => {
      const copied = await actions.onCopyLink();
      copyLabel.textContent = copied ? "Link copied" : "Press Ctrl+C to copy";
      if (!copied) {
        manualLink.value = actions.getLink();
        manualLink.hidden = false;
        manualLink.focus();
        manualLink.select();
      }
      setTimeout(() => { copyLabel.textContent = "Copy link"; }, 2500);
    } }, icon("link"), copyLabel);

  return [
    h("div", { class: "plot-heading" },
      h("p", { class: "plot-heading__eyebrow" }, [plot.precinctName, plot.subPrecinct].filter(Boolean).join(" · ")),
      h("h3", { class: "plot-heading__code" }, plot.plotCode),
      h("p", { class: "plot-heading__kind" }, kind || "Land use not available"),
      h("div", { class: "plot-heading__actions" },
        h("button", { class: "button button--primary", type: "button", onclick: actions.onZoom }, icon("fit"), "Zoom to plot"),
        copyButton,
        h("button", { class: "button", type: "button", onclick: actions.onClear }, "Clear")),
      manualLink),
    describeNotices(plot).map((text) => h("p", { class: "notice" }, text)),
    section("Overview", definitionList(describeOverview(plot))),
    blocksSection(plot, documents),
    section("Development data", definitionList(describeMetrics(plot))),
    documentsSection(describeDocuments(plot, documents, documentTypes), actions.onPreview),
    accSection(plot, documents),
  ];
}
