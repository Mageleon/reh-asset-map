// @ts-check
/**
 * Type definitions for the processed data. Mirrors docs/data-model.md – keep both in sync.
 * (JSDoc types: editors such as VS Code check them; they become TypeScript types when we move to Next.js.)
 */

/**
 * @typedef {Object} PlotMetrics
 * @property {number|null} plotArea
 * @property {number|null} gfa
 * @property {number|null} units
 * @property {number|null} population
 * @property {number|null} parking
 * @property {number|null} basements
 * @property {number|null} floors
 * @property {number|null} buildingHeight
 */

/**
 * @typedef {Object} Block
 * @property {string|null} marketingBlockNumber
 * @property {string|null} marketingBlockName
 * @property {string|null} ldcSubPlot
 * @property {string|null} annexStatus
 * @property {string|null} annexSchedule
 * @property {string|null} comments
 * @property {number} sourceRow
 */

/**
 * @typedef {Object} Plot
 * @property {string} id
 * @property {string} plotCode
 * @property {string} precinctCode
 * @property {string} precinctName
 * @property {string|null} subPrecinct
 * @property {string|null} designPackage
 * @property {string|null} landUse
 * @property {string|null} landUseLevel2   GIS land use level 2 (e.g. "Single Family")
 * @property {string|null} landUseDetail   GIS land use level 3 (e.g. "Villas")
 * @property {string|null} engineeringName
 * @property {string|null} marketingCommunity
 * @property {string|null} marketingCommunityAbbreviation
 * @property {string|null} ldcSuperPlot
 * @property {Block[]} blocks
 * @property {boolean} hasDatabaseRecord
 * @property {boolean} isNonSale
 * @property {boolean} isDesignPackagePending
 * @property {PlotMetrics} metrics
 * @property {[number, number, number, number]} bbox
 * @property {[number, number]} labelPoint  where the plot code is written (inside the plot)
 * @property {number} labelAngle  text rotation in degrees (clockwise), along the plot's long side
 * @property {number} labelSize   largest text height (metres) at which the plot code fits inside the plot
 * @property {number} labelSizeHorizontal  the same for level (unrotated) text
 * @property {string} [spaAnnex]  "Available" / "Not available" / … – worked out by the app when loading (filter)
 */

/**
 * @typedef {Object} PlotDocument
 * @property {string} id
 * @property {string} plotId
 * @property {string} plotCode
 * @property {string} type
 * @property {string} title
 * @property {string|null} url
 * @property {"file"|"folder"|"model"|"other"} linkKind
 * @property {string[]} appliesTo
 * @property {string|null} status
 * @property {string} source
 * @property {boolean} [linkWithheld]  true in a shared (public) build where SharePoint addresses were removed
 */

/**
 * @typedef {Object} PrecinctEntry
 * @property {string} code
 * @property {string} name
 * @property {[number, number, number, number]} bbox
 * @property {{geometry: string, plots: string, documents: string}} files
 * @property {{plots: number, plotsWithDatabaseRecord: number, documents: number}} counts
 */

/**
 * @typedef {Object} Manifest
 * @property {number} schemaVersion
 * @property {string} generatedAt
 * @property {{id: string, label: string}[]} documentTypes
 * @property {string[]} metrics
 * @property {PrecinctEntry[]} precincts
 */

/**
 * In-memory data for one precinct after joining the three files.
 * @typedef {Object} PrecinctData
 * @property {PrecinctEntry} precinct
 * @property {Map<string, Plot>} plotsById
 * @property {Map<string, PlotDocument[]>} documentsByPlotId
 * @property {GeoJSON.FeatureCollection} geometry  features carry plotId + a few styling properties
 * @property {GeoJSON.FeatureCollection} labels    one point per plot (plotId, plotCode) for the plot-code labels
 * @property {string[]} problems  data inconsistencies found while joining (not shown to normal users)
 */

export {};
