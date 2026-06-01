import { websiteFromEmail } from "./email-hint";
import type { WebsiteScanResult } from "./types";

/** Rask sjekk i nettleseren — kun når e-postdomenet matcher firmanavn */
export function quickScanFromEmail(
  company: {
    orgnr: string;
    name: string;
    email?: string | null;
  }
): WebsiteScanResult | null {
  const hint = websiteFromEmail(company.email, company.name);
  if (!hint) return null;

  return {
    orgnr: company.orgnr,
    hasWebsite: true,
    websiteKind: "own",
    websiteUrl: hint.websiteUrl,
    websiteDomain: hint.websiteDomain,
    bookingPlatform: null,
    source: "email_domain",
    confidence: "high",
    query: `E-post @${hint.websiteDomain}`,
    scannedAt: new Date().toISOString(),
    topHits: [
      {
        title: company.name,
        link: hint.websiteUrl,
        domain: hint.websiteDomain,
      },
    ],
  };
}
