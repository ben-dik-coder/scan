import {
  isBookingPlatformDomain,
  normalizeDomain,
} from "@/lib/website-scan/parse-results";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

/** Timma, Fixit, Fresha osv. — ikke egen nettside. */
export function isBookingOnlyScan(scan: WebsiteScanResult): boolean {
  if (scan.websiteKind === "booking_only") return true;
  if (scan.bookingPlatform) return true;
  const domain =
    scan.websiteDomain ?? normalizeDomain(scan.websiteUrl ?? "");
  return Boolean(domain && isBookingPlatformDomain(domain));
}

/** Firma uten egen nettside (inkl. kun booking/katalog). */
export function isLeadWithoutOwnSite(
  scan: WebsiteScanResult | undefined
): boolean {
  if (!scan) return false;
  if (isBookingOnlyScan(scan)) return true;
  if (scan.websiteKind === "none" && !scan.hasWebsite) return true;
  return false;
}

export function hasOwnWebsite(scan: WebsiteScanResult | undefined): boolean {
  if (!scan || isBookingOnlyScan(scan)) return false;
  return scan.hasWebsite === true && scan.websiteKind === "own";
}
