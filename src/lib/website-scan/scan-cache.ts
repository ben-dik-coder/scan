import type { WebsiteScanResult } from "./types";
import {
  isSocialScanComplete,
  type ScanSocialOptions,
} from "./scan-social-options";

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
  return scan.contactsEnriched === true;
}

export function needsContactEnrichment(scan: WebsiteScanResult): boolean {
  return scan.contactsEnriched !== true;
}
