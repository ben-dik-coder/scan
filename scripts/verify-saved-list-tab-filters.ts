/**
 * Regresjonstest for listefaner og matchesAgentListWithWebsiteTab.
 * Kjør: npx tsx scripts/verify-saved-list-tab-filters.ts
 */
import {
  listFilterToWebsitePresence,
  matchesAgentListWithPhoneTab,
  matchesAgentListWithWebsiteTab,
  websitePresenceToListFilter,
} from "../src/lib/agent/saved-list-filters.ts";
import type { WebsiteScanResult } from "../src/lib/website-scan/types.ts";

function assert(label: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`OK: ${label}`);
}

assert(
  "no_website → web=without",
  listFilterToWebsitePresence("no_website") === "without"
);
assert(
  "with_website → web=with",
  listFilterToWebsitePresence("with_website") === "with"
);
assert(
  "not_scanned → web=not_scanned",
  listFilterToWebsitePresence("not_scanned") === "not_scanned"
);
assert("all → web=all", listFilterToWebsitePresence("all") === "all");
assert(
  "with_phone → web=all",
  listFilterToWebsitePresence("with_phone") === "all"
);

assert(
  "web=with → with_website",
  websitePresenceToListFilter("with") === "with_website"
);
assert(
  "web=without → no_website",
  websitePresenceToListFilter("without") === "no_website"
);
assert(
  "mangler web → all",
  websitePresenceToListFilter(null) === "all"
);

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
  scannedAt: new Date().toISOString(),
};

assert(
  "mangler skann = ikke med nettside-fane",
  !matchesAgentListWithWebsiteTab(undefined)
);
assert(
  "own site = med nettside-fane",
  matchesAgentListWithWebsiteTab({
    ...base,
    hasWebsite: true,
    websiteKind: "own",
    websiteUrl: "https://example.no",
  })
);
assert(
  "booking_only = ikke med nettside-fane",
  !matchesAgentListWithWebsiteTab({
    ...base,
    hasWebsite: true,
    websiteKind: "booking_only",
    websiteUrl: "https://timma.no/salong/test",
    bookingPlatform: "timma",
  })
);
assert(
  "hasWebsite uten own kind = ikke med nettside-fane",
  !matchesAgentListWithWebsiteTab({
    ...base,
    hasWebsite: true,
    websiteKind: "none",
    websiteUrl: "https://example.no",
  })
);

assert(
  "gyldig mobil = med telefon-fane",
  matchesAgentListWithPhoneTab(
    { orgnr: "123456789", phone: null, mobile: "91234567", contact_override: null },
    undefined
  )
);
assert(
  "mangler telefon = ikke med telefon-fane",
  !matchesAgentListWithPhoneTab(
    { orgnr: "123456789", phone: null, mobile: null, contact_override: null },
    undefined
  )
);
assert(
  "skannet telefon = med telefon-fane",
  matchesAgentListWithPhoneTab(
    { orgnr: "123456789", phone: null, mobile: null, contact_override: null },
    { ...base, enrichedPhone: "91234567" }
  )
);

console.log("\nAlle tester bestått.");
