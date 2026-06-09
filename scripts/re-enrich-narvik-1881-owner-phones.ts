/**
 * Re-enrichment: Narvik (1806) bygg/servering/handel uten telefon — kun 1881 eiersøk.
 * Kjør: npx tsx scripts/re-enrich-narvik-1881-owner-phones.ts [--dry-run] [--limit N]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import {
  getIndustryCodeOrFilters,
  industryGroupLabel,
} from "../src/lib/constants/industries.ts";
import {
  fetchBrregRolePersons,
  lookup1881PersonContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1806";
const INDUSTRIES = ["bygg", "servering", "handel", "reklame", "frisor"] as const;
const DELAY_MS = 200;

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
  let limit = 0;
  let dryRun = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
  }
  return { limit, dryRun };
}

function hasPhone(c: Pick<Company, "phone" | "mobile">): boolean {
  return Boolean((c.mobile ?? "").trim() || (c.phone ?? "").trim());
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

function industryOrFilters(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of INDUSTRIES) {
    for (const f of getIndustryCodeOrFilters(id) ?? []) {
      if (!seen.has(f)) {
        seen.add(f);
        out.push(f);
      }
    }
  }
  return out;
}

async function loadTargets(): Promise<Company[]> {
  const codeFilters = industryOrFilters();
  if (!codeFilters.length) throw new Error("Ingen bransjefiltre");
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("municipality_code", KOMMUNE)
    .or(codeFilters.join(","))
    .order("orgnr")
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Company[]).filter((c) => !hasPhone(c));
}

async function main() {
  loadEnvLocal();
  const { limit, dryRun } = parseArgs();

  const allMissing = await loadTargets();
  let targets = allMissing;
  if (limit > 0) targets = targets.slice(0, limit);

  console.log(
    `Narvik ${INDUSTRIES.map((i) => industryGroupLabel(i)).join(", ")} uten telefon: ${allMissing.length}`
  );
  console.log(`Prøver: ${targets.length} (1881 eier, delay ${DELAY_MS}ms)${dryRun ? " [dry-run]" : ""}\n`);

  let tried = 0;
  let noOwner = 0;
  let phonesAdded = 0;
  let noHit = 0;
  const successes: { name: string; orgnr: string; owner: string; phone: string }[] = [];
  const errors: { name: string; msg: string }[] = [];

  for (const company of targets) {
    try {
      const roles = await fetchBrregRolePersons(company.orgnr).catch(() => []);
      const owner = roles.find((r) => /innehaver|daglig leder/i.test(r.role));
      if (!owner) {
        noOwner++;
        await sleep(DELAY_MS);
        continue;
      }

      tried++;
      const place = company.city ?? company.municipality_name ?? undefined;
      const hit = await lookup1881PersonContact(
        owner.name,
        company.orgnr,
        place
      ).catch(() => null);

      if (!hit?.phone) {
        noHit++;
        console.log(`· ${company.name} — eier ${owner.name}, ingen 1881-telefon`);
        await sleep(DELAY_MS);
        continue;
      }

      const stored = storePhone(hit.phone);
      const patch: Record<string, string> = {};
      if (stored.mobile) patch.mobile = stored.mobile;
      else if (stored.phone) patch.phone = stored.phone;
      else {
        noHit++;
        console.log(`· ${company.name} — ugyldig nummer ${hit.phone}`);
        await sleep(DELAY_MS);
        continue;
      }

      if (!dryRun) {
        patch.updated_at = new Date().toISOString();
        const supabase = createServiceClient();
        const { error } = await supabase
          .from("companies")
          .update(patch)
          .eq("orgnr", company.orgnr);
        if (error) throw new Error(error.message);
      }

      phonesAdded++;
      const storedVal = patch.mobile ?? patch.phone ?? hit.phone;
      successes.push({
        name: company.name,
        orgnr: company.orgnr,
        owner: owner.name,
        phone: storedVal,
      });
      console.log(`✓ ${company.name} — ${owner.name} → ${storedVal}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ name: company.name, msg });
      console.error(`✗ ${company.name}: ${msg}`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n--- Oppsummering ---");
  console.log(`Firma uten telefon (målgruppe): ${allMissing.length}`);
  console.log(`Behandlet med eier (1881 forsøkt): ${tried}`);
  console.log(`Uten innehaver/daglig leder: ${noOwner}`);
  console.log(`Telefon lagt inn: ${phonesAdded}`);
  console.log(`Eier funnet, ingen treff: ${noHit}`);
  console.log(`Feil: ${errors.length}`);

  if (successes.length) {
    console.log("\nEksempler (inntil 15):");
    for (const s of successes.slice(0, 15)) {
      console.log(`  ${s.name} (${s.orgnr}) — ${s.owner} → ${s.phone}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
