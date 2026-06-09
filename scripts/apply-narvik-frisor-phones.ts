/**
 * Legg inn researchede telefonnummer for Narvik-frisører uten Brreg-telefon.
 * Kjør: npx tsx scripts/apply-narvik-frisor-phones.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { upsertBrregEnhet } from "../src/lib/brreg/upsert-enhet.ts";

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

const FINDINGS = [
  {
    orgnr: "929350626",
    name: "FRISØR LIAN",
    owner_name: "Sofie-Helene Lian",
    mobile: "93066620",
    phone: null,
    source: "1881",
    notes: "Mobil frisør hjemme hos Sofie-Helene Lian, Skjomen",
  },
  {
    orgnr: "920240178",
    name: "MARIA FRISØR AS",
    owner_name: "Maria Esther Sarmentero Barrul",
    mobile: null,
    phone: "76944500",
    source: "1881",
    notes: "Glamour Hairstyle, Kongens gate 52 Narvik",
  },
  {
    orgnr: "933072657",
    name: "QAHRHOM FRISØR AS",
    owner_name: "Hasan Said",
    mobile: "97030000",
    phone: null,
    source: "1881",
    notes: "Frydenlundgata 15 Narvik",
  },
  {
    orgnr: "923655247",
    name: "SAX FRISØR V/INGRID JACOBSEN",
    owner_name: "Ingrid Bille Jacobsen",
    mobile: "47517043",
    phone: null,
    source: "1881",
    notes: "Sentrumsveien 65 Ballangen",
  },
  {
    orgnr: "970356142",
    name: "SVEIS FRISØRSALONG Runa Steen",
    owner_name: "Runa Steen",
    mobile: null,
    phone: "75774555",
    source: "1881",
    notes: "Kleivaveien 3 Kjøpsvik",
  },
] as const;

const NOT_FOUND = [
  {
    orgnr: "931012304",
    name: "SKOG FRISØR",
    owner_name: "Line Brochs",
    notes:
      "1881 har listing (Ballblomstien 4) men «Telefonnummer mangler». Ingen FB/Instagram/nettside funnet.",
  },
  {
    orgnr: "835130592",
    name: "RENÉES SALONG AS",
    owner_name: "Renée Jenssen Gundersen",
    notes:
      "Hjemmeadresse Nordmoveien 187 Bjerkvik. Ikke i 1881-frisørlisten. Ingen offentlig telefon eller sosiale medier.",
  },
  {
    orgnr: "832462322",
    name: "SAX FRISØR KRISTIANSEN",
    owner_name: "Mariell Celin Kristiansen",
    notes:
      "Samme adresse som Sax/Ingrid (Sentrumsveien 65), men kun Ingrid har 1881-listing. Bodø-nummer 45231343 er ikke verifisert som samme person.",
  },
  {
    orgnr: "828683632",
    name: "NARVIK FRISØR AS",
    owner_name: "Silje Jeanette Johansen / Tony Børge Skarheim",
    notes: "Konkurs 16. feb 2026 — ingen aktiv telefon.",
  },
  {
    orgnr: "925483095",
    name: "UNIK HAIRDESIGN EVE C. HÖRNIG",
    owner_name: "Eve Christine Hörnig",
    notes:
      "Ankenesveien 47 (c/o Kristian Lindgren). Ikke i 1881-frisørlisten. Ingen offentlig telefon funnet.",
  },
] as const;

async function ensureCompany(orgnr: string) {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Brreg ${orgnr}: ${res.status}`);
  const enhet = await res.json();
  const supabase = createServiceClient();
  await upsertBrregEnhet(enhet, supabase);
}

async function main() {
  loadEnvLocal();

  console.log("Sikrer firmarader i DB…\n");
  const orgnrs = [...FINDINGS.map((r) => r.orgnr), ...NOT_FOUND.map((r) => r.orgnr)];
  for (const orgnr of orgnrs) {
    await ensureCompany(orgnr);
  }

  const supabase = createServiceClient();

  console.log("Legger inn funn med telefon:\n");
  for (const row of FINDINGS) {
    const { error } = await supabase
      .from("companies")
      .update({
        mobile: row.mobile,
        phone: row.phone,
        daglig_leder: row.owner_name,
        updated_at: new Date().toISOString(),
      })
      .eq("orgnr", row.orgnr);
    if (error) throw new Error(`${row.orgnr}: ${error.message}`);
    console.log(`✓ ${row.name} → ${row.mobile ?? row.phone} (${row.owner_name})`);
  }

  console.log("\nUten telefon (research gjort, kun eier lagt inn):\n");
  for (const row of NOT_FOUND) {
    const { error } = await supabase
      .from("companies")
      .update({
        daglig_leder: row.owner_name,
        updated_at: new Date().toISOString(),
      })
      .eq("orgnr", row.orgnr);
    if (error) throw new Error(`${row.orgnr}: ${error.message}`);
    console.log(`✗ ${row.name} — ${row.owner_name}`);
    console.log(`  ${row.notes}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
