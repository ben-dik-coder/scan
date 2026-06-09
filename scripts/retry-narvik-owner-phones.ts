/**
 * Målrettet eier-telefon via 1881 for Narvik-firma uten nummer.
 * Kjør: npx tsx scripts/retry-narvik-owner-phones.ts [--industry eiendom]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { getIndustryCodeOrFilters } from "../src/lib/constants/industries.ts";
import {
  fetchBrregRolePersons,
  lookup1881PersonContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1806";
const INDUSTRIES = [
  "bygg",
  "servering",
  "handel",
  "reklame",
  "frisor",
  "eiendom",
] as const;
const DELAY_MS = 200;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--industry");
  const only =
    onlyIdx >= 0 && args[onlyIdx + 1] ? args[onlyIdx + 1] : undefined;
  return { only };
}

async function main() {
  loadEnvLocal();
  const { only } = parseArgs();
  const industries = only
    ? INDUSTRIES.filter((id) => id === only)
    : [...INDUSTRIES];
  if (only && industries.length === 0) {
    throw new Error(`Ukjent bransje: ${only}`);
  }

  const supabase = createServiceClient();
  let tried = 0;
  let added = 0;
  const samples: string[] = [];

  for (const industry of industries) {
    const filters = getIndustryCodeOrFilters(industry);
    let q = supabase
      .from("companies")
      .select("orgnr,name,city,municipality_name,mobile,phone")
      .eq("municipality_code", KOMMUNE);
    if (filters.codes?.length) q = q.in("industry_code", filters.codes);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const missing = (data ?? []).filter((c) => !hasPhone(c));
    console.log(`${industry}: ${missing.length} uten telefon`);

    for (const company of missing) {
      const roles = await fetchBrregRolePersons(company.orgnr).catch(() => []);
      const owner = roles.find((r) =>
        /innehaver|daglig leder/i.test(r.role)
      );
      if (!owner) continue;

      tried++;
      const hit = await lookup1881PersonContact(
        owner.name,
        company.orgnr,
        company.city ?? company.municipality_name
      ).catch(() => null);

      if (!hit?.phone) {
        await sleep(DELAY_MS);
        continue;
      }

      const stored = storePhone(hit.phone);
      const patch: Record<string, string> = {
        updated_at: new Date().toISOString(),
      };
      if (stored.mobile) patch.mobile = stored.mobile;
      else if (stored.phone) patch.phone = stored.phone;
      else {
        await sleep(DELAY_MS);
        continue;
      }

      const { error: upErr } = await supabase
        .from("companies")
        .update(patch)
        .eq("orgnr", company.orgnr);
      if (!upErr) {
        added++;
        const label = `${company.name} → ${stored.mobile ?? stored.phone} (${owner.name})`;
        console.log(`✓ ${label}`);
        if (samples.length < 10) samples.push(label);
      }

      await sleep(DELAY_MS);
    }
  }

  console.log("\n--- Oppsummering ---");
  console.log(`Prøvd: ${tried}`);
  console.log(`Lagt inn: ${added}`);
  if (samples.length) {
    console.log("Eksempler:");
    for (const s of samples) console.log(`  ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
