// @ts-check
/**
 * Document link checks (no page elements here, so it is easy to test).
 *
 * The map never downloads or proxies documents: it only opens the original SharePoint address in a
 * new tab, where SharePoint checks the user's Microsoft sign-in and permissions as usual.
 */

/**
 * @typedef {Object} LinkCheck
 * @property {boolean} ok
 * @property {string} [reason]  plain-language reason when not ok
 */

/**
 * Is this a link the map may open? https only, and only on the configured SharePoint host(s).
 * @param {string|null|undefined} url
 * @param {readonly string[]} allowedHosts
 * @returns {LinkCheck}
 */
export function checkDocumentLink(url, allowedHosts) {
  if (!url || typeof url !== "string" || !url.trim()) return { ok: false, reason: "No link recorded." };
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, reason: "The recorded link is not a valid web address." };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "The recorded link is not a secure (https) address." };
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.some((h) => h.toLowerCase() === host)) {
    return { ok: false, reason: `The link points to ${host}, which is not an approved document site (Modon SharePoint or Autodesk ACC).` };
  }
  return { ok: true };
}

/**
 * Wording for the open button of a document.
 * @param {"file"|"folder"|"model"|"other"} linkKind
 */
export function openLabel(linkKind) {
  if (linkKind === "model") return "Open model in ACC";
  if (linkKind === "folder") return "Open folder in SharePoint";
  if (linkKind === "file") return "Open PDF in SharePoint";
  return "Open in SharePoint";
}

/** Values of the "SPA Annex" filter. */
export const SPA_ANNEX_STATES = Object.freeze({
  available: "Available",
  missing: "Not available",
  notRequired: "Not required",
});

/**
 * Does this plot have an SPA Annex link? Used by the "SPA Annex" filter and the overview.
 * "Not required": plots without a Master Asset Database record (open space / infrastructure) and plots
 * whose blocks are all marked as not requiring an annex in the database (`notRequiredStatuses`).
 * @param {import("./types.js").Plot} plot
 * @param {readonly import("./types.js").PlotDocument[]} documents  the plot's documents
 * @param {readonly string[]} [notRequiredStatuses]  database annex status values meaning "not required"
 */
export function spaAnnexState(plot, documents, notRequiredStatuses = ["Not Required"]) {
  if (documents.some((d) => d.type === "SPA_ANNEX" && d.url)) return SPA_ANNEX_STATES.available;
  if (!plot.hasDatabaseRecord) return SPA_ANNEX_STATES.notRequired;
  const wanted = notRequiredStatuses.map((s) => s.trim().toLowerCase());
  const blocks = plot.blocks ?? [];
  const allNotRequired = blocks.length > 0
    && blocks.every((b) => wanted.includes(String(b.annexStatus ?? "").trim().toLowerCase()));
  return allNotRequired ? SPA_ANNEX_STATES.notRequired : SPA_ANNEX_STATES.missing;
}

/**
 * The annex documents covering one block / unit (a document with no "appliesTo" covers the whole plot).
 * @param {string|null} blockName
 * @param {readonly import("./types.js").PlotDocument[]} annexes
 */
export function annexesForBlock(blockName, annexes) {
  return annexes.filter((d) => !d.appliesTo.length || (blockName !== null && d.appliesTo.includes(blockName)));
}
