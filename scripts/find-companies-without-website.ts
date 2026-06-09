/**
 * Finn firma uten nettside per kommune og valgfri bransje.
 * Ingen SerpAPI — DB, Brreg, og valgfritt 1881/Gulesider/e-post/domene.
 *
 * Kjør:
 *   npx tsx scripts/find-companies-without-website.ts
 *   npx tsx scripts/find-companies-without-website.ts --industry eiendom
 *   npx tsx scripts/find-companies-without-website.ts --municipality 1806 --output out/narvik-uten-nettside.csv
 *   npx tsx scripts/find-companies-without-website.ts --industry bygg --refresh --verify --shard 0 --shards 4
 *
 * Flag:
 *   --municipality   Kommunenummer (standard 1806 Narvik)
 *   --industry       Bransje-id fra industries.ts (f.eks. bygg, eiendom, servering)
 *   --output         Skriv JSON eller CSV (filendelse styrer format)
 *   --refresh        Oppdater hvert firma fra Brreg før filtrering
 *   --verify         Dyp sjekk: e-postdomene, domene-gjetning, 1881 og Gulesider
 *   --shard / --shards   Del opp store lister (som enrich-skriptene)
 *   --limit          Maks antall å behandle (nyttig med --verify)
 *   --delay          Ms mellom Brreg/verify-kall (standard 200)
 *   --dry-run        Skriv til stdout, ikke til --output
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { upsertBrregEnhet } from "../src/lib/brreg/upsert-enhet.ts";
import {
  getIndustryCodeOrFilters,
  industryGroupLabel,
} from "../src/lib/constants/industries.ts";
import { websiteFromBrreg } from "../src/lib/website-scan/brreg-website-hint.ts";
import { discoverWebsiteByDomainGuess } from "../src/lib/website-scan/domain-guess.ts";
import { websiteFromEmail } from "../src/lib/website-scan/email-hint.ts";
import { fetchPublicHtml } from "../src/lib/website-scan/fetch-public-html.ts";
import {
  lookup1881Contact,
  lookupGulesiderContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { extractExternalWebsiteFromHtml } from "../src/lib/website-scan/parse-page-contact.ts";
import type { Company } from "../src/types/database.ts";

const DEFAULT_MUNICIPALITY = "1806";

type OutputRow = {
  orgnr: string;
  name: string;
  phone: string;
  email: string;
  industry: string;
  municipality: string;
  daglig_leder: string;
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

function parseArgs() {
  const args = process.argv.slice(2);
  let municipality = DEFAULT_MUNICIPALITY;
  let industry = "";
  let output = "";
  let refresh = false;
  let verify = false;
  let dryRun = false;
  let limit = 0;
  let delayMs = 200;
  let shard: number | null = null;
  let shards = 4;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--municipality" && args[i + 1]) municipality = args[++i];
    else if (args[i] === "--industry" && args[i + 1]) industry = args[++i];
    else if (args[i] === "--output" && args[i + 1]) output = args[++i];
    else if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--delay" && args[i + 1]) delayMs = Number(args[++i]);
    else if (args[i] === "--shard" && args[i + 1]) shard = Number(args[++i]);
    else if (args[i] === "--shards" && args[i + 1]) shards = Number(args[++i]);
    else if (args[i] === "--refresh") refresh = true;
    else if (args[i] === "--verify") verify = true;
    else if (args[i] === "--dry-run") dryRun = true;
  }

  return { municipality, industry, output, refresh, verify, dryRun, limit, delayMs, shard, shards };
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

function hasStoredWebsite(website: string | null | undefined): boolean {
  return Boolean((website ?? "").trim());
}

function skipCompany(c: Pick<Company, "name">): string | null {
  const name = (c.name ?? "").toUpperCase();
  if (name.includes("KONKURSBO")) return "konkursbo";
  if (name.includes("TVANGSAVVIKLINGSBO")) return "tvangsavvikling";
  return null;
}

function toOutputRow(c: Company): OutputRow {
  return {
    orgnr: c.orgnr,
    name: c.name,
    phone: (c.mobile ?? "").trim() || (c.phone ?? "").trim() || "",
    email: (c.email ?? "").trim() || "",
    industry: (c.industry_code ?? "").trim() || "",
    municipality: (c.municipality_name ?? "").trim() || "",
    daglig_leder: (c.daglig_leder ?? "").trim() || "",
  };
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: OutputRow[]): string {
  const headers = [
    "orgnr",
    "name",
    "phone",
    "email",
    "industry",
    "municipality",
    "daglig_leder",
  ] as const;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function refreshFromBrreg(orgnr: string): Promise<Company | null> {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const enhet = await res.json();
  const supabase = createServiceClient();
  await upsertBrregEnhet(enhet, supabase);

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("orgnr", orgnr)
    .maybeSingle();
  return (data as Company | null) ?? null;
}

async function loadCompanies(
  municipality: string,
  industry: string
): Promise<Company[]> {
  const supabase = createServiceClient();
  const codeFilters = industry ? getIndustryCodeOrFilters(industry) : undefined;
  if (industry && !codeFilters?.length) {
    throw new Error(
      `Ukjent bransje "${industry}" — bruk f.eks. bygg, eiendom eller servering`
    );
  }

  const pageSize = 500;
  const all: Company[] = [];
  let offset = 0;

  while (offset < 5000) {
    let query = supabase
      .from("companies")
      .select("*")
      .eq("municipality_code", municipality)
      .order("orgnr")
      .range(offset, offset + pageSize - 1);

    if (codeFilters?.length) {
      query = query.or(codeFilters.join(","));
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    all.push(...(data as Company[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function externalWebsiteFromDirectoryPage(
  url: string,
  platformHost: string
): Promise<string | null> {
  const html = await fetchPublicHtml(url);
  if (!html) return null;
  return extractExternalWebsiteFromHtml(html, platformHost);
}

async function verifyHasWebsite(
  company: Company
): Promise<{ found: boolean; source?: string }> {
  if (hasStoredWebsite(company.website)) {
    return { found: true, source: "db" };
  }

  const brreg = websiteFromBrreg(company.website, company.name);
  if (brreg) return { found: true, source: "brreg" };

  const emailHint = websiteFromEmail(company.email, company.name);
  if (emailHint) return { found: true, source: "email" };

  const guessed = await discoverWebsiteByDomainGuess(company.name);
  if (guessed) return { found: true, source: "domain-guess" };

  const hit1881 = await lookup1881Contact(company).catch(() => null);
  if (hit1881?.url) {
    const ext = await externalWebsiteFromDirectoryPage(hit1881.url, "1881.no");
    if (ext) return { found: true, source: "1881" };
  }

  const hitGulesider = await lookupGulesiderContact(company).catch(() => null);
  if (hitGulesider?.url) {
    const ext = await externalWebsiteFromDirectoryPage(
      hitGulesider.url,
      "gulesider.no"
    );
    if (ext) return { found: true, source: "gulesider" };
  }

  return { found: false };
}

async function main() {
  loadEnvLocal();
  const {
    municipality,
    industry,
    output,
    refresh,
    verify,
    dryRun,
    limit,
    delayMs,
    shard,
    shards,
  } = parseArgs();

  const industryLabel = industry ? industryGroupLabel(industry) : "Alle bransjer";
  const all = await loadCompanies(municipality, industry);
  const eligible = all.filter((c) => !skipCompany(c));

  console.log(`Kommune ${municipality} — ${industryLabel}${industry ? ` (${industry})` : ""}`);
  console.log(`Firma i DB: ${all.length} (aktive: ${eligible.length})`);

  let working = [...eligible].sort((a, b) => a.orgnr.localeCompare(b.orgnr));

  if (refresh) {
    console.log(`Oppdaterer ${working.length} firma fra Brreg...`);
    const refreshed: Company[] = [];
    for (const company of working) {
      const updated = (await refreshFromBrreg(company.orgnr)) ?? company;
      refreshed.push(updated);
      await sleep(delayMs);
    }
    working = refreshed;
  }

  let withoutWebsite = working.filter((c) => !hasStoredWebsite(c.website));
  console.log(`Uten nettside i DB${refresh ? "/Brreg" : ""}: ${withoutWebsite.length}`);

  if (verify) {
    let targets = withoutWebsite;
    if (limit > 0) targets = targets.slice(0, limit);

    console.log(
      `Verifiserer ${targets.length} firma (1881, Gulesider, e-post, domene)...`
    );

    const verified: Company[] = [];
    let excluded = 0;

    for (const company of targets) {
      const check = await verifyHasWebsite(company);
      if (check.found) {
        excluded++;
        console.log(`⊘ ${company.name} — fant nettside (${check.source})`);
      } else {
        verified.push(company);
        console.log(`✓ ${company.name} — uten nettside`);
      }
      await sleep(delayMs);
    }

    withoutWebsite = verified;
    console.log(`Etter verify: ${withoutWebsite.length} (fjernet ${excluded})`);
  } else if (limit > 0) {
    withoutWebsite = withoutWebsite.slice(0, limit);
  }

  const totalWithoutWebsite = withoutWebsite.length;
  if (shard !== null) {
    if (shard < 0 || shard >= shards) {
      throw new Error(`Ugyldig shard ${shard} (må være 0–${shards - 1})`);
    }
    withoutWebsite = sliceShard(withoutWebsite, shard, shards);
    const start = Math.ceil((shard * totalWithoutWebsite) / shards);
    const end = Math.ceil(((shard + 1) * totalWithoutWebsite) / shards);
    console.log(`Shard ${shard}/${shards - 1}: indeks ${start}–${end - 1} (${withoutWebsite.length} firma)`);
  }

  const rows = withoutWebsite.map(toOutputRow);

  console.log("\n--- Oppsummering ---");
  console.log(`Kommune: ${municipality}`);
  console.log(`Bransje: ${industryLabel}${industry ? ` (${industry})` : ""}`);
  console.log(`Uten nettside: ${totalWithoutWebsite}`);
  if (shard !== null) console.log(`I denne shard: ${rows.length}`);
  console.log(`Refresh: ${refresh ? "ja" : "nei"} | Verify: ${verify ? "ja" : "nei"}`);

  if (rows.length > 0) {
    console.log("\nEksempler (maks 10):");
    for (const row of rows.slice(0, 10)) {
      console.log(
        [row.orgnr, row.name, row.phone || "-", row.email || "-", row.daglig_leder || "-"].join(
          " | "
        )
      );
    }
  }

  if (dryRun || !output) return;

  const outPath = resolve(process.cwd(), output);
  mkdirSync(dirname(outPath), { recursive: true });
  const payload =
    outPath.endsWith(".csv") ? rowsToCsv(rows) : `${JSON.stringify(rows, null, 2)}\n`;
  writeFileSync(outPath, payload, "utf8");
  console.log(`\nSkrev ${rows.length} rader til ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
