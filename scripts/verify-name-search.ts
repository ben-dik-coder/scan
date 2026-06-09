/**
 * Verifiser firmanavn-søk (ren logikk, ingen database).
 * Kjør: npx tsx scripts/verify-name-search.ts
 */
import {
  companyNameMatchesQuery,
  normalizeCompanyNameForSearch,
  sanitizeNameQueryForIlike,
} from "../src/lib/brreg/name-search.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FEIL:", message);
    process.exit(1);
  }
}

function main() {
  assert(
    normalizeCompanyNameForSearch("NAILS & BEAUTY AS") === "nails beauty as",
    "normalisering av firmanavn"
  );
  assert(
    normalizeCompanyNameForSearch("Café Øst") === "cafe øst",
    "normalisering av diakritikk"
  );

  assert(sanitizeNameQueryForIlike("a") === null, "for kort søk");
  assert(sanitizeNameQueryForIlike("n%ails") === "nails", "fjerner SQL-wildcards");

  assert(
    companyNameMatchesQuery("Oslo Nails Studio AS", "nails"),
    "enkelt ord matcher"
  );
  assert(
    !companyNameMatchesQuery("Oslo Nails Studio AS", "spa"),
    "ord som ikke finnes"
  );
  assert(
    companyNameMatchesQuery("Beauty Nails Spa AS", "nails spa"),
    "flere ord må alle finnes"
  );
  assert(
    companyNameMatchesQuery("Beauty Nails Spa AS", "n"),
    "enkelt tegn ignoreres"
  );

  console.log("OK: verify-name-search");
}

main();
