import type { WebsiteScanResult } from "./types";
import {
  hasUncertainWebsiteHits,
  isHostedPlatformDomain,
  isBookingPlatformDomain,
} from "./parse-results";

/**
 * Hvor dårlig nettsiden er (0–100).
 * 0 = ingen nettside. Høyere = verre nettside / svakere tilstedeværelse.
 * null = ikke skannet ennå.
 */
export function computeWebsiteBadnessScore(
  scan: WebsiteScanResult | undefined,
  companyName?: string
): number | null {
  if (!scan) return null;

  if (scan.websiteKind === "booking_only") {
    let score = 88;
    if (scan.confidence === "medium") score = 82;
    if (scan.confidence === "low") score = 72;
    return score;
  }

  if (!scan.hasWebsite || scan.websiteKind === "none") {
    if (
      companyName &&
      scan.topHits?.length &&
      hasUncertainWebsiteHits(scan.topHits, companyName)
    ) {
      return 35;
    }
    return 0;
  }

  const domain = scan.websiteDomain ?? "";
  let score = 40;

  if (isBookingPlatformDomain(domain)) score = 85;
  else if (isHostedPlatformDomain(domain)) score = 78;
  else if (scan.confidence === "low") score = 72;
  else if (scan.confidence === "medium") score = 55;
  else if (scan.confidence === "high") score = 28;

  if (scan.source === "email_domain" || scan.source === "demo") {
    score = Math.max(score, 50);
  }

  if (
    (scan.source === "serpapi" ||
      scan.source === "serper" ||
      scan.source === "google_cse" ||
      scan.source === "both") &&
    scan.confidence === "high" &&
    !isHostedPlatformDomain(domain)
  ) {
    score = Math.min(score, 22);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function websiteBadnessLabel(score: number | null): string {
  if (score === null) return "Ikke skannet";
  if (score === 0) return "Ingen nettside";
  if (score >= 80) return "Svært dårlig / mangler egen side";
  if (score >= 60) return "Dårlig nettside";
  if (score >= 40) return "Middels";
  return "OK nettside";
}
