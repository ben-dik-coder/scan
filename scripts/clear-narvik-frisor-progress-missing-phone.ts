/**
 * Fjern orgnr uten telefon fra frisør shard-progress slik at enrich kjører på nytt.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { getIndustryCodeOrFilters } from "../src/lib/constants/industries.ts";

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

function hasPhone(c: { phone?: string | null; mobile?: string | null }) {
  return Boolean((c.mobile ?? "").trim() || (c.phone ?? "").trim());
}

async function main() {
  loadEnvLocal();
  const supabase = createServiceClient();
  const filters = getIndustryCodeOrFilters("frisor") ?? [];
  const { data, error } = await supabase
    .from("companies")
    .select("orgnr,phone,mobile")
    .eq("municipality_code", "1806")
    .or(filters.join(","));
  if (error) throw new Error(error.message);
  const missingSet = new Set(
    (data ?? []).filter((c) => !hasPhone(c)).map((c) => c.orgnr)
  );
  console.log(`Uten telefon (må fjernes fra cache): ${missingSet.size}`);

  const cacheDir = resolve(process.cwd(), "scripts/.cache");
  for (let shard = 0; shard < 3; shard++) {
    const path = resolve(cacheDir, `narvik-frisor-enrich-progress-shard-${shard}.json`);
    if (!existsSync(path)) continue;
    const progress = JSON.parse(readFileSync(path, "utf8")) as {
      done: string[];
      results: Record<string, unknown>;
    };
    const before = progress.done.length;
    progress.done = progress.done.filter((o) => !missingSet.has(o));
    const removed = before - progress.done.length;
    writeFileSync(path, JSON.stringify(progress, null, 2));
    console.log(`Shard ${shard}: fjernet ${removed} fra done (${progress.done.length} igjen)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
