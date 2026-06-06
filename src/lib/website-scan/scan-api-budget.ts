/**
 * SerpAPI / Google CSE-budsjett per firmaskann.
 * Mål: ~2 søk + 0–2 profil-API per firma (ikke 7–9).
 */

/** Maks Google-søk for nettside (sekventielt — stopper ved godt treff) */
export const MAX_WEBSITE_SEARCH_QUERIES = 2;

/** Ekstra site:-søk kun når hovedsøk ikke fant profil */
export const MAX_FALLBACK_SOCIAL_QUERIES = 1;

/** Treff per Google-søk — 10 er nok for nettside + sosiale lenker */
export const GOOGLE_SERP_NUM = 10;

/** Sosialt fallback-søk */
export const SOCIAL_SERP_NUM = 10;

/** HTML-henting for kontakt (ikke SerpAPI, men tregt) */
export const MAX_PLATFORM_FETCHES = 4;
