/**
 * Rask Bodø frisør-enrichment: Brreg bulk → 1881/Gulesider kontakt → lett Facebook.
 * Ingen full nettside-skann.
 *
 * Kjør: npx tsx scripts/enrich-bodo-frisor-fast.ts
 *      npx tsx scripts/enrich-bodo-frisor-fast.ts --phase owners|phones|facebook
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { isGenericEmail } from "../src/lib/brreg/map-company.ts";
import { getIndustryCodeOrFilters, industryGroupLabel } from "../src/lib/constants/industries.ts";
import { companyGeoPlaces, primaryGeoPlace } from "../src/lib/brreg/geo-place.ts";
import { discoverFacebookFromDirectoriesFree } from "../src/lib/website-scan/discover-social-free.ts";
import { searchDuckDuckGo } from "../src/lib/website-scan/duckduckgo-search.ts";
import {
  fetchBrregRolePersons,
  lookup1881Contact,
  lookupGulesiderContact,
  type DirectoryContactHit,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { SearchHit } from "../src/lib/website-scan/parse-results.ts";
import {
  buildFacebookSearchQueries,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles.ts";
import type { WebsiteScanResult } from "../src/lib/website-scan/types.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1804";
const INDUSTRY = "frisor";
const CONCURRENCY = 15;
const MAX_DDG = 2;
const PROGRESS_FILE = resolve(process.cwd(), "scripts/.cache/bodo-frisor-fast-progress.json");

type Phase = "all" | "owners" | "phones" | "facebook";

type Progress = {
  owners: string[];
  /** Firma ferdig sjekket for telefon/e-post (tidligere «phones») */
  contacts: string[];
  phones?: string[];
  facebook: string[];
  results: Record<string, { name: string; note?: string; error?: string }>;
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(): { phase: Phase; dryRun: boolean } {
  const args = process.argv.slice(2);
  let phase: Phase = "all";
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--phase" && args[i + 1]) {
      const p = args[++i];
      if (p === "owners" || p === "phones" || p === "facebook" || p === "all") {
        phase = p;
      }
    } else if (args[i] === "--dry-run") dryRun = true;
  }
  return { phase, dryRun };
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_FILE)) {
    return { owners: [], contacts: [], facebook: [], results: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf8")) as Progress;
    if (!raw.contacts?.length && raw.phones?.length) {
      raw.contacts = [...raw.phones];
    }
    if (!raw.contacts) raw.contacts = [];
    return raw;
  } catch {
    return { owners: [], contacts: [], facebook: [], results: {} };
  }
}

