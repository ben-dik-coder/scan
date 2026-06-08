/**
 * Regresjonstest for agent «uten nettside»-logikk.
 * Kjør: npx tsx scripts/verify-agent-website-presence.ts
 */
import { isLeadWithoutOwnSite } from "../src/lib/agent/website-presence.ts";
import type { WebsiteScanResult } from "../src/lib/website-scan/types.ts";

function assert(label: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`OK: ${label}`);
}

const base: WebsiteScanResult = {
  orgnr: "123456789",
  hasWebsite: false,
  websiteKind: "none",
  websiteUrl: null,
  websiteDomain: null,
  bookingPlatform: null,
  source: "none",
  confidence: "high",
  query: "test",
  status: "done",
  scannedAt: new Date().toISOString(),
};

assert("none = uten nettside", isLeadWithoutOwnSite(base));

assert(
  "booking_only medium = uten nettside",
  isLeadWithoutOwnSite({
    ...base,
    websiteKind: "booking_only",
    confidence: "medium",
  })
);

assert(
  "booking_only low = uten nettside",
  isLeadWithoutOwnSite({
    ...base,
    websiteKind: "booking_only",
    confidence: "low",
  })
);

assert(
  "timma.no domene = uten nettside",
  isLeadWithoutOwnSite({
    ...base,
    hasWebsite: true,
    websiteKind: "own",
    websiteUrl: "https://timma.no/salong/test",
    websiteDomain: "timma.no",
  })
);

assert(
  "own site = ikke uten nettside",
  !isLeadWithoutOwnSite({
    ...base,
    hasWebsite: true,
    websiteKind: "own",
    websiteUrl: "https://example.no",
  })
);

assert("mangler skann = ikke uten nettside", !isLeadWithoutOwnSite(undefined));

console.log("\nAlle tester bestått.");
