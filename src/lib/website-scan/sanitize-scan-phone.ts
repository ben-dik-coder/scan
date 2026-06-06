import { phonePlausibleForCompany } from "./phone-plausible";
import type { WebsiteScanResult } from "./types";

/** Fjern ugyldig enrichedPhone fra lagret skann (gammel cache). */
export function sanitizeScanPhone(scan: WebsiteScanResult): WebsiteScanResult {
  if (!scan.enrichedPhone) return scan;

  const orgnr = scan.orgnr?.trim() ?? "";
  if (phonePlausibleForCompany(scan.enrichedPhone, orgnr)) {
    return scan;
  }

  return {
    ...scan,
    enrichedPhone: null,
    enrichedPhoneSource: null,
  };
}
