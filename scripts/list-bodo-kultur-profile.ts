/**
 * Vis Bodø kultur og underholdning med daglig leder, telefon og e-post.
 * Kjør: npx tsx scripts/list-bodo-kultur-profile.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { getIndustryCodeOrFilters } from "../src/lib/constants/industries.ts";

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

async function main() {
  loadEnvLocal();
  const supabase = createServiceClient();
  const codes = getIndustryCodeOrFilters("kultur") ?? [];
  const { data: companies, error } = await supabase
    .from("companies")
    .select("orgnr,name,phone,mobile,email,daglig_leder,municipality_name")
    .eq("municipality_code", "1804")
    .or(codes.join(","))
    .order("name");

  if (error) throw new Error(error.message);
  const rows = companies ?? [];

  console.log(
    ["orgnr", "navn", "daglig_leder", "telefon", "e-post"].join("\t")
  );
  for (const c of rows) {
    const phone = (c.mobile as string | null) ?? (c.phone as string | null) ?? "";
    console.log(
      [
        c.orgnr,
        c.name,
        c.daglig_leder ?? "",
        phone,
        c.email ?? "",
      ].join("\t")
    );
  }

  const withPhone = rows.filter((c) => (c.mobile ?? c.phone)?.trim()).length;
  const withOwner = rows.filter((c) => (c.daglig_leder ?? "").trim()).length;
  const withEmail = rows.filter((c) => (c.email ?? "").trim()).length;
  console.log(
    `\nTotalt ${rows.length} · telefon ${withPhone} · e-post ${withEmail} · daglig leder ${withOwner}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
