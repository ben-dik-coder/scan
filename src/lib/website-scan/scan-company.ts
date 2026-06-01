import { hasGoogleCse, hasSerpApi } from "./config";
import { websiteFromEmail } from "./email-hint";
import { searchGoogleCse } from "./google-cse";
import {
  buildSearchQuery,
  dedupeHits,
  normalizeDomain,
  pickBestWebsite,
  type SearchHit,
} from "./parse-results";
import { searchSerpApi } from "./serpapi";
import type {
  WebsiteScanCompanyInput,
  WebsiteScanResult,
  WebsiteScanSource,
} from "./types";

type PickResult = ReturnType<typeof pickBestWebsite>;

function fromPick(
  orgnr: string,
  pick: PickResult,
  source: WebsiteScanSource,
  query: string,
  topHits?: PickResult["topHits"]
): WebsiteScanResult {
  return {
    orgnr,
    hasWebsite: pick.hasWebsite,
    websiteKind: pick.websiteKind,
    websiteUrl: pick.websiteUrl,
    websiteDomain: pick.websiteDomain
      ? normalizeDomain(pick.websiteUrl ?? pick.websiteDomain)
      : null,
    bookingPlatform: pick.bookingPlatform,
    source,
    confidence: pick.confidence,
    query,
    scannedAt: new Date().toISOString(),
    topHits: topHits ?? pick.topHits,
  };
}

async function fetchHitsForQuery(query: string): Promise<SearchHit[]> {
  const batches: SearchHit[][] = [];

  if (hasSerpApi()) {
    try {
      batches.push(await searchSerpApi(query));
    } catch {
      /* prøv google under */
    }
  }

  if (hasGoogleCse()) {
    try {
      batches.push(await searchGoogleCse(query));
    } catch {
      /* ignorer */
    }
  }

  return dedupeHits(batches.flat());
}

function demoScan(company: WebsiteScanCompanyInput): WebsiteScanResult {
  const queryLabel = buildSearchQuery(company);
  const emailHint = websiteFromEmail(company.email, company.name);

  if (emailHint) {
    return fromPick(
      company.orgnr,
      {
        hasWebsite: true,
        websiteKind: "own",
        websiteUrl: emailHint.websiteUrl,
        websiteDomain: emailHint.websiteDomain,
        bookingPlatform: null,
        topHits: [
          {
            title: company.name,
            link: emailHint.websiteUrl,
            domain: emailHint.websiteDomain,
          },
        ],
        confidence: "high",
      },
      "demo",
      `E-post @${emailHint.websiteDomain}`
    );
  }

  return fromPick(
    company.orgnr,
    {
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      topHits: [],
      confidence: "low",
    },
    "demo",
    `${queryLabel} (demo — legg inn SerpAPI for ekte Google-sjekk)`
  );
}

export async function scanCompanyWebsite(
  company: WebsiteScanCompanyInput,
  options?: { demo?: boolean }
): Promise<WebsiteScanResult> {
  const queryLabel = buildSearchQuery(company);

  const emailHint = websiteFromEmail(company.email, company.name);
  if (emailHint) {
    return fromPick(
      company.orgnr,
      {
        hasWebsite: true,
        websiteKind: "own",
        websiteUrl: emailHint.websiteUrl,
        websiteDomain: emailHint.websiteDomain,
        bookingPlatform: null,
        topHits: [
          {
            title: company.name,
            link: emailHint.websiteUrl,
            domain: emailHint.websiteDomain,
          },
        ],
        confidence: "medium",
      },
      "email_domain",
      `E-post @${emailHint.websiteDomain}`
    );
  }

  if (options?.demo || (!hasGoogleCse() && !hasSerpApi())) {
    return demoScan(company);
  }

  const errors: string[] = [];
  let finalPick: PickResult | null = null;

  try {
    const hits = await fetchHitsForQuery(queryLabel);
    finalPick = pickBestWebsite(hits, company.name);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Søk feilet");
  }

  if (!finalPick) {
    return fromPick(
      company.orgnr,
      {
        hasWebsite: false,
        websiteKind: "none",
        websiteUrl: null,
        websiteDomain: null,
        bookingPlatform: null,
        topHits: [],
        confidence: "low",
      },
      "none",
      queryLabel
    );
  }

  const source: WebsiteScanSource = hasSerpApi()
    ? hasGoogleCse()
      ? "both"
      : "serpapi"
    : "google_cse";

  return fromPick(company.orgnr, finalPick, source, queryLabel, finalPick.topHits ?? []);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
