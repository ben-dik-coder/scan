import { NextRequest, NextResponse } from "next/server";
import {
  getWebsiteScanProviders,
  hasAnyWebsiteScanProvider,
} from "@/lib/website-scan/config";
import { scanCompanyWebsite, sleep } from "@/lib/website-scan/scan-company";
import type { WebsiteScanCompanyInput } from "@/lib/website-scan/types";
import { isDemoMode } from "@/lib/demo/config";
import { MAX_WEBSITE_SCAN_BATCH } from "@/lib/constants/market";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
/** Kun ved flere firma i samme POST (unngå rate limit) */
const DELAY_MS = 200;

export async function GET() {
  return NextResponse.json({
    configured: hasAnyWebsiteScanProvider(),
    providers: getWebsiteScanProviders(),
    demoFallback: isDemoMode() || !hasAnyWebsiteScanProvider(),
    maxPerSearch: MAX_WEBSITE_SCAN_BATCH,
  });
}

export async function POST(request: NextRequest) {
  let body: { companies?: WebsiteScanCompanyInput[] };
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
  const results = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i]!;
    const result = await scanCompanyWebsite(company, { demo: useDemo });
    results.push(result);
    if (companies.length > 1 && i < companies.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const withoutWebsite = results.filter((r) => !r.hasWebsite).length;
  const withWebsite = results.filter((r) => r.hasWebsite).length;

  return NextResponse.json({
    results,
    summary: {
      scanned: results.length,
      withWebsite,
      withoutWebsite,
      providers: useDemo ? ["demo"] : getWebsiteScanProviders(),
    },
  });
}
