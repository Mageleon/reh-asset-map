// @ts-check
/**
 * Central settings for the web application.
 * Data-side settings (source files, field names) live in config/data-config.json; this file only
 * covers how the app loads and displays the processed data.
 */

export const appConfig = Object.freeze({
  appName: "Ras El Hekma",
  appSubtitle: "Master Asset Map",

  /** Where the processed data is served from (see scripts/serve.py). */
  dataBaseUrl: "data/",
  /** Processed-data contract version this app understands (docs/data-model.md). */
  supportedSchemaVersion: 1,

  map: {
    basemaps: [
      {
        id: "light",
        label: "Light",
        // Free OpenStreetMap-based vector basemap, no account or key needed.
        styleUrl: "https://tiles.openfreemap.org/styles/positron",
      },
    ],
    defaultBasemapId: "light",
    /** Used when the basemap cannot be reached (e.g. blocked network): plots still show on a plain background. */
    fallbackBackgroundColor: "#eef0ee",
    basemapTimeoutMs: 8000,
    fitPadding: 40,
    maxZoom: 20,
    /** Closest zoom used when zooming to a single plot (keeps some surroundings visible). */
    plotZoomMax: 18,
    /** Plot codes are written on the map from this zoom level. */
    labelMinZoom: 16.5,
    /** Plot-code text is sized to fit its plot (labelSize, metres), within these screen sizes (px). */
    labelMinPx: 7,
    labelMaxPx: 14,
    /** Ways of writing plot codes on the map (user choice in the left panel). */
    labelModes: Object.freeze([
      { id: "aligned", label: "Aligned to plot" },
      { id: "horizontal", label: "Horizontal" },
      { id: "off", label: "Off" },
    ]),
    defaultLabelMode: "aligned",
    /** Font for plot labels; must exist in the basemap's font service. */
    labelFont: "Noto Sans Regular",

    /** How plots look in each state. Colours of the fill come from landUseColors. */
    plotStyle: {
      fillOpacity: 0.62,
      fillOpacityHover: 0.8,
      fillOpacitySelected: 0.88,
      fillOpacityDimmed: 0.12,      // plots outside the active filters
      outlineColor: "#3d4a4f",
      outlineColorDimmed: "#b9c0c2",
      hoverColor: "#16323a",
      selectedColor: "#0b1f26",
      selectedCasingColor: "#ffffff",
      highlightColor: "#1f6feb",    // search results
    },
  },

  /** Screen width (px) from which side panels sit beside the map; below it they slide over the map. */
  wideLayoutMinWidth: 1280,

  /**
   * Filters, in display order. `field` is a Plot property (docs/data-model.md).
   */
  filterDefinitions: Object.freeze([
    { id: "precinct", label: "Precinct", field: "precinctName" },
    { id: "designPackage", label: "Design Package", field: "designPackage" },
    { id: "landUse", label: "Land Use – Level 1", field: "landUse" },
    { id: "landUseLevel2", label: "Land Use – Level 2", field: "landUseLevel2" },
    { id: "landUseLevel3", label: "Land Use – Level 3", field: "landUseDetail" },
    { id: "engineeringName", label: "Engineering Name", field: "engineeringName" },
    { id: "marketingCommunity", label: "Marketing Community", field: "marketingCommunity" },
    { id: "spaAnnex", label: "SPA Annex", field: "spaAnnex" },
  ]),

  /**
   * Development data shown in the plot panel, in display order. Keys match Plot.metrics
   * (docs/data-model.md). `decimals` = most decimals shown; values are never rounded in the data.
   */
  metricDefinitions: Object.freeze([
    { key: "plotArea", label: "Plot Area", unit: "m²", decimals: 0 },
    { key: "gfa", label: "GFA", unit: "m²", decimals: 0 },
    { key: "units", label: "Units", unit: "", decimals: 0 },
    { key: "population", label: "Population", unit: "", decimals: 1 },
    { key: "parking", label: "Parking", unit: "spaces", decimals: 2 },
    { key: "basements", label: "Basements", unit: "", decimals: 0 },
    { key: "floors", label: "Floors", unit: "", decimals: 0 },
    { key: "buildingHeight", label: "Building Height", unit: "m", decimals: 1 },
  ]),

  /**
   * Fields the global search looks in. `path` is a Plot property, or "blocks.<property>" for values
   * of each block/unit. `weight` ranks matches (exact match = weight; starts with = 70 %; contains = 40 %).
   */
  searchFields: Object.freeze([
    { id: "plotCode", label: "Plot Code", path: "plotCode", weight: 100 },
    { id: "marketingBlockName", label: "Marketing Block", path: "blocks.marketingBlockName", weight: 95 },
    { id: "ldcSubPlot", label: "LDC Sub Plot", path: "blocks.ldcSubPlot", weight: 90 },
    { id: "engineeringName", label: "Engineering Name", path: "engineeringName", weight: 70 },
    { id: "marketingCommunity", label: "Marketing Community", path: "marketingCommunity", weight: 70 },
    { id: "marketingCommunityAbbreviation", label: "Community Abbreviation", path: "marketingCommunityAbbreviation", weight: 65 },
    { id: "ldcSuperPlot", label: "LDC Super Plot", path: "ldcSuperPlot", weight: 60 },
    { id: "marketingBlockNumber", label: "Marketing Block Number", path: "blocks.marketingBlockNumber", weight: 50 },
    { id: "landUseLevel2", label: "Land Use – Level 2", path: "landUseLevel2", weight: 35 },
    { id: "landUseDetail", label: "Land Use – Level 3", path: "landUseDetail", weight: 40 },
  ]),
  /** Results listed under the search box (all matches are still highlighted on the map). */
  searchMaxListed: 50,

  /**
   * Opening documents. Links are only opened when they are https addresses on these hosts.
   * `inAppPreview`: show PDFs inside the map. SharePoint normally refuses to be shown inside other
   * websites (and requires Microsoft sign-in), so this stays off until a test with a Modon account
   * (web/tools/sharepoint-preview-test.html) shows it works. Never bypass SharePoint security.
   */
  documents: Object.freeze({
    allowedHosts: Object.freeze(["modongroup.sharepoint.com", "acc.autodesk.com"]),
    inAppPreview: false,
  }),

  /** Document types shown in the ACC section of the plot panel instead of under Documents. */
  accDocumentTypes: Object.freeze(["DESIGN_MODEL"]),

  /** Document types always listed in the plot panel (shown as "Not available" when missing). */
  alwaysShownDocumentTypes: Object.freeze(["SPA_ANNEX", "DCR"]),

  /** Document types shown per unit in the Blocks & units table (plots with several units) instead of under Documents. */
  unitTableDocumentTypes: Object.freeze(["SPA_ANNEX"]),
  /** Database annex status values meaning the plot needs no SPA Annex (filter value "Not required"). */
  spaAnnexNotRequiredStatuses: Object.freeze(["Not Required"]),

  /** Blocks/units listed before "Show all" for plots with many units (e.g. plot 4000). */
  blocksPreviewCount: 8,

  /** Fill colours per GIS land use (level 1). Unknown values use `default`. */
  landUseColors: Object.freeze({
    Residential: "#e8b04b",
    "Mixed Use": "#c97b3d",
    Commercial: "#d0574f",
    Hospitality: "#a5527a",
    Community: "#8a6fbf",
    Government: "#5a6b8c",
    "Open Spaces": "#7fb069",
    Infrastructure: "#9a9a9a",
    default: "#b7b7b7",
  }),

  /**
   * Colours by detailed land use (GIS level 3), taking priority over landUseColors.
   * Each entry is also a separate line in the map legend.
   */
  landUseDetailColors: Object.freeze([
    { id: "water", label: "Water (ocean, lake / pond)", color: "#5b9bd5", details: ["Ocean", "Lake / Pond"] },
    // Pale sand: much lighter and less orange than Residential (#e8b04b), so the two stay distinct.
    { id: "beach", label: "Beach", color: "#f0e2b6", details: ["Beach"] },
  ]),

  /**
   * Filter value used for plots that have no value in a filtered field (e.g. open spaces have no
   * Engineering Name), so such plots can be found too.
   */
  filterNotSetLabel: "(Not set)",
});
