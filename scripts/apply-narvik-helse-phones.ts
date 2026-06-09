/**
 * Researchede telefonnummer for Narvik helse (15 fra UI) — kun verifiserte 1881-treff.
 * Kjør: npx tsx scripts/apply-narvik-helse-phones.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";

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

/** Verifisert på 1881 (leiCode / personside Narvik-region). */
const FINDINGS = [
  {
    orgnr: "918518568",
    name: "LEGE ANITA FOSHAUG",
    mobile: "98603682",
    phone: null as string | null,
    source: "1881-bedrift (foshaug-anita, org 918518568) + 1881-person Ankenes",
  },
  {
    orgnr: "917744947",
    name: "LEGE DINA-IRENE BAKKEHAUG",
    mobile: "95037926",
    phone: null as string | null,
    source: "1881-person Narvik/Ballangen",
  },
] as const;

/** Fjern feilaktig nummer (94827804 = Andreas Tornes, Sandnes — ikke Tornås Narvik). */
const REVOKE_WRONG = [
  {
    orgnr: "923379185",
    name: "ANDREAS TORNÅS LEGETJENESTER",
    reason: "94827804 tilhører Andreas Tornes (Sandnes) på 1881, ikke org 923379185",
  },
] as const;

async function main() {
  loadEnvLocal();
  const supabase = createServiceClient();

  for (const row of REVOKE_WRONG) {
    const { error } = await supabase
      .from("companies")
      .update({
        mobile: null,
        phone: null,
        updated_at: new Date().toISOString(),
      })
      .eq("orgnr", row.orgnr);
    if (error) throw new Error(error.message);
    console.log(`↩ Fjernet telefon: ${row.name} — ${row.reason}`);
  }

  for (const row of FINDINGS) {
    const { error } = await supabase
      .from("companies")
      .update({
        mobile: row.mobile,
        phone: row.phone,
        updated_at: new Date().toISOString(),
      })
      .eq("orgnr", row.orgnr);
    if (error) throw new Error(error.message);
    console.log(`✓ ${row.name} → ${row.mobile} (${row.source})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
