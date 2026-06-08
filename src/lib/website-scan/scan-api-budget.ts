/**
 * SerpAPI / Google CSE-budsjett per firmaskann.
 * Mål: 0–1 Google-søk per firma (gratis hint/gjetning først).
 */

/** Maks Google-søk for nettside — ett godt søk er nok når gjetning feiler */
export const MAX_WEBSITE_SEARCH_QUERIES = 1;

/** Ekstra site:gulesider.no-søk koster 1 SerpAPI — bruk treff fra hovedsøk */
export const ENABLE_GULESIDER_SERP_SEARCH = false;

/** Ekstra site:-søk kun når hovedsøk ikke fant profil */
export const MAX_FALLBACK_SOCIAL_QUERIES = 1;

/** Treff per Google-søk — 10 er nok for nettside + sosiale lenker */
export const GOOGLE_SERP_NUM = 15;

/** Sosialt fallback-søk */
export const SOCIAL_SERP_NUM = 10;

/** HTML-henting for kontakt (ikke SerpAPI, men tregt) */
export const MAX_PLATFORM_FETCHES = 4;
