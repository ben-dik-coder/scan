/** Oslo kommune (Brønnøysund) */
export const OSLO_MUNICIPALITY_CODE = "0301";

export const DEFAULT_MARKET_FILTERS = {
  regionId: "oslo",
  municipalityCode: OSLO_MUNICIPALITY_CODE,
  days: 30,
  /** Av som standard — ellers vises bare firma med e-post i listen */
  hasEmail: false,
  genericEmailOnly: false,
  industryGroup: "",
  professionSearch: "",
  websitePresence: "all" as const,
  facebookPresence: "all" as const,
  instagramPresence: "all" as const,
};

/** Brreg-markedspreset for demo/promo: firma som selger nettsider */
export const WEBBYRA_MARKET_PRESET = {
  industryGroup: "webbyra",
  /** Bransjefilter henter hele registeret — ikke begrenset til siste 30 dager */
  days: 0,
} as const;

/** Maks antall firma Google/SerpAPI kan sjekke per kjøring (API-grense) */
export const MAX_WEBSITE_SCAN_BATCH = 10;

/** Samme som batch — kun de første N med e-post skannes automatisk */
export const MAX_AUTO_WEBSITE_SCAN = MAX_WEBSITE_SCAN_BATCH;
