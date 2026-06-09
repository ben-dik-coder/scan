/**
 * Rask Bodø eiendom-enrichment: Brreg roller → Brreg kontakt → 1881/Gulesider → DDG Maps.
 * Ingen full nettside-scan. E-post hoppes ALDRI over.
 *
 * Kjør: npx tsx scripts/enrich-bodo-eiendom-fast.ts
 *      npx tsx scripts/enrich-bodo-eiendom-fast.ts --phase owners|brreg|contacts|maps
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { isGenericEmail } from "../src/lib/brreg/map-company.ts";
import { getIndustryCodeOrFilters, industryGroupLabel } from "../src/lib/constants/industries.ts";
import { discoverFromDuckDuckGoMaps } from "../src/lib/website-scan/duckduckgo-places.ts";
import {
  fetchBrregRolePersons,
  lookup1881Contact,
  lookup1881PersonContact,
  lookupGulesiderContact,
  lookupGulesiderPersonContact,
  type DirectoryContactHit,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1804";
const INDUSTRY = "eiendom";
const MAX_RUNTIME_MS = 60 * 60 * 1000;
const CONCURRENCY_OWNERS = 50;
const CONCURRENCY_BRREG = 40;
const CONCURRENCY_CONTACTS = 32;
const CONCURRENCY_MAPS = 15;
const PROGRESS_FILE = resolve(process.cwd(), "scripts/.cache/bodo-eiendom-fast-progress.json");

type Phase = "all" | "owners" | "brreg" | "contacts" | "maps";

type Progress = {
  owners: string[];
  brreg: string[];
  contacts: string[];
  maps: string[];
  results: Record<string, { name: string; note?: string; error?: string }>;
};

type ShardResult = {
  name?: string;
  addedOwner?: string;
  source?: string;
};

let startedAt = 0;

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
      if (p === "owners" || p === "brreg" || p === "contacts" || p === "maps" || p === "all") {
        phase = p;
      }
    } else if (args[i] === "--dry-run") dryRun = true;
  }
  return { phase, dryRun };
}

function elapsedMs(): number {
  return Date.now() - startedAt;
}

function timeLeftMs(): number {
  return Math.max(0, MAX_RUNTIME_MS - elapsedMs());
}

function shouldStop(): boolean {
  return elapsedMs() >= MAX_RUNTIME_MS;
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}:${String(rem).padStart(2, "0")}`;
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_FILE)) {
    return { owners: [], brreg: [], contacts: [], maps: [], results: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf8")) as Progress;
    if (!raw.owners) raw.owners = [];
    if (!raw.brreg) raw.brreg = [];
    if (!raw.contacts) raw.contacts = [];
    if (!raw.maps) raw.maps = [];
    if (!raw.results) raw.results = {};
    return raw;
  } catch {
    return { owners: [], brreg: [], contacts: [], maps: [], results: {} };
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

function reconcileOwnersDone(companies: Company[], progress: Progress) {
  for (const c of companies) {
    if ((c.daglig_leder ?? "").trim() && !progress.owners.includes(c.orgnr)) {
      progress.owners.push(c.orgnr);
    }
  }
}

function reconcileContactsDone(companies: Company[], progress: Progress) {
  const byOrgnr = new Map(companies.map((c) => [c.orgnr, c]));
  progress.contacts = progress.contacts.filter((orgnr) => {
    const c = byOrgnr.get(orgnr);
    if (!c) return true;
    return hasPhone(c) && hasEmail(c);
  });
}

function migrateShardProgress(companies: Company[], progress: Progress): number {
  const cacheDir = resolve(process.cwd(), "scripts/.cache");
  const byOrgnr = new Map(companies.map((c) => [c.orgnr, c]));
  let migrated = 0;

  const shardFiles = readdirSync(cacheDir).filter((f) =>
    /^bodo-eiendom-enrich-progress-shard-\d+\.json$/.test(f)
  );

  for (const file of shardFiles) {
    try {
      const raw = JSON.parse(readFileSync(resolve(cacheDir, file), "utf8")) as {
        done?: string[];
        results?: Record<string, ShardResult>;
      };
      for (const orgnr of raw.done ?? []) {
        const c = byOrgnr.get(orgnr);
        const result = raw.results?.[orgnr];

        if (!progress.brreg.includes(orgnr)) progress.brreg.push(orgnr);
        if (!progress.contacts.includes(orgnr)) progress.contacts.push(orgnr);

        const hasOwner =
          Boolean((c?.daglig_leder ?? "").trim()) || Boolean(result?.addedOwner?.trim());
        if (hasOwner && !progress.owners.includes(orgnr)) {
          progress.owners.push(orgnr);
        }

        if (result?.name && !progress.results[orgnr]) {
          progress.results[orgnr] = {
            name: result.name,
            note: result.source ?? "migrert fra shard",
          };
        }

        migrated++;
      }
    } catch {
      /* ignore broken shard file */
    }
  }

  return migrated;
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
): Promise<{ processed: number; stopped: boolean }> {
  let next = 0;
  let processed = 0;
  let stopped = false;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      if (shouldStop()) {
        stopped = true;
        return;
      }
      const i = next++;
      await fn(items[i], i);
      processed++;
    }
  });
  await Promise.all(workers);
  return { processed, stopped: stopped || shouldStop() };
}

