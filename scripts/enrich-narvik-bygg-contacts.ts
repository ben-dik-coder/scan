/**
 * Fyll inn telefon og e-post for Narvik-firma per bransje.
 * Ingen SerpAPI — kun Brreg, 1881, Gulesider, nettside og eiersøk (1881/Gulesider).
 *
 * Kjør: npx tsx scripts/enrich-narvik-bygg-contacts.ts --industry bygg [--shard 0 --shards 4]
 * Bodø frisør: npx tsx scripts/enrich-narvik-bygg-contacts.ts --kommune 1804 --industry frisor --profile full --with-facebook --shard 0 --shards 25
 * Servering: npx tsx scripts/enrich-narvik-bygg-contacts.ts --industry servering --shard 1 --shards 6
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { isGenericEmail } from "../src/lib/brreg/map-company.ts";
import {
  BrregRefreshBuffer,
  CompanyPatchBuffer,
  WebsiteScanBuffer,
} from "./lib/enrich-batch-db.ts";
import {
  getIndustryCodeOrFilters,
  industryGroupLabel,
} from "../src/lib/constants/industries.ts";
import {
  fetchBrregRolePersons,
  lookupFreeContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import { scanCompanyWebsite } from "../src/lib/website-scan/scan-company.ts";
import { DEFAULT_SCAN_SOCIAL_OPTIONS } from "../src/lib/website-scan/scan-social-options.ts";
import type { Company } from "../src/types/database.ts";

const DEFAULT_KOMMUNE = "1806";
const DEFAULT_INDUSTRY = "bygg";

function progressPath(slug: string, industry: string, shard: number | null): string {
  const name =
    shard === null
      ? `${slug}-${industry}-enrich-progress.json`
      : `${slug}-${industry}-enrich-progress-shard-${shard}.json`;
  return resolve(process.cwd(), "scripts/.cache", name);
}

function slugForKommune(kommune: string): string {
  if (kommune === "1806") return "narvik";
  if (kommune === "1804") return "bodo";
  if (kommune === "5503") return "harstad";
  if (kommune === "5501") return "tromso";
  return `kommune-${kommune}`;
}

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
  let limit = 0;
  let dryRun = false;
  let delayMs = 250;
  let shard: number | null = null;
  let shards = 4;
  let industry = DEFAULT_INDUSTRY;
  let kommune = DEFAULT_KOMMUNE;
  let profile: "contact" | "full" = "contact";
  let withFacebook = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--delay" && args[i + 1]) delayMs = Number(args[++i]);
    else if (args[i] === "--shard" && args[i + 1]) shard = Number(args[++i]);
    else if (args[i] === "--shards" && args[i + 1]) shards = Number(args[++i]);
    else if (args[i] === "--industry" && args[i + 1]) industry = args[++i];
    else if (args[i] === "--kommune" && args[i + 1]) kommune = args[++i];
    else if (args[i] === "--profile" && args[i + 1]) {
      profile = args[++i] === "full" ? "full" : "contact";
    } else if (args[i] === "--with-facebook") withFacebook = true;
  }
  return { limit, dryRun, delayMs, shard, shards, industry, kommune, profile, withFacebook };
}

function sliceShard<T>(items: T[], shard: number, shards: number): T[] {
  const n = items.length;
  const start = Math.ceil((shard * n) / shards);
  const end = Math.ceil(((shard + 1) * n) / shards);
  return items.slice(start, end);
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

function needsFullProfile(
  c: Company,
  facebookByOrgnr: Map<string, string | null | undefined>,
  withFacebook: boolean
): boolean {
  const missingFacebook =
    withFacebook && (facebookByOrgnr.get(c.orgnr) ?? null) === null;
  return (
    !hasPhone(c) ||
    !hasEmail(c) ||
    !(c.daglig_leder ?? "").trim() ||
    missingFacebook
  );
}

async function loadFacebookByOrgnr(orgnrs: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (orgnrs.length === 0) return map;

  const supabase = createServiceClient();
  const chunkSize = 80;
  for (let i = 0; i < orgnrs.length; i += chunkSize) {
    const batch = orgnrs.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan")
      .in("orgnr", batch);
    for (const row of data ?? []) {
      const scan = row.scan as { facebookUrl?: string | null } | null;
      map.set(
        row.orgnr as string,
        typeof scan?.facebookUrl === "string" && scan.facebookUrl.trim()
          ? scan.facebookUrl.trim()
          : ""
      );
    }
  }
  for (const orgnr of orgnrs) {
    if (!map.has(orgnr)) map.set(orgnr, null);
  }
  return map;
}

function queueWebsiteScan(
  buffer: WebsiteScanBuffer,
  scan: Awaited<ReturnType<typeof scanCompanyWebsite>>,
  userId: string
) {
  return buffer.queue({
    orgnr: scan.orgnr,
    scan,
    scanned_at: scan.scannedAt,
    scanned_by: userId,
  });
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Progress = {
  done: string[];
  results: Record<
    string,
    {
      name: string;
      addedPhone?: string;
      addedEmail?: string;
      addedOwner?: string;
      addedFacebook?: string;
      source?: string;
      skipped?: string;
      error?: string;
    }
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

async function refreshFromBrreg(
  existing: Company,
  buffer: BrregRefreshBuffer
): Promise<Company | null> {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${existing.orgnr}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const enhet = await res.json();
  return buffer.queue(enhet, existing);
}

async function loadMunicipalityIndustry(
  kommune: string,
  industry: string
): Promise<Company[]> {
  const supabase = createServiceClient();
  const codeFilters = getIndustryCodeOrFilters(industry) ?? [];
  if (!codeFilters.length) {
    throw new Error(`Ukjent bransje "${industry}" — bruk f.eks. bygg eller frisor`);
  }
  const pageSize = 1000;
  const rows: Company[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("municipality_code", kommune)
      .or(codeFilters.join(","))
      .order("orgnr")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Company[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  loadEnvLocal();
  const {
    limit,
    dryRun,
    delayMs,
    shard,
    shards,
    industry,
    kommune,
    profile,
    withFacebook,
  } = parseArgs();
  const slug = slugForKommune(kommune);
  const progressFile = progressPath(slug, industry, shard);
  const industryLabel = industryGroupLabel(industry);

  const all = await loadMunicipalityIndustry(kommune, industry);
  const facebookByOrgnr = withFacebook
    ? await loadFacebookByOrgnr(all.map((c) => c.orgnr))
    : new Map<string, string | null>();

  let missing = all
    .filter((c) =>
      profile === "full"
        ? needsFullProfile(c, facebookByOrgnr, withFacebook)
        : needsContact(c)
    )
    .sort((a, b) => a.orgnr.localeCompare(b.orgnr));
  const totalMissing = missing.length;

  if (shard !== null) {
    if (shard < 0 || shard >= shards) {
      throw new Error(`Ugyldig shard ${shard} (må være 0–${shards - 1})`);
    }
    missing = sliceShard(missing, shard, shards);
  }

  let targets = missing;
  if (limit > 0) targets = targets.slice(0, limit);

  console.log(`${slug} (${kommune}) ${industryLabel} (${industry}) i DB: ${all.length}`);
  console.log(
    profile === "full"
      ? `Mangler telefon, e-post, daglig leder eller Facebook: ${totalMissing}`
      : `Mangler telefon eller e-post: ${totalMissing}`
  );
  if (shard !== null) {
    const start = Math.ceil((shard * totalMissing) / shards);
    const end = Math.ceil(((shard + 1) * totalMissing) / shards);
    console.log(`Shard ${shard}/${shards - 1}: indeks ${start}–${end - 1} (${targets.length} firma)`);
  }
  console.log(`Behandler: ${targets.length}`);
  console.log(
    `Metode: Brreg + 1881 + Gulesider + nettside + eiersøk${withFacebook ? " + Facebook-skanning" : ""} (ingen SerpAPI)${dryRun ? " (dry-run)" : ""}\n`
  );

  let addedPhone = 0;
  let addedEmail = 0;
  let addedOwner = 0;
  let addedFacebook = 0;
  let skipped = 0;
  let errors = 0;
  const progress: Progress = loadProgress(progressFile);
  const companyBuffer = new CompanyPatchBuffer();
  const brregBuffer = new BrregRefreshBuffer();
  const scanBuffer = new WebsiteScanBuffer();

  for (const initial of targets) {
    if (progress.done.includes(initial.orgnr)) {
      console.log(`↷ ${initial.name} — allerede ferdig`);
      continue;
    }
    const skip = skipCompany(initial);
    if (skip) {
      skipped++;
      progress.done.push(initial.orgnr);
      progress.results[initial.orgnr] = { name: initial.name, skipped: skip };
      saveProgress(progressFile, progress);
      console.log(`⊘ ${initial.name} — hoppet over (${skip})`);
      continue;
    }

    try {
      const company = (await refreshFromBrreg(initial, brregBuffer)) ?? initial;
      const patch: Record<string, string | boolean> = {};
      const notes: string[] = [];

      const roles = await fetchBrregRolePersons(company.orgnr).catch(() => []);
      const owner = roles.find((r) =>
        /innehaver|daglig leder/i.test(r.role)
      );
      if (owner && !(company.daglig_leder ?? "").trim()) {
        patch.daglig_leder = owner.name;
        addedOwner++;
      }

      const needPhone = !hasPhone(company);
      const needEmail = !hasEmail(company);

      if (needPhone || needEmail) {
        const hit = await lookupFreeContact({
          orgnr: company.orgnr,
          name: company.name,
          email: company.email,
          website: company.website,
          municipality_name: company.municipality_name,
          city: company.city,
          industry_code: company.industry_code,
        });

        if (hit) {
          if (needPhone && hit.phone) {
            const stored = storePhone(hit.phone);
            if (stored.mobile) {
              patch.mobile = stored.mobile;
              notes.push(`telefon ${hit.phone} (${hit.source})`);
              addedPhone++;
            } else if (stored.phone) {
              patch.phone = stored.phone;
              notes.push(`telefon ${hit.phone} (${hit.source})`);
              addedPhone++;
            }
          }
          if (needEmail && hit.email) {
            patch.email = hit.email;
            patch.has_email = true;
            patch.email_is_generic = isGenericEmail(hit.email);
            notes.push(`e-post ${hit.email} (${hit.source})`);
            addedEmail++;
          }
        }
      }

      if (
        owner &&
        !(company.daglig_leder ?? "").trim() &&
        !notes.some((n) => n.startsWith("eier"))
      ) {
        notes.push(`eier ${owner.name}`);
      }

      if (
        withFacebook &&
        !facebookByOrgnr.get(company.orgnr) &&
        !dryRun
      ) {
        const scan = await scanCompanyWebsite(
          {
            orgnr: company.orgnr,
            name: company.name,
            email: company.email,
            municipality_name: company.municipality_name,
            city: company.city,
            website: company.website,
            industry_code: company.industry_code,
          },
          {
            social: {
              ...DEFAULT_SCAN_SOCIAL_OPTIONS,
              includeFacebook: true,
            },
          }
        );
        await queueWebsiteScan(scanBuffer, scan, "enrich-script");
        if (scan.facebookUrl?.trim()) {
          notes.push(`Facebook ${scan.facebookUrl.trim()}`);
          addedFacebook++;
          facebookByOrgnr.set(company.orgnr, scan.facebookUrl.trim());
        } else {
          facebookByOrgnr.set(company.orgnr, "");
        }
        if (
          !hasPhone(company) &&
          !patch.mobile &&
          !patch.phone &&
          scan.enrichedPhone
        ) {
          const stored = storePhone(scan.enrichedPhone);
          if (stored.mobile) {
            patch.mobile = stored.mobile;
            notes.push(`telefon ${scan.enrichedPhone} (skann)`);
            addedPhone++;
          } else if (stored.phone) {
            patch.phone = stored.phone;
            notes.push(`telefon ${scan.enrichedPhone} (skann)`);
            addedPhone++;
          }
        }
      }

      if (Object.keys(patch).length > 0 && !dryRun) {
        patch.updated_at = new Date().toISOString();
        await companyBuffer.queue(company.orgnr, patch);
      }

      progress.done.push(company.orgnr);
      progress.results[company.orgnr] = {
        name: company.name,
        addedPhone: (patch.mobile as string) ?? (patch.phone as string),
        addedEmail: patch.email as string | undefined,
        addedOwner: patch.daglig_leder as string | undefined,
        addedFacebook: (() => {
          const fb = facebookByOrgnr.get(company.orgnr);
          return fb && fb.length > 0 ? fb : undefined;
        })(),
        source: notes.join("; ") || "ingen nye funn",
      };
      saveProgress(progressFile, progress);

      const mark = notes.length ? "✓" : "·";
      console.log(`${mark} ${company.name}`);
      if (notes.length) console.log(`  ${notes.join(" | ")}`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      progress.results[initial.orgnr] = { name: initial.name, error: msg };
      progress.done.push(initial.orgnr);
      saveProgress(progressFile, progress);
      console.error(`✗ ${initial.name}: ${msg}`);
    }

    await sleep(delayMs);
  }

  if (!dryRun) {
    await Promise.all([
      companyBuffer.flush(),
      brregBuffer.flush(),
      scanBuffer.flush(),
    ]);
  }

  const processed = progress.done.length;
  let stillMissingInShard = 0;
  let stillMissing = 0;
  if (!dryRun) {
    const after = await loadMunicipalityIndustry(kommune, industry);
    const afterFacebook = withFacebook
      ? await loadFacebookByOrgnr(after.map((c) => c.orgnr))
      : new Map<string, string | null>();
    const afterMissing = after.filter((c) =>
      profile === "full"
        ? needsFullProfile(c, afterFacebook, withFacebook)
        : needsContact(c)
    );
    stillMissing = afterMissing.length;
    let afterShard = [...afterMissing].sort((a, b) => a.orgnr.localeCompare(b.orgnr));
    if (shard !== null) afterShard = sliceShard(afterShard, shard, shards);
    stillMissingInShard = afterShard.filter((c) => !skipCompany(c)).length;
  }

  console.log("\n--- Oppsummering ---");
  console.log(`Sted: ${slug} (${kommune}) · Bransje: ${industryLabel} (${industry})`);
  console.log(`Behandlet (shard): ${processed}`);
  console.log(`Nye telefon: ${addedPhone}`);
  console.log(`Nye e-post: ${addedEmail}`);
  console.log(`Nye eiere: ${addedOwner}`);
  console.log(`Nye Facebook: ${addedFacebook}`);
  console.log(`Hoppet over: ${skipped}`);
  console.log(`Feil: ${errors}`);
  if (!dryRun) {
    console.log(`Gjenstår i shard: ${stillMissingInShard}`);
    console.log(`Gjenstår totalt: ${stillMissing}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
