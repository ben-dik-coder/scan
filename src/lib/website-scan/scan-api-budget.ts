/**
 * SerpAPI / Google CSE-budsjett per firmaskann.
 * Mål: 0–1 Google-søk per firma (gratis hint/gjetning først).
 */

/** Maks Google-søk for nettside — ett godt søk er nok når gjetning feiler */
export const MAX_WEBSITE_SEARCH_QUERIES = 1;

/** Serper /search for nettside — sekvensielt; stopp tidlig bare ved sikker match */
export const SERPER_WEBSITE_MAX_QUERIES = 3;

/** Serper /places — ett Maps-oppslag per firma i de fleste tilfeller */
export const SERPER_PLACES_MAX_QUERIES = 1;

/** Serper /search for telefon når Places mangler nummer */
export const SERPER_PHONE_MAX_QUERIES = 4;

/** Ekstra site:gulesider.no-søk koster 1 SerpAPI — bruk treff fra hovedsøk */
export const ENABLE_GULESIDER_SERP_SEARCH = false;

/** Google Maps via Serper /places — 1 API-kall per firma, før organisk Google */
export const ENABLE_SERPER_PLACES =
  process.env.SERPER_PLACES_ENABLED !== "false" &&
  process.env.SERPER_PLACES_ENABLED !== "0";

/** Google Maps via DuckDuckGo (gratis) — fallback når Serper mangler/feiler */
export const ENABLE_DDG_PLACES =
  process.env.DDG_PLACES_ENABLED !== "false" &&
  process.env.DDG_PLACES_ENABLED !== "0";

/** Ekstra site:-søk kun når hovedsøk ikke fant profil — prøv flere navnevarianter */
export const MAX_FALLBACK_SOCIAL_QUERIES = 3;

/** Typisk Serper-kall per firma (uten sosiale tillegg) — for UI og agent */
export const ESTIMATED_SERPER_CALLS_PER_SCAN = 2;

/** Treff per Google-søk — 10 er nok for nettside + sosiale lenker */
export const GOOGLE_SERP_NUM = 15;

/** Sosialt fallback-søk */
export const SOCIAL_SERP_NUM = 10;

/** HTML-henting for kontakt (ikke SerpAPI, men tregt) */
export const MAX_PLATFORM_FETCHES = 4;
