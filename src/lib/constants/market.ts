/** Oslo kommune (Brønnøysund) */
export const OSLO_MUNICIPALITY_CODE = "0301";

export const DEFAULT_MARKET_FILTERS = {
  regionId: "oslo",
  municipalityCode: OSLO_MUNICIPALITY_CODE,
  days: 30,
  hasEmail: true,
  genericEmailOnly: true,
  industryGroup: "",
} as const;

/** Maks antall firma Google/SerpAPI kan sjekke per kjøring (API-grense) */
export const MAX_WEBSITE_SCAN_BATCH = 10;

/** Samme som batch — kun de første N med e-post skannes automatisk */
export const MAX_AUTO_WEBSITE_SCAN = MAX_WEBSITE_SCAN_BATCH;
