/**
 * Fyll inn telefon og e-post for Narvik servering og overnatting (NACE 55–56).
 * Ingen SerpAPI — kun Brreg, 1881, Gulesider, nettside og eieroppslag.
 *
 * Kjør: npx tsx scripts/enrich-narvik-servering-contacts.ts [--shard 0 --shards 6]
 * Shard: npx tsx scripts/enrich-narvik-servering-contacts.ts --shard 3 --shards 6
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { isGenericEmail } from "../src/lib/brreg/map-company.ts";
import { upsertBrregEnhet } from "../src/lib/brreg/upsert-enhet.ts";
import { getIndustryCodeOrFilters } from "../src/lib/constants/industries.ts";
import {
  fetchBrregRolePersons,
  lookupFreeContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { loadEnrichEnv } from "./lib/enrich-env.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1806";
const INDUSTRY = "servering";

function progressPath(shard: number | null): string {
  const name =
    shard === null
      ? "narvik-servering-enrich-progress.json"
      : `narvik-servering-enrich-progress-shard-${shard}.json`;
  return resolve(process.cwd(), "scripts/.cache", name);
}


function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 0;
  let dryRun = false;
  let delayMs = 250;
  let shard: number | null = null;
  let shards = 6;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--delay" && args[i + 1]) delayMs = Number(args[++i]);
    else if (args[i] === "--shard" && args[i + 1]) shard = Number(args[++i]);
    else if (args[i] === "--shards" && args[i + 1]) shards = Number(args[++i]);
  }
  return { limit, dryRun, delayMs, shard, shards };
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

async function loadNarvikServering(): Promise<Company[]> {
  const supabase = createServiceClient();
  const codeFilters = getIndustryCodeOrFilters(INDUSTRY) ?? [];
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("municipality_code", KOMMUNE)
    .or(codeFilters.join(","))
    .order("orgnr")
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

async function main() {
  loadEnrichEnv();
  const { limit, dryRun, delayMs, shard, shards } = parseArgs();
  const progressFile = progressPath(shard);

  const all = await loadNarvikServering();
  let missing = all.filter(needsContact).sort((a, b) => a.orgnr.localeCompare(b.orgnr));
  const totalMissing = missing.length;

  if (shard !== null) {
    if (shard < 0 || shard >= shards) {
      throw new Error(`Ugyldig shard ${shard} (må være 0–${shards - 1})`);
    }
    missing = sliceShard(missing, shard, shards);
  }

  let targets = missing;
  if (limit > 0) targets = targets.slice(0, limit);

  console.log(`Narvik servering/overnatting i DB: ${all.length}`);
  console.log(`Mangler telefon eller e-post: ${totalMissing}`);
  if (shard !== null) {
    const start = Math.ceil((shard * totalMissing) / shards);
    const end = Math.ceil(((shard + 1) * totalMissing) / shards);
    console.log(`Shard ${shard}/${shards - 1}: indeks ${start}–${end - 1} (${targets.length} firma)`);
  }
  console.log(`Behandler: ${targets.length}`);
  console.log(`Metode: Brreg + 1881 + Gulesider + nettside + eier (ingen SerpAPI)${dryRun ? " (dry-run)" : ""}\n`);

  let addedPhone = 0;
  let addedEmail = 0;
  let addedOwner = 0;
  let skipped = 0;
  let errors = 0;
  const progress: Progress = loadProgress(progressFile);

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
      let company = (await refreshFromBrreg(initial.orgnr)) ?? initial;
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

      if (Object.keys(patch).length > 0 && !dryRun) {
        patch.updated_at = new Date().toISOString();
        const supabase = createServiceClient();
        const { error } = await supabase
          .from("companies")
          .update(patch)
          .eq("orgnr", company.orgnr);
        if (error) throw new Error(error.message);
      }

      progress.done.push(company.orgnr);
      progress.results[company.orgnr] = {
        name: company.name,
        addedPhone: (patch.mobile as string) ?? (patch.phone as string),
        addedEmail: patch.email as string | undefined,
        addedOwner: patch.daglig_leder as string | undefined,
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

  const processed = progress.done.length;
  let stillMissingInShard = 0;
  if (!dryRun) {
    const after = await loadNarvikServering();
    let afterShard = after.filter(needsContact).sort((a, b) => a.orgnr.localeCompare(b.orgnr));
    if (shard !== null) afterShard = sliceShard(afterShard, shard, shards);
    stillMissingInShard = afterShard.filter((c) => !skipCompany(c)).length;
  }

  console.log("\n--- Oppsummering ---");
  console.log(`Behandlet (shard): ${processed}`);
  console.log(`Nye telefon: ${addedPhone}`);
  console.log(`Nye e-post: ${addedEmail}`);
  console.log(`Nye eiere: ${addedOwner}`);
  console.log(`Hoppet over: ${skipped}`);
  console.log(`Feil: ${errors}`);
  if (!dryRun) {
    const after = await loadNarvikServering();
    const stillMissing = after.filter(needsContact).length;
    console.log(`Gjenstår uten telefon eller e-post i shard: ${stillMissingInShard}`);
    console.log(`Gjenstår uten telefon eller e-post (totalt): ${stillMissing}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
