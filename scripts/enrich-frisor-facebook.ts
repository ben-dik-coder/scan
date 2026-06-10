/**
 * Finn Facebook-sider for frisører (eller annen bransje) i en kommune.
 * Prøver DDG site:facebook.com, Gulesider/1881, deretter full skann.
 *
 * Kjør: npx tsx scripts/enrich-frisor-facebook.ts --kommune 1804
 * 25 parallelle: npx tsx scripts/run-bodo-frisor-facebook-25.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import {
  WebsiteScanBuffer,
  loadWebsiteScansByOrgnr,
} from "./lib/enrich-batch-db.ts";
import { loadEnrichEnv } from "./lib/enrich-env.ts";
import { companyGeoPlaces, primaryGeoPlace } from "../src/lib/brreg/geo-place.ts";
import { getIndustryCodeOrFilters, industryGroupLabel } from "../src/lib/constants/industries.ts";
import { discoverFacebookFromDirectoriesFree } from "../src/lib/website-scan/discover-social-free.ts";
import { searchDuckDuckGo } from "../src/lib/website-scan/duckduckgo-search.ts";
import {
  buildFacebookSearchQueries,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles.ts";
import { scanCompanyWebsite } from "../src/lib/website-scan/scan-company.ts";
import type { WebsiteScanResult } from "../src/lib/website-scan/types.ts";
import type { Company } from "../src/types/database.ts";
import type { SearchHit } from "../src/lib/website-scan/parse-results.ts";

const DEFAULT_KOMMUNE = "1804";
const DEFAULT_INDUSTRY = "frisor";
const MAX_DDG_QUERIES = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  let kommune = DEFAULT_KOMMUNE;
  let industry = DEFAULT_INDUSTRY;
  let shard: number | null = null;
  let shards = 25;
  let delayMs = 400;
  let limit = 0;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kommune" && args[i + 1]) kommune = args[++i];
    else if (args[i] === "--industry" && args[i + 1]) industry = args[++i];
    else if (args[i] === "--shard" && args[i + 1]) shard = Number(args[++i]);
    else if (args[i] === "--shards" && args[i + 1]) shards = Number(args[++i]);
    else if (args[i] === "--delay" && args[i + 1]) delayMs = Number(args[++i]);
    else if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
  }
  return { kommune, industry, shard, shards, delayMs, limit, dryRun };
}

function slugForKommune(kommune: string): string {
  if (kommune === "1806") return "narvik";
  if (kommune === "1804") return "bodo";
  if (kommune === "5503") return "harstad";
  if (kommune === "5501") return "tromso";
  return `kommune-${kommune}`;
}

function progressPath(slug: string, industry: string, shard: number | null): string {
  const name =
    shard === null
      ? `${slug}-${industry}-facebook-progress.json`
      : `${slug}-${industry}-facebook-progress-shard-${shard}.json`;
  return resolve(process.cwd(), "scripts/.cache", name);
}

function sliceShard<T>(items: T[], shard: number, shards: number): T[] {
  const n = items.length;
  const start = Math.ceil((shard * n) / shards);
  const end = Math.ceil(((shard + 1) * n) / shards);
  return items.slice(start, end);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Progress = {
  done: string[];
  results: Record<
    string,
    { name: string; facebookUrl?: string; source?: string; error?: string }
  >;
};

function loadProgress(path: string): Progress {
  if (!existsSync(path)) return { done: [], results: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Progress;
  } catch {
    return { done: [], results: {} };
  }
}

function saveProgress(path: string, progress: Progress) {
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  writeFileSync(path, JSON.stringify(progress, null, 2));
}

async function loadFacebookMap(orgnrs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (orgnrs.length === 0) return map;
  const supabase = createServiceClient();
  for (let i = 0; i < orgnrs.length; i += 80) {
    const batch = orgnrs.slice(i, i + 80);
    const { data } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan")
      .in("orgnr", batch);
    for (const row of data ?? []) {
      const scan = row.scan as { facebookUrl?: string | null };
      if (scan.facebookUrl?.trim()) {
        map.set(row.orgnr as string, scan.facebookUrl.trim());
      }
    }
  }
  return map;
}

async function loadCompanies(kommune: string, industry: string): Promise<Company[]> {
  const supabase = createServiceClient();
  const codeFilters = getIndustryCodeOrFilters(industry) ?? [];
  if (!codeFilters.length) throw new Error(`Ukjent bransje: ${industry}`);
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("municipality_code", kommune)
    .or(codeFilters.join(","))
    .order("orgnr");
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

function toScanInput(company: Company) {
  return {
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    municipality_name: company.municipality_name,
    city: company.city,
    website: company.website,
    industry_code: company.industry_code,
  };
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.link)) continue;
    seen.add(hit.link);
    out.push(hit);
  }
  return out;
}

async function findFacebookUrl(company: Company): Promise<{
  url: string | null;
  source: string;
}> {
  const input = toScanInput(company);
  const geoPlaces = companyGeoPlaces(input);
  const geoLabel = primaryGeoPlace(input) ?? geoPlaces[0] ?? "Bodø";
  const queries = buildFacebookSearchQueries(input);
  const fbHits: SearchHit[] = [];

  for (const q of queries.slice(0, MAX_DDG_QUERIES)) {
    const hits = await searchDuckDuckGo(q).catch(() => []);
    for (const hit of hits) {
      if (/facebook\.com/i.test(hit.link)) fbHits.push(hit);
    }
    const pick = pickFacebookFromHits(fbHits, company.name, geoLabel, { geoPlaces });
    if (pick.url) return { url: pick.url, source: `ddg:${q.slice(0, 40)}` };
    await sleep(250);
  }

  const dirHits = await discoverFacebookFromDirectoriesFree(input);
  fbHits.push(...dirHits);
  const dirPick = pickFacebookFromHits(
    dedupeHits(fbHits),
    company.name,
    geoLabel,
    { geoPlaces }
  );
  if (dirPick.url) return { url: dirPick.url, source: "gulesider/1881" };

  const scan = await scanCompanyWebsite(input, {
    social: { includeFacebook: true, includeInstagram: false },
  });
  if (scan.facebookUrl?.trim()) {
    return { url: scan.facebookUrl.trim(), source: "full-scan" };
  }

  return { url: null, source: "ingen" };
}

function buildFacebookScan(
  company: Company,
  facebookUrl: string | null,
  existing: WebsiteScanResult | null
): WebsiteScanResult {
  const now = new Date().toISOString();
  const base: WebsiteScanResult =
    existing ??
    ({
      orgnr: company.orgnr,
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      source: "google_cse",
      confidence: "low",
      query: "",
      scannedAt: now,
      facebookUrl: null,
    } as WebsiteScanResult);

  return {
    ...base,
    facebookUrl,
    scannedAt: now,
  };
}

function queueFacebookScan(
  buffer: WebsiteScanBuffer,
  company: Company,
  facebookUrl: string | null,
  existing: WebsiteScanResult | null
) {
  const now = new Date().toISOString();
  const scan = buildFacebookScan(company, facebookUrl, existing);
  return buffer.queue({
    orgnr: company.orgnr,
    scan,
    scanned_at: now,
    scanned_by: "facebook-enrich",
  });
}

async function main() {
  loadEnrichEnv();
  const { kommune, industry, shard, shards, delayMs, limit, dryRun } = parseArgs();
  const slug = slugForKommune(kommune);
  const progressFile = progressPath(slug, industry, shard);
  const industryLabel = industryGroupLabel(industry);

  const all = await loadCompanies(kommune, industry);
  const orgnrs = all.map((c) => c.orgnr);
  const fbMap = await loadFacebookMap(orgnrs);
  const scanMap = await loadWebsiteScansByOrgnr(orgnrs);
  let missing = all
    .filter((c) => !fbMap.has(c.orgnr))
    .sort((a, b) => a.orgnr.localeCompare(b.orgnr));

  const totalMissing = missing.length;
  if (shard !== null) {
    if (shard < 0 || shard >= shards) {
      throw new Error(`Ugyldig shard ${shard}`);
    }
    missing = sliceShard(missing, shard, shards);
  }

  let targets = missing;
  if (limit > 0) targets = targets.slice(0, limit);

  console.log(`${slug} (${kommune}) ${industryLabel}: ${all.length} firma`);
  console.log(`Uten Facebook: ${totalMissing}`);
  if (shard !== null) {
    console.log(`Shard ${shard}/${shards - 1}: ${targets.length} firma`);
  }
  console.log(`Metode: DDG site:facebook.com → Gulesider → full skann\n`);

  const progress = loadProgress(progressFile);
  const scanBuffer = new WebsiteScanBuffer();
  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (const company of targets) {
    if (progress.done.includes(company.orgnr)) {
      console.log(`↷ ${company.name}`);
      continue;
    }

    try {
      const { url, source } = await findFacebookUrl(company);
      if (url && !dryRun) {
        const existing = scanMap.get(company.orgnr) ?? null;
        await queueFacebookScan(scanBuffer, company, url, existing);
        const scan = buildFacebookScan(company, url, existing);
        scanMap.set(company.orgnr, scan);
        found++;
        progress.results[company.orgnr] = { name: company.name, facebookUrl: url, source };
        console.log(`✓ ${company.name}`);
        console.log(`  Facebook ${url} (${source})`);
      } else if (!url) {
        if (!dryRun) {
          const existing = scanMap.get(company.orgnr) ?? null;
          await queueFacebookScan(scanBuffer, company, null, existing);
          scanMap.set(company.orgnr, buildFacebookScan(company, null, existing));
        }
        notFound++;
        progress.results[company.orgnr] = { name: company.name, source: "ingen funn" };
        console.log(`· ${company.name} — ingen Facebook funnet`);
      } else {
        console.log(`(dry-run) ${company.name} → ${url ?? "ingen"}`);
      }

      progress.done.push(company.orgnr);
      saveProgress(progressFile, progress);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      progress.done.push(company.orgnr);
      saveProgress(progressFile, progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }

    await sleep(delayMs);
  }

  if (!dryRun) {
    await scanBuffer.flush();
  }

  const afterMap = await loadFacebookMap(all.map((c) => c.orgnr));
  console.log("\n--- Oppsummering ---");
  console.log(`Nye Facebook: ${found}`);
  console.log(`Uten funn: ${notFound}`);
  console.log(`Feil: ${errors}`);
  console.log(`Facebook totalt nå: ${afterMap.size} / ${all.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