function saveProgress(progress: Progress) {
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function hasPhone(c: Pick<Company, "phone" | "mobile">): boolean {
  return Boolean((c.mobile ?? "").trim() || (c.phone ?? "").trim());
}

function hasEmail(c: Pick<Company, "email">): boolean {
  return Boolean((c.email ?? "").trim());
}

function needsContact(c: Company): boolean {
  return !hasPhone(c) || !hasEmail(c);
}

/** Ta ut firma som fortsatt mangler telefon eller e-post fra «ferdig»-lista. */
function reconcileContactsDone(companies: Company[], progress: Progress) {
  const byOrgnr = new Map(companies.map((c) => [c.orgnr, c]));
  progress.contacts = progress.contacts.filter((orgnr) => {
    const c = byOrgnr.get(orgnr);
    if (!c) return true;
    return hasPhone(c) && hasEmail(c);
  });
}

function mergeContacts(
  ...hits: Array<DirectoryContactHit | null | undefined>
): { phone: string | null; email: string | null; source: string } {
  let phone: string | null = null;
  let email: string | null = null;
  let source = "1881";
  for (const hit of hits) {
    if (!hit) continue;
    if (!phone && hit.phone) {
      phone = hit.phone;
      source = hit.source;
    }
    if (!email && hit.email) email = hit.email;
  }
  return { phone, email, source };
}

function skipCompany(c: Company): string | null {
  const name = (c.name ?? "").toUpperCase();
  if (name.includes("KONKURSBO")) return "konkursbo";
  if (name.includes("TVANGSAVVIKLINGSBO")) return "tvangsavvikling";
  return null;
}

function storePhone(value: string): { mobile?: string; phone?: string } {
  const core = phoneCoreDigits(value);
  if (!core || core.length !== 8) return {};
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  if (core.startsWith("7") || core.startsWith("2") || core.startsWith("3")) {
    return { phone: core };
  }
  return { mobile: core };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function loadCompanies(): Promise<Company[]> {
  const supabase = createServiceClient();
  const codes = getIndustryCodeOrFilters(INDUSTRY) ?? [];
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("municipality_code", KOMMUNE)
    .or(codes.join(","))
    .order("orgnr");
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
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

async function persistFacebook(orgnr: string, facebookUrl: string | null) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("company_website_scans")
    .select("scan")
    .eq("orgnr", orgnr)
    .maybeSingle();

  const base =
    (data?.scan as WebsiteScanResult | null) ??
    ({
      orgnr,
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

  await supabase.from("company_website_scans").upsert(
    {
      orgnr,
      scan: { ...base, facebookUrl, scannedAt: now },
      scanned_at: now,
      scanned_by: "fast-enrich",
    },
    { onConflict: "orgnr" }
  );
}

async function findFacebookLight(company: Company): Promise<{ url: string | null; source: string }> {
  const input = {
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    municipality_name: company.municipality_name,
    city: company.city,
    website: company.website,
    industry_code: company.industry_code,
  };
  const geoPlaces = companyGeoPlaces(input);
  const geoLabel = primaryGeoPlace(input) ?? geoPlaces[0] ?? "Bodø";
  const queries = buildFacebookSearchQueries(input);
  const fbHits: SearchHit[] = [];

  for (const q of queries.slice(0, MAX_DDG)) {
    const hits = await searchDuckDuckGo(q).catch(() => []);
    for (const hit of hits) {
      if (/facebook\.com/i.test(hit.link)) fbHits.push(hit);
    }
    const pick = pickFacebookFromHits(fbHits, company.name, geoLabel, { geoPlaces });
    if (pick.url) return { url: pick.url, source: "ddg" };
  }

  const dirHits = await discoverFacebookFromDirectoriesFree(input);
  const pick = pickFacebookFromHits(dirHits, company.name, geoLabel, { geoPlaces });
  if (pick.url) return { url: pick.url, source: "gulesider/1881" };

  return { url: null, source: "ingen" };
}

async function phaseOwners(companies: Company[], progress: Progress, dryRun: boolean) {
  const targets = companies.filter(
    (c) => !skipCompany(c) && !(c.daglig_leder ?? "").trim() && !progress.owners.includes(c.orgnr)
  );
  console.log(`\n=== Steg 1: Daglig leder (Brreg) — ${targets.length} firma ===\n`);
  let added = 0;

  await mapPool(targets, CONCURRENCY, async (company) => {
    try {
      const roles = await fetchBrregRolePersons(company.orgnr);
      const owner = roles.find((r) => /innehaver|daglig leder/i.test(r.role));
      progress.owners.push(company.orgnr);
      if (owner) {
        if (!dryRun) {
          const supabase = createServiceClient();
          await supabase
            .from("companies")
            .update({ daglig_leder: owner.name, updated_at: new Date().toISOString() })
            .eq("orgnr", company.orgnr);
        }
        added++;
        progress.results[company.orgnr] = { name: company.name, note: `daglig leder: ${owner.name}` };
        console.log(`✓ ${company.name} → ${owner.name}`);
      } else {
        progress.results[company.orgnr] = { name: company.name, note: "ingen rolle i Brreg" };
        console.log(`· ${company.name} — ingen rolle`);
      }
      saveProgress(progress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.owners.push(company.orgnr);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      saveProgress(progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }
  });

  console.log(`\nDaglig leder: ${added} nye`);
}

async function phasePhones(companies: Company[], progress: Progress, dryRun: boolean) {
  reconcileContactsDone(companies, progress);
  const targets = companies.filter(
    (c) => !skipCompany(c) && needsContact(c) && !progress.contacts.includes(c.orgnr)
  );
  console.log(`\n=== Steg 2: Telefon + e-post (1881/Gulesider) — ${targets.length} firma ===\n`);
  let addedPhone = 0;
  let addedEmail = 0;

  await mapPool(targets, 30, async (company) => {
    try {
      const from1881 = await lookup1881Contact(company).catch(() => null);
      const needGulesider =
        (!hasPhone(company) && !from1881?.phone) ||
        (!hasEmail(company) && !from1881?.email);
      const fromGulesider = needGulesider
        ? await lookupGulesiderContact(company).catch(() => null)
        : null;
      const { phone, email, source } = mergeContacts(from1881, fromGulesider);
      const notes: string[] = [];
      const patch: Record<string, string | boolean> = {
        updated_at: new Date().toISOString(),
      };

      if (phone && !hasPhone(company)) {
        const stored = storePhone(phone);
        if (stored.mobile) patch.mobile = stored.mobile;
        else if (stored.phone) patch.phone = stored.phone;
        if (stored.mobile || stored.phone) {
          addedPhone++;
          notes.push(`telefon ${phone} (${source})`);
        }
      }

      if (email && !hasEmail(company)) {
        patch.email = email;
        patch.has_email = true;
        patch.email_is_generic = isGenericEmail(email);
        addedEmail++;
        notes.push(`e-post ${email} (${source})`);
      }

      progress.contacts.push(company.orgnr);

      if (notes.length > 0 && !dryRun) {
        const supabase = createServiceClient();
        await supabase.from("companies").update(patch).eq("orgnr", company.orgnr);
        progress.results[company.orgnr] = { name: company.name, note: notes.join(" | ") };
        console.log(`✓ ${company.name} → ${notes.join(" | ")}`);
      } else {
        progress.results[company.orgnr] = {
          name: company.name,
          note: notes.length ? notes.join(" | ") : "ingen kontakt funn",
        };
        console.log(`· ${company.name} — ${notes.length ? notes.join(" | ") : "ingen kontakt"}`);
      }
      saveProgress(progress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.contacts.push(company.orgnr);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      saveProgress(progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }
  });

  console.log(`\nTelefon: ${addedPhone} nye · E-post: ${addedEmail} nye`);
}

async function phaseFacebook(companies: Company[], progress: Progress, dryRun: boolean) {
  const fbMap = await loadFacebookMap(companies.map((c) => c.orgnr));
  const targets = companies.filter(
    (c) =>
      !skipCompany(c) &&
      !fbMap.has(c.orgnr) &&
      !progress.facebook.includes(c.orgnr)
  );
  console.log(`\n=== Steg 3: Facebook (lett søk) — ${targets.length} firma ===\n`);
  let found = 0;

  await mapPool(targets, 8, async (company) => {
    try {
      const { url, source } = await findFacebookLight(company);
      progress.facebook.push(company.orgnr);

      if (url) {
        if (!dryRun) await persistFacebook(company.orgnr, url);
        found++;
        progress.results[company.orgnr] = { name: company.name, note: `Facebook ${url} (${source})` };
        console.log(`✓ ${company.name} → ${url}`);
      } else {
        if (!dryRun) await persistFacebook(company.orgnr, null);
        progress.results[company.orgnr] = { name: company.name, note: "ingen Facebook" };
        console.log(`· ${company.name} — ingen Facebook`);
      }
      saveProgress(progress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.facebook.push(company.orgnr);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      saveProgress(progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }
  });

  console.log(`\nFacebook: ${found} nye`);
}

async function main() {
  loadEnvLocal();
  const { phase, dryRun } = parseArgs();
  const progress = loadProgress();
  const companies = await loadCompanies();

  console.log(
    `Bodø ${industryGroupLabel(INDUSTRY)} — rask modus (${companies.length} firma)${dryRun ? " [dry-run]" : ""}`
  );
  console.log(`Fase: ${phase} · ${CONCURRENCY} parallelle Brreg-kall\n`);

  if (phase === "all" || phase === "owners") {
    await phaseOwners(companies, progress, dryRun);
  }
  if (phase === "all" || phase === "phones") {
    const fresh = phase === "phones" ? await loadCompanies() : companies;
    await phasePhones(fresh, progress, dryRun);
  }
  if (phase === "all" || phase === "facebook") {
    const fresh = phase === "facebook" ? await loadCompanies() : companies;
    await phaseFacebook(fresh, progress, dryRun);
  }

  console.log("\nFerdig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
