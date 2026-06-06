import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getWebsiteScanProviders,
  hasAnyWebsiteScanProvider,
} from "@/lib/website-scan/config";
import {
  enrichScanContacts,
  scanCompanyWebsite,
  sleep,
} from "@/lib/website-scan/scan-company";
import { isWebsiteScanCacheComplete } from "@/lib/website-scan/scan-cache";
import { sanitizeScanPhone } from "@/lib/website-scan/sanitize-scan-phone";
import {
  loadCachedWebsiteScans,
  persistCachedWebsiteScans,
} from "@/lib/website-scan/saved-scans-server";
import {
  DEFAULT_SCAN_SOCIAL_OPTIONS,
  isSocialScanComplete,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import type { WebsiteScanCompanyInput, WebsiteScanResult } from "@/lib/website-scan/types";
import { isDemoMode } from "@/lib/demo/config";
import { MAX_WEBSITE_SCAN_BATCH } from "@/lib/constants/market";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
/** Kun ved flere firma i samme POST (unngå rate limit) */
const DELAY_MS = 200;

export async function GET() {
  const { hasSerpApi } = await import("@/lib/website-scan/config");
  return NextResponse.json({
    configured: hasAnyWebsiteScanProvider(),
    providers: getWebsiteScanProviders(),
    serpApi: hasSerpApi(),
    facebookProfileApi: hasSerpApi(),
    instagramProfileApi: hasSerpApi(),
    demoFallback: isDemoMode() || !hasAnyWebsiteScanProvider(),
    maxPerSearch: MAX_WEBSITE_SCAN_BATCH,
  });
}

export async function POST(request: NextRequest) {
  let body: {
    companies?: WebsiteScanCompanyInput[];
    social?: Partial<ScanSocialOptions>;
    /** Tving SerpAPI selv om lagret skann finnes (kun «Sjekk på nytt») */
    forceRescan?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const companies = body.companies ?? [];
  if (companies.length === 0) {
    return NextResponse.json({ error: "Ingen firma valgt" }, { status: 400 });
  }
  if (companies.length > MAX_WEBSITE_SCAN_BATCH) {
    return NextResponse.json(
      { error: `Maks ${MAX_WEBSITE_SCAN_BATCH} firma per søk` },
      { status: 400 }
    );
  }

  const useDemo = isDemoMode() && !hasAnyWebsiteScanProvider();
  const forceRescan = body.forceRescan === true;
  const social: ScanSocialOptions = {
    ...DEFAULT_SCAN_SOCIAL_OPTIONS,
    ...body.social,
  };
  const results: WebsiteScanResult[] = [];

  const cachedByOrgnr = new Map(
    forceRescan
      ? []
      : (await loadCachedWebsiteScans(companies.map((c) => c.orgnr))).map(
          (scan) => [scan.orgnr, scan] as const
        )
  );

  const user = await getSessionUser();
  const freshResults: WebsiteScanResult[] = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i]!;
    const cached = cachedByOrgnr.get(company.orgnr);
    if (cached && isWebsiteScanCacheComplete(cached, social)) {
      results.push(cached);
      continue;
    }

    if (cached && isSocialScanComplete(cached, social)) {
      const enriched = await enrichScanContacts(company, cached);
      results.push(enriched);
      freshResults.push(enriched);
      continue;
    }

    const result = await scanCompanyWebsite(company, { demo: useDemo, social });
    results.push(result);
    freshResults.push(result);
    if (companies.length > 1 && i < companies.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  if (user && freshResults.length > 0) {
    void persistCachedWebsiteScans(freshResults, user.id);
  }

  const withoutWebsite = results.filter((r) => !r.hasWebsite).length;
  const withWebsite = results.filter((r) => r.hasWebsite).length;

  return NextResponse.json({
    results: results.map(sanitizeScanPhone),
    summary: {
      scanned: results.length,
      withWebsite,
      withoutWebsite,
      providers: useDemo ? ["demo"] : getWebsiteScanProviders(),
    },
  });
}
