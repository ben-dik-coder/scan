/**
 * Evaluer Serper mot ground truth fra non-Serper pipeline.
 * 1) Finn nettside/tlf/FB uten Serper (DDG, 1881, Gulesider, Brreg, scraping)
 * 2) Kjør Serper på samme bedrifter og sammenlign
 *
 * Kjør: npx tsx scripts/eval-serper-30.ts
 *       npx tsx scripts/eval-serper-30.ts --limit 30 --seed eval-jun-2026-v3
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { companyGeoPlaces } from "../src/lib/brreg/geo-place.ts";
import {
  buildFacebookSearchQueries,
  normalizeFacebookUrl,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles.ts";
import {
  companySearchNameVariants,
  compactAlnum,
  dedupeHits,
  normalizeDomain,
  pickBestWebsite,
  type SearchHit,
} from "../src/lib/website-scan/parse-results.ts";
import {
  isPlausibleNorwegianPhone,
  phoneCoreDigits,
  phonePlausibleForCompany,
} from "../src/lib/website-scan/phone-plausible.ts";
import { scanCompanyWebsite } from "../src/lib/website-scan/scan-company.ts";
import {
  MAX_FALLBACK_SOCIAL_QUERIES,
  SOCIAL_SERP_NUM,
} from "../src/lib/website-scan/scan-api-budget.ts";
import {
  discoverPhoneFromSerper,
  searchSerper,
  searchSerperForWebsite,
} from "../src/lib/website-scan/serper.ts";
import type { Company } from "../src/types/database.ts";
import type {
  WebsiteScanCompanyInput,
  WebsiteScanResult,
} from "../src/lib/website-scan/types.ts";

const BASELINE = {
  websiteMatchPct: 30,
  phoneMatchPct: 10,
  facebookMatchPct: 63.6,
  note: "Lagret sannhet fra DB/scan-cache (serper-eval-30.json før v3)",
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v[0] === '"' && v.at(-1) === '"') ||
      (v[0] === "'" && v.at(-1) === "'")
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function forceNonSerperDiscovery() {
  process.env.SERPER_DISABLED = "true";
  process.env.SERPAPI_DISABLED = "true";
  process.env.SERPAPI_ENABLED = "false";
  process.env.SERPER_PLACES_ENABLED = "false";
  process.env.DDG_PLACES_ENABLED = "true";
}

function forceSerperEval() {
  delete process.env.SERPER_DISABLED;
  process.env.SERPAPI_DISABLED = "true";
  process.env.SERPAPI_ENABLED = "false";
  process.env.DDG_PLACES_ENABLED = "false";
  process.env.SERPER_PLACES_ENABLED = "true";
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 30;
  let seed = "eval-jun-2026-v3";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--seed" && args[i + 1]) seed = args[++i];
  }
  return { limit, seed };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(seedFromString(seed));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function domainOf(url: string): string {
  return normalizeDomain(url.startsWith("http") ? url : `https://${url}`);
}

function domainBaseCompact(url: string | null | undefined): string {
  if (!url) return "";
  const domain = domainOf(url);
  const base = domain.split(".")[0] ?? "";
  return compactAlnum(base);
}

function domainsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const da = a ? domainOf(a) : "";
  const db = b ? domainOf(b) : "";
  if (!da || !db) return false;
  if (da === db) return true;
  return domainBaseCompact(a) === domainBaseCompact(b);
}

function normPhone(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return phoneCoreDigits(value);
}

function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const pa = normPhone(a);
  const pb = normPhone(b);
  if (!pa || !pb) return false;
  return pa === pb;
}

function facebookIdFromUrl(url: string): string | null {
  const m = url.match(/(?:facebook\.com\/)(?:people\/[^/]+\/)?(\d{10,})/i);
  return m?.[1] ?? null;
}

function facebookMatches(
  got: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!got || !expected) return false;
  const normGot = (normalizeFacebookUrl(got) ?? got).toLowerCase();
  const normExp = (normalizeFacebookUrl(expected) ?? expected).toLowerCase();
  if (normGot === normExp) return true;

  const idGot = facebookIdFromUrl(normGot);
  const idExp = facebookIdFromUrl(normExp);
  if (idGot && idExp && idGot === idExp) return true;

  const slug = expected
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
    .split("/")[0]!
    .toLowerCase();
  if (slug && slug !== "people" && normGot.includes(slug)) return true;
  return false;
}

function discoveryInput(c: Company): WebsiteScanCompanyInput {
  return {
    orgnr: c.orgnr,
    name: c.name,
    email: c.email ?? null,
    municipality_name: c.municipality_name,
    city: c.city,
    website: null,
    industry_code: c.industry_code,
  };
}

function alternateNames(name: string): string[] {
  const alts: string[] = [];
  for (const v of companySearchNameVariants(name)) {
    if (v !== name.trim() && !alts.includes(v)) alts.push(v);
  }
  return alts;
}

async function discoverGroundTruth(
  company: WebsiteScanCompanyInput
): Promise<{
  website: string | null;
  phone: string | null;
  facebook: string | null;
}> {
  forceNonSerperDiscovery();
  const scan = await scanCompanyWebsite(company, {
    social: {
      includeFacebook: true,
      includeInstagram: false,
      includeLinkedIn: false,
    },
  });
  return {
    website: scan.websiteUrl?.trim() || null,
    phone: scan.enrichedPhone?.trim() || null,
    facebook: scan.facebookUrl?.trim() || null,
  };
}

async function discoverWebsiteSerper(company: WebsiteScanCompanyInput) {
  const { hits, queries } = await searchSerperForWebsite(company);
  const pick = pickBestWebsite(hits, company.name, {
    municipalityName: company.municipality_name ?? company.city,
  });
  return {
    websiteUrl: pick.websiteUrl,
    websiteDomain: pick.websiteDomain,
    confidence: pick.confidence,
    queries,
  };
}

async function discoverFacebookSerper(
  company: WebsiteScanCompanyInput,
  websiteDomain?: string | null
) {
  const queries = buildFacebookSearchQueries(company, { websiteDomain });
  const alternate = alternateNames(company.name);
  const geoPlaces = companyGeoPlaces(company);
  const geoLabel = company.municipality_name ?? company.city ?? "";
  const allHits: SearchHit[] = [];
  let queriesRun = 0;

  for (const q of queries.slice(0, MAX_FALLBACK_SOCIAL_QUERIES)) {
    queriesRun++;
    const batch = await searchSerper(q, { num: SOCIAL_SERP_NUM }).catch(
      () => [] as SearchHit[]
    );
    allHits.push(...batch);
    const merged = dedupeHits(allHits);
    const pick = pickFacebookFromHits(merged, company.name, geoLabel, {
      geoPlaces,
      alternateNames: alternate,
    });
    if (pick.url) break;
    await sleep(200);
  }

  const merged = dedupeHits(allHits);
  let pick = pickFacebookFromHits(merged, company.name, geoLabel, {
    geoPlaces,
    alternateNames: alternate,
  });
  if (!pick.url) {
    for (const alt of alternate) {
      const altPick = pickFacebookFromHits(merged, alt, geoLabel, { geoPlaces });
      if (altPick.url) {
        pick = altPick;
        break;
      }
    }
  }

  return {
    facebookUrl: pick.url,
    confidence: pick.confidence,
    queriesRun,
    queries: queries.slice(0, MAX_FALLBACK_SOCIAL_QUERIES),
  };
}

function brregHasPhone(c: Company): boolean {
  for (const raw of [c.mobile, c.phone]) {
    const v = raw?.trim();
    if (v && isPlausibleNorwegianPhone(v) && phonePlausibleForCompany(v, c.orgnr)) {
      return true;
    }
  }
  return false;
}

async function loadCandidatePool(poolSize: number): Promise<Company[]> {
  const supabase = createServiceClient();
  const picked: Company[] = [];
  const seen = new Set<string>();

  const add = (c: Company) => {
    if (seen.has(c.orgnr)) return;
    if (/TVANGSAVVIKLINGSBO|KONKURSBO/i.test(c.name)) return;
    if (!c.municipality_name?.trim() && !c.city?.trim()) return;
    seen.add(c.orgnr);
    picked.push(c);
  };

  // Tidligere skannede firma — prioriter de med tlf/FB (bedre eval-dekning)
  const scanCandidates: { company: Company; score: number }[] = [];
  let scanOffset = 0;
  while (scanCandidates.length < poolSize * 2 && scanOffset < 3000) {
    const { data, error } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan")
      .range(scanOffset, scanOffset + 199);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const scan = row.scan as WebsiteScanResult;
      if (!scan?.websiteUrl?.trim()) continue;
      let score = 1;
      if (scan.enrichedPhone?.trim()) score += 2;
      if (scan.facebookUrl?.trim()) score += 2;

      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("orgnr", row.orgnr)
        .maybeSingle();
      if (company) scanCandidates.push({ company: company as Company, score });
    }
    scanOffset += 200;
  }

  scanCandidates
    .sort((a, b) => b.score - a.score)
    .forEach(({ company }) => {
      if (picked.length < poolSize) add(company);
    });

  // Brreg-telefon + sted
  let companyOffset = 0;
  while (picked.length < poolSize && companyOffset < 6000) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("registered_at", { ascending: false })
      .range(companyOffset, companyOffset + 199);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data as Company[]) {
      if (!brregHasPhone(row)) continue;
      add(row);
      if (picked.length >= poolSize) break;
    }
    companyOffset += 200;
  }

  return picked;
}

type EvalRow = {
  orgnr: string;
  name: string;
  place: string | null;
  truthWebsite: string | null;
  truthDomain: string | null;
  truthPhone: string | null;
  truthFacebook: string | null;
  serperWebsite: string | null;
  serperDomain: string | null;
  serperWebsiteConfidence: string | null;
  websiteMatch: boolean | null;
  serperPhone: string | null;
  serperPhoneConfidence: string | null;
  phoneMatch: boolean | null;
  serperFacebook: string | null;
  serperFacebookConfidence: string | null;
  facebookMatch: boolean | null;
  websiteQueries: string[];
  phoneQueries: string[];
  facebookQueriesRun: number;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function metricBlock(
  rows: EvalRow[],
  truthKey: keyof EvalRow,
  serperKey: keyof EvalRow,
  matchKey: keyof EvalRow
) {
  const withTruth = rows.filter((r) => r[truthKey]);
  const match = withTruth.filter((r) => r[matchKey] === true);
  const wrong = withTruth.filter(
    (r) => r[serperKey] && r[matchKey] !== true
  );
  const miss = withTruth.filter((r) => !r[serperKey]);
  const found = withTruth.filter((r) => r[serperKey]);
  return {
    withTruth: withTruth.length,
    match: match.length,
    matchPct: pct(match.length, withTruth.length),
    found: found.length,
    foundPct: pct(found.length, withTruth.length),
    wrong: wrong.length,
    miss: miss.length,
  };
}

async function main() {
  loadEnvLocal();

  const { limit, seed } = parseArgs();
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    console.error("SERPER_API_KEY mangler i .env.local");
    process.exit(1);
  }

  const poolTarget = Math.max(limit * 4, 80);
  console.log(`Henter inntil ${poolTarget} kandidater (seed ${seed})…`);
  const pool = shuffle(await loadCandidatePool(poolTarget), seed);

  console.log(
    `Fase 1: Ground truth (uten Serper) — mål ${limit} bedrifter med treff…\n`
  );
  const evalRows: EvalRow[] = [];
  const companyByOrgnr = new Map<string, Company>();
  let tried = 0;

  for (const c of pool) {
    if (evalRows.length >= limit) break;
    tried++;
    const input = discoveryInput(c);
    process.stdout.write(
      `[GT ${evalRows.length + 1}/${limit}?] ${c.name.slice(0, 36)}… `
    );

    try {
      const truth = await discoverGroundTruth(input);
      const hasAny = truth.website || truth.phone || truth.facebook;
      if (!hasAny) {
        console.log("hopp");
        await sleep(150);
        continue;
      }

      companyByOrgnr.set(c.orgnr, c);
      evalRows.push({
        orgnr: c.orgnr,
        name: c.name,
        place: c.municipality_name ?? c.city,
        truthWebsite: truth.website,
        truthDomain: truth.website ? domainOf(truth.website) : null,
        truthPhone: truth.phone,
        truthFacebook: truth.facebook,
        serperWebsite: null,
        serperDomain: null,
        serperWebsiteConfidence: null,
        websiteMatch: null,
        serperPhone: null,
        serperPhoneConfidence: null,
        phoneMatch: null,
        serperFacebook: null,
        serperFacebookConfidence: null,
        facebookMatch: null,
        websiteQueries: [],
        phoneQueries: [],
        facebookQueriesRun: 0,
      });
      console.log(
        `www${truth.website ? "✓" : "–"} tlf${truth.phone ? "✓" : "–"} fb${truth.facebook ? "✓" : "–"}`
      );
    } catch (err) {
      console.log("FEIL");
    }

    await sleep(250);
  }

  if (evalRows.length < limit) {
    console.warn(
      `\nFant bare ${evalRows.length}/${limit} med ground truth (prøvde ${tried}).`
    );
  }
  console.log(`\n${evalRows.length} bedrifter — kjører Serper…\n`);

  forceSerperEval();

  for (let i = 0; i < evalRows.length; i++) {
    const row = evalRows[i]!;
    const c = companyByOrgnr.get(row.orgnr)!;
    const input = discoveryInput(c);

    process.stdout.write(
      `[SP ${i + 1}/${evalRows.length}] ${row.name.slice(0, 36)}… `
    );

    try {
      const [web, phone, fb] = await Promise.all([
        row.truthWebsite ? discoverWebsiteSerper(input) : Promise.resolve(null),
        row.truthPhone
          ? discoverPhoneFromSerper(input)
          : Promise.resolve(null),
        row.truthFacebook
          ? discoverFacebookSerper(input, row.truthDomain)
          : Promise.resolve(null),
      ]);

      if (web) {
        row.serperWebsite = web.websiteUrl;
        row.serperDomain = web.websiteDomain;
        row.serperWebsiteConfidence = web.confidence;
        row.websiteQueries = web.queries;
        row.websiteMatch = domainsMatch(row.truthWebsite, web.websiteUrl);
      }
      if (phone) {
        row.serperPhone = phone.phone;
        row.serperPhoneConfidence = phone.confidence;
        row.phoneQueries = phone.queries;
        row.phoneMatch = phonesMatch(row.truthPhone, phone.phone);
      }
      if (fb) {
        row.serperFacebook = fb.facebookUrl;
        row.serperFacebookConfidence = fb.confidence;
        row.facebookQueriesRun = fb.queriesRun;
        row.facebookMatch = facebookMatches(fb.facebookUrl, row.truthFacebook);
      }

      const parts: string[] = [];
      if (row.truthWebsite) {
        parts.push(
          row.websiteMatch ? "www✓" : row.serperWebsite ? "www✗" : "www–"
        );
      }
      if (row.truthPhone) {
        parts.push(row.phoneMatch ? "tlf✓" : row.serperPhone ? "tlf✗" : "tlf–");
      }
      if (row.truthFacebook) {
        parts.push(
          row.facebookMatch ? "fb✓" : row.serperFacebook ? "fb✗" : "fb–"
        );
      }
      console.log(parts.join(" ") || "–");
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      console.log("FEIL");
    }

    await sleep(400);
  }

  const website = metricBlock(
    evalRows,
    "truthWebsite",
    "serperWebsite",
    "websiteMatch"
  );
  const phone = metricBlock(evalRows, "truthPhone", "serperPhone", "phoneMatch");
  const facebook = metricBlock(
    evalRows,
    "truthFacebook",
    "serperFacebook",
    "facebookMatch"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    seed,
    tested: evalRows.length,
    poolTried: tried,
    approach: "ground-truth-first-non-serper",
    baseline: BASELINE,
    summary: { website, phone, facebook },
    rows: evalRows,
  };

  const cacheDir = resolve(process.cwd(), "scripts/.cache");
  mkdirSync(cacheDir, { recursive: true });
  const outPath = resolve(cacheDir, "serper-eval-30.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\n=== SERPER EVAL (ground truth først) ===");
  console.log(
    `Nettside: ${website.match}/${website.withTruth} match (${website.matchPct} %) — baseline ${BASELINE.websiteMatchPct}%`
  );
  console.log(
    `Telefon:  ${phone.match}/${phone.withTruth} match (${phone.matchPct} %) — baseline ${BASELINE.phoneMatchPct}%`
  );
  console.log(
    `Facebook: ${facebook.match}/${facebook.withTruth} match (${facebook.matchPct} %) — baseline ${BASELINE.facebookMatchPct}%`
  );
  console.log(`\nRapport: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
