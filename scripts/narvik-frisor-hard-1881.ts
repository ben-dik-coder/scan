/**
 * Ekstra 1881-forsøk for vanskelige Narvik-frisører (flere stedsnavn + bedrift).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import {
  fetchBrregRolePersons,
  lookup1881Contact,
  lookup1881PersonContact,
  lookupWebsiteContact,
} from "../src/lib/website-scan/lookup-directory-contact.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1806";
const PLACES = ["Narvik", "Ankenes", "Bjerkvik", "Ankenesstranda"];
const DELAY_MS = 250;

/** Delvis navnematch for kjente hard cases */
const EXTRA_QUERIES: Record<string, { owners?: string[]; business?: string[] }> = {
  "931012304": { owners: ["Line Brochs"], business: ["Skog Frisør"] },
  "828683632": {
    owners: ["Silje Jeanette Johansen", "Tony Børge Skarheim"],
    business: ["Narvik Frisør"],
  },
  "835130592": { owners: ["Renée Gundersen"], business: ["Renées Salong"] },
  "920187447": { owners: ["Nelly-Beate Molvik"], business: ["Nelly Hudhelse"] },
  "925483095": { owners: ["Eve Christine Hörnig"], business: ["Unik Hairdesign"] },
  "822726232": { owners: ["Chomphunut Sa-Ngasri"], business: ["Chomphunut Thai Massasje"] },
  "920473873": { owners: ["Fanni Martinsen", "Fanni Földes"], business: ["Fanni Földes"] },
};

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasPhone(c: Pick<Company, "phone" | "mobile">) {
  return Boolean((c.mobile ?? "").trim() || (c.phone ?? "").trim());
}

function storePhone(value: string): { mobile?: string; phone?: string } {
  const core = phoneCoreDigits(value);
  if (!core || core.length !== 8) return {};
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  if (core.startsWith("7") || core.startsWith("2") || core.startsWith("3")) return { phone: core };
  return { mobile: core };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryPerson(name: string, orgnr: string): Promise<string | null> {
  for (const place of PLACES) {
    const hit = await lookup1881PersonContact(name, orgnr, place).catch(() => null);
    if (hit?.phone) return hit.phone;
    await sleep(DELAY_MS);
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const supabase = createServiceClient();
  const orgnrs = Object.keys(EXTRA_QUERIES);
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("municipality_code", KOMMUNE)
    .in("orgnr", orgnrs);
  if (error) throw new Error(error.message);

  let added = 0;
  for (const company of (data ?? []) as Company[]) {
    if (hasPhone(company)) {
      console.log(`↷ ${company.name} — har allerede telefon`);
      continue;
    }
    const extra = EXTRA_QUERIES[company.orgnr];
    let phone: string | null = null;
    let source = "";

    const bizHit = await lookup1881Contact({
      orgnr: company.orgnr,
      name: company.name,
      municipality_name: company.municipality_name,
      city: company.city,
    }).catch(() => null);
    if (bizHit?.phone) {
      phone = bizHit.phone;
      source = "1881-bedrift";
    }
    await sleep(DELAY_MS);

    if (!phone) {
      const webHit = await lookupWebsiteContact({
        orgnr: company.orgnr,
        name: company.name,
        email: company.email,
        website: company.website,
        municipality_name: company.municipality_name,
        city: company.city,
      }).catch(() => null);
      if (webHit?.phone) {
        phone = webHit.phone;
        source = "nettside";
      }
      await sleep(DELAY_MS);
    }

    const roles = await fetchBrregRolePersons(company.orgnr).catch(() => []);
    const owner = roles.find((r) => /innehaver|daglig leder/i.test(r.role));
    const ownerNames = new Set<string>();
    if (owner?.name) ownerNames.add(owner.name);
    for (const n of extra?.owners ?? []) ownerNames.add(n);

    if (!phone) {
      for (const name of ownerNames) {
        phone = await tryPerson(name, company.orgnr);
        if (phone) {
          source = `1881-person ${name}`;
          break;
        }
      }
    }

    if (!phone && extra?.business?.length) {
      for (const bname of extra.business) {
        for (const place of PLACES) {
          const hit = await lookup1881Contact({
            orgnr: company.orgnr,
            name: bname,
            municipality_name: "Narvik",
            city: place,
          }).catch(() => null);
          if (hit?.phone) {
            phone = hit.phone;
            source = `1881-bedrift ${bname} ${place}`;
            break;
          }
          await sleep(DELAY_MS);
        }
        if (phone) break;
      }
    }

    if (!phone) {
      console.log(`· ${company.name} — ingen treff`);
      continue;
    }

    const stored = storePhone(phone);
    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (stored.mobile) patch.mobile = stored.mobile;
    else if (stored.phone) patch.phone = stored.phone;
    else {
      console.log(`· ${company.name} — ugyldig ${phone}`);
      continue;
    }

    const { error: upErr } = await supabase.from("companies").update(patch).eq("orgnr", company.orgnr);
    if (upErr) {
      console.error(`✗ ${company.name}: ${upErr.message}`);
      continue;
    }
    added++;
    console.log(`✓ ${company.name} → ${patch.mobile ?? patch.phone} (${source})`);
  }

  console.log(`\nHard cases: ${added} telefoner lagt inn`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