async function loadCompanies(): Promise<Company[]> {
  const supabase = createServiceClient();
  const codes = getIndustryCodeOrFilters(INDUSTRY) ?? [];
  const pageSize = 1000;
  const rows: Company[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("municipality_code", KOMMUNE)
      .or(codes.join(","))
      .order("orgnr")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Company[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function refreshContactFromBrreg(
  company: Company,
  dryRun: boolean
): Promise<{ addedPhone: boolean; addedEmail: boolean; note: string }> {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${company.orgnr}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return { addedPhone: false, addedEmail: false, note: "Brreg 404" };

  const enhet = (await res.json()) as {
    epostadresse?: string;
    telefon?: string;
    mobil?: string;
  };

  const patch: Record<string, string | boolean> = {
    updated_at: new Date().toISOString(),
    brreg_updated_at: new Date().toISOString(),
  };
  const notes: string[] = [];
  let addedPhone = false;
  let addedEmail = false;

  const brregPhone = (enhet.mobil ?? enhet.telefon ?? "").trim();
  if (brregPhone && !hasPhone(company)) {
    const stored = storePhone(brregPhone);
    if (stored.mobile) {
      patch.mobile = stored.mobile;
      addedPhone = true;
      notes.push(`telefon ${brregPhone} (Brreg)`);
    } else if (stored.phone) {
      patch.phone = stored.phone;
      addedPhone = true;
      notes.push(`telefon ${brregPhone} (Brreg)`);
    }
  }

  const brregEmail = (enhet.epostadresse ?? "").trim();
  if (brregEmail && !hasEmail(company)) {
    patch.email = brregEmail;
    patch.has_email = true;
    patch.email_is_generic = isGenericEmail(brregEmail);
    addedEmail = true;
    notes.push(`e-post ${brregEmail} (Brreg)`);
  }

  if (notes.length > 0 && !dryRun) {
    const supabase = createServiceClient();
    await supabase.from("companies").update(patch).eq("orgnr", company.orgnr);
  }

  return {
    addedPhone,
    addedEmail,
    note: notes.length ? notes.join(" | ") : "ingen kontakt i Brreg",
  };
}

async function phaseOwners(companies: Company[], progress: Progress, dryRun: boolean) {
  const targets = companies.filter(
    (c) => !skipCompany(c) && !(c.daglig_leder ?? "").trim() && !progress.owners.includes(c.orgnr)
  );
  console.log(`\n=== Fase 1: Daglig leder (Brreg) — ${targets.length} firma ===`);
  console.log(`Tid igjen: ${formatTime(timeLeftMs())}\n`);
  let added = 0;

  const { stopped } = await mapPool(targets, CONCURRENCY_OWNERS, async (company) => {
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

  console.log(`\nDaglig leder: ${added} nye${stopped ? " (stoppet — tidsfrist)" : ""}`);
  return stopped;
}

async function phaseBrreg(companies: Company[], progress: Progress, dryRun: boolean) {
  const targets = companies.filter(
    (c) => !skipCompany(c) && needsContact(c) && !progress.brreg.includes(c.orgnr)
  );
  console.log(`\n=== Fase 2: Brreg kontakt-refresh — ${targets.length} firma ===`);
  console.log(`Tid igjen: ${formatTime(timeLeftMs())}\n`);
  let addedPhone = 0;
  let addedEmail = 0;

  const { stopped } = await mapPool(targets, CONCURRENCY_BRREG, async (company) => {
    try {
      const { addedPhone: p, addedEmail: e, note } = await refreshContactFromBrreg(company, dryRun);
      progress.brreg.push(company.orgnr);
      if (p) addedPhone++;
      if (e) addedEmail++;
      progress.results[company.orgnr] = { name: company.name, note };
      console.log(`${p || e ? "✓" : "·"} ${company.name} — ${note}`);
      saveProgress(progress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.brreg.push(company.orgnr);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      saveProgress(progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }
  });

  console.log(
    `\nBrreg: ${addedPhone} telefon · ${addedEmail} e-post${stopped ? " (stoppet — tidsfrist)" : ""}`
  );
  return stopped;
}

async function phaseContacts(companies: Company[], progress: Progress, dryRun: boolean) {
  reconcileContactsDone(companies, progress);
  const targets = companies.filter(
    (c) => !skipCompany(c) && needsContact(c) && !progress.contacts.includes(c.orgnr)
  );
  console.log(`\n=== Fase 3: Telefon + e-post (1881/Gulesider) — ${targets.length} firma ===`);
  console.log(`Tid igjen: ${formatTime(timeLeftMs())}\n`);
  let addedPhone = 0;
  let addedEmail = 0;

  const { stopped } = await mapPool(targets, CONCURRENCY_CONTACTS, async (company) => {
    try {
      const needsPhone = !hasPhone(company);
      const needsEmail = !hasEmail(company);

      const from1881 = await lookup1881Contact(company).catch(() => null);
      const needGulesider =
        (needsPhone && !from1881?.phone) || (needsEmail && !from1881?.email);
      const fromGulesider = needGulesider
        ? await lookupGulesiderContact(company).catch(() => null)
        : null;

      let { phone, email, source } = mergeContacts(from1881, fromGulesider);

      if ((needsPhone && !phone) || (needsEmail && !email)) {
        const ownerName = (company.daglig_leder ?? "").trim();
        if (ownerName) {
          const place = company.city ?? company.municipality_name;
          const [from1881Person, fromGsPerson] = await Promise.all([
            lookup1881PersonContact(ownerName, company.orgnr, place).catch(() => null),
            lookupGulesiderPersonContact(ownerName, company.orgnr, place).catch(() => null),
          ]);
          const person = mergeContacts(from1881Person, fromGsPerson);
          if (needsPhone && !phone && person.phone) {
            phone = person.phone;
            source = person.source;
          }
          if (needsEmail && !email && person.email) {
            email = person.email;
          }
        }
      }

      const notes: string[] = [];
      const patch: Record<string, string | boolean> = {
        updated_at: new Date().toISOString(),
      };

      if (phone && needsPhone) {
        const stored = storePhone(phone);
        if (stored.mobile) patch.mobile = stored.mobile;
        else if (stored.phone) patch.phone = stored.phone;
        if (stored.mobile || stored.phone) {
          addedPhone++;
          notes.push(`telefon ${phone} (${source})`);
        }
      }

      if (email && needsEmail) {
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

  console.log(
    `\n1881/Gulesider: ${addedPhone} telefon · ${addedEmail} e-post${stopped ? " (stoppet — tidsfrist)" : ""}`
  );
  return stopped;
}

async function phaseMaps(companies: Company[], progress: Progress, dryRun: boolean) {
  const targets = companies.filter(
    (c) => !skipCompany(c) && !hasPhone(c) && !progress.maps.includes(c.orgnr)
  );
  console.log(`\n=== Fase 4: DDG Google Maps (kun telefon) — ${targets.length} firma ===`);
  console.log(`Tid igjen: ${formatTime(timeLeftMs())}\n`);
  let addedPhone = 0;

  const { stopped } = await mapPool(targets, CONCURRENCY_MAPS, async (company) => {
    try {
      const discovery = await discoverFromDuckDuckGoMaps(company).catch(() => null);
      const phone = discovery?.phone?.trim() ?? "";
      const notes: string[] = [];
      const patch: Record<string, string> = {
        updated_at: new Date().toISOString(),
      };

      if (phone && !hasPhone(company)) {
        const stored = storePhone(phone);
        if (stored.mobile) patch.mobile = stored.mobile;
        else if (stored.phone) patch.phone = stored.phone;
        if (stored.mobile || stored.phone) {
          addedPhone++;
          notes.push(`telefon ${phone} (DDG Maps)`);
        }
      }

      progress.maps.push(company.orgnr);

      if (notes.length > 0 && !dryRun) {
        const supabase = createServiceClient();
        await supabase.from("companies").update(patch).eq("orgnr", company.orgnr);
        progress.results[company.orgnr] = { name: company.name, note: notes.join(" | ") };
        console.log(`✓ ${company.name} → ${notes.join(" | ")}`);
      } else {
        progress.results[company.orgnr] = {
          name: company.name,
          note: notes.length ? notes.join(" | ") : "ingen telefon i Maps",
        };
        console.log(`· ${company.name} — ${notes.length ? notes.join(" | ") : "ingen telefon"}`);
      }
      saveProgress(progress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.maps.push(company.orgnr);
      progress.results[company.orgnr] = { name: company.name, error: msg };
      saveProgress(progress);
      console.error(`✗ ${company.name}: ${msg}`);
    }
  });

  console.log(`\nDDG Maps: ${addedPhone} telefon${stopped ? " (stoppet — tidsfrist)" : ""}`);
  return stopped;
}

function printStats(companies: Company[]) {
  const withPhone = companies.filter((c) => hasPhone(c)).length;
  const withEmail = companies.filter((c) => hasEmail(c)).length;
  const withOwner = companies.filter((c) => (c.daglig_leder ?? "").trim()).length;
  console.log(
    `\nStatus: ${companies.length} firma · telefon ${withPhone} · e-post ${withEmail} · daglig leder ${withOwner}`
  );
}

async function main() {
  loadEnvLocal();
  startedAt = Date.now();
  const { phase, dryRun } = parseArgs();
  const progress = loadProgress();
  let companies = await loadCompanies();

  const migrated = migrateShardProgress(companies, progress);
  reconcileOwnersDone(companies, progress);
  reconcileContactsDone(companies, progress);
  if (migrated > 0) {
    saveProgress(progress);
    console.log(`Migrerte ${migrated} shard-poster til fast-progress`);
  }

  console.log(
    `Bodø ${industryGroupLabel(INDUSTRY)} — rask modus (${companies.length} firma)${dryRun ? " [dry-run]" : ""}`
  );
  console.log(`Tidsbudsjett: 60 min · Fase: ${phase}`);
  printStats(companies);

  let stopped = false;

  if (!stopped && (phase === "all" || phase === "owners")) {
    stopped = await phaseOwners(companies, progress, dryRun);
  }
  if (!stopped && (phase === "all" || phase === "brreg")) {
    companies = await loadCompanies();
    stopped = await phaseBrreg(companies, progress, dryRun);
  }
  if (!stopped && (phase === "all" || phase === "contacts")) {
    companies = await loadCompanies();
    stopped = await phaseContacts(companies, progress, dryRun);
  }
  if (!stopped && (phase === "all" || phase === "maps")) {
    companies = await loadCompanies();
    if (timeLeftMs() > 60_000) {
      stopped = await phaseMaps(companies, progress, dryRun);
    } else {
      console.log("\n=== Fase 4: DDG Maps hoppet over (< 1 min igjen) ===");
    }
  }

  companies = await loadCompanies();
  console.log(`\nKjøretid: ${formatTime(elapsedMs())}${stopped ? " — stoppet ved tidsfrist" : ""}`);
  printStats(companies);
  console.log("\nFerdig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
