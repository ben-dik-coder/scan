/**
 * Fyller inn daglig_leder fra Brreg roller-API for eksisterende rader.
 *
 * Kjør: npm run brreg:backfill-roles
 * Valgfritt: npm run brreg:backfill-roles -- --days 365 --limit 500
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

const BRREG_ROLES_URL =
  "https://data.brreg.no/enhetsregisteret/api/enheter";
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

function formatPersonName(person) {
  if (person?.navn?.trim()) return person.navn.trim();
  const parts = [person?.fornavn, person?.mellomnavn, person?.etternavn]
    .filter(Boolean)
    .join(" ")
    .trim();
  return parts || null;
}

async function fetchDagligLeder(orgnr) {
  const res = await fetch(`${BRREG_ROLES_URL}/${orgnr}/roller`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const groups = data._embedded?.roller ?? [];

  for (const group of groups) {
    const groupCode = group.type?.kode ?? "";
    if (groupCode !== "DAGL" && groupCode !== "LEDE") continue;

    for (const role of group.roller ?? []) {
      const roleCode = role.type?.kode ?? "";
      if (roleCode !== "DAGL" && roleCode !== "LEDE") continue;
      if (role.person) {
        const name = formatPersonName(role.person);
        if (name) return name;
      }
    }
  }

  for (const group of groups) {
    for (const role of group.roller ?? []) {
      if (role.person) {
        const name = formatPersonName(role.person);
        if (name) return name;
      }
    }
  }

  return null;
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

console.log(
  `🔎 Henter firma med e-post uten daglig leder fra ${since} (maks ${limit})…`
);

const { data: rows, error } = await supabase
  .from("companies")
  .select("orgnr, name, daglig_leder")
  .eq("has_email", true)
  .is("daglig_leder", null)
  .gte("registered_at", since)
  .order("registered_at", { ascending: false })
  .limit(limit);

if (error) {
  console.error("❌", error.message);
  process.exit(1);
}

const targets = rows ?? [];
console.log(`📋 ${targets.length.toLocaleString("nb-NO")} firma trenger daglig leder`);

let updated = 0;
let notFound = 0;
let failed = 0;

for (let i = 0; i < targets.length; i++) {
  const row = targets[i];
  try {
    const name = await fetchDagligLeder(row.orgnr);
    await sleep(DELAY_MS);

    if (!name) {
      notFound += 1;
    } else {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ daglig_leder: name })
        .eq("orgnr", row.orgnr);

      if (updateError) {
        console.error(`Update feilet for ${row.orgnr}:`, updateError.message);
        failed += 1;
      } else {
        updated += 1;
      }
    }

    if ((i + 1) % 50 === 0 || i === targets.length - 1) {
      console.log(
        `… ${i + 1}/${targets.length} · ${updated} lagret · ${notFound} uten leder i Brreg`
      );
    }
  } catch {
    failed += 1;
  }
}

console.log(`
✅ Ferdig
   Lagret daglig leder: ${updated.toLocaleString("nb-NO")}
   Ingen leder i Brreg: ${notFound.toLocaleString("nb-NO")}
   Feilet: ${failed.toLocaleString("nb-NO")}
`);
