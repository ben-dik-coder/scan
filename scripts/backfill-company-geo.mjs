/**
 * Fyller inn city (poststed) og website (hjemmeside) fra Brreg for eksisterende rader.
 * Kjør: node scripts/backfill-company-geo.mjs
 * Valgfritt: --days 180 --limit 5000
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api";
const BATCH_SIZE = 100;
const DELAY_MS = 120;

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const daysIdx = process.argv.indexOf("--days");
  const limitIdx = process.argv.indexOf("--limit");
  return {
    days: daysIdx >= 0 ? Number(process.argv[daysIdx + 1]) : 365,
    limit: limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : 10_000,
  };
}

function mapGeoFromEnhet(enhet) {
  const address = enhet?.forretningsadresse ?? enhet?.postadresse;
  return {
    municipality_code: address?.kommunenummer ?? null,
    municipality_name: address?.kommune ?? null,
    city: address?.poststed?.trim() || null,
    website: enhet?.hjemmeside?.trim() || null,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

loadEnvLocal();

const { days, limit } = parseArgs();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("❌ Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

console.log(`🔎 Henter firma med e-post fra ${since} (maks ${limit})…`);

const { data: rows, error } = await supabase
  .from("companies")
  .select("orgnr, city, website, municipality_code, municipality_name")
  .eq("has_email", true)
  .gte("registered_at", since)
  .or("city.is.null,website.is.null,municipality_name.is.null")
  .order("registered_at", { ascending: false })
  .limit(limit);

if (error) {
  console.error("❌", error.message);
  process.exit(1);
}

const targets = rows ?? [];
console.log(`📋 ${targets.length.toLocaleString("nb-NO")} firma trenger geo/hjemmeside`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE);
  const updates = [];

  for (const row of batch) {
    try {
      const res = await fetch(`${BRREG_BASE}/enheter/${row.orgnr}`);
      if (!res.ok) {
        failed += 1;
        continue;
      }
      const enhet = await res.json();
      const geo = mapGeoFromEnhet(enhet);
      const patch = {};

      if (!row.city && geo.city) patch.city = geo.city;
      if (!row.website && geo.website) patch.website = geo.website;
      if (!row.municipality_name && geo.municipality_name) {
        patch.municipality_name = geo.municipality_name;
        patch.municipality_code = geo.municipality_code;
      }

      if (Object.keys(patch).length === 0) {
        skipped += 1;
      } else {
        updates.push({ orgnr: row.orgnr, ...patch, brreg_updated_at: new Date().toISOString() });
      }
      await sleep(DELAY_MS);
    } catch {
      failed += 1;
    }
  }

  for (const { orgnr, ...patch } of updates) {
    const { error: updateError } = await supabase
      .from("companies")
      .update(patch)
      .eq("orgnr", orgnr);
    if (updateError) {
      console.error(`Update feilet for ${orgnr}:`, updateError.message);
      failed += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    `… ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length} behandlet · ${updated} oppdatert`
  );
}

console.log(`
✅ Ferdig
   Oppdatert: ${updated.toLocaleString("nb-NO")}
   Hoppet over (ingen nye felt): ${skipped.toLocaleString("nb-NO")}
   Feilet: ${failed.toLocaleString("nb-NO")}
`);
