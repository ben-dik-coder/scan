import type { WebsiteScanResult } from "./types";
import {
  isSocialScanComplete,
  type ScanSocialOptions,
} from "./scan-social-options";

/** Øk når kontakt-berikelse forbedres — gamle cache-rader berikes på nytt uten SerpAPI */
export const CONTACT_ENRICHMENT_VERSION = 2;

/**
 * Google/SerpAPI-skann lagres globalt per orgnr i `company_website_scans`.
 * Alle innloggede brukere leser samme rad — ny skann kjøres bare når data mangler
 * eller bruker trykker «Sjekk på nytt».
 */
export function isWebsiteScanCacheComplete(
  scan: WebsiteScanResult,
  social: ScanSocialOptions
): boolean {
  if (!isSocialScanComplete(scan, social)) return false;
  return (
    scan.contactsEnriched === true &&
    (scan.contactEnrichmentVersion ?? 1) >= CONTACT_ENRICHMENT_VERSION
  );
}

export function needsContactEnrichment(scan: WebsiteScanResult): boolean {
  return (
    scan.contactsEnriched !== true ||
    (scan.contactEnrichmentVersion ?? 1) < CONTACT_ENRICHMENT_VERSION
  );
}
