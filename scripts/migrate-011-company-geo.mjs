/**
 * Kjør migrasjon 011 (city + website kolonner).
 * Krever DATABASE_URL i .env.local
 */
import { readFileSync, existsSync } from "fs";
import pg from "pg";

const { Client } = pg;

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

loadEnvLocal();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("❌ DATABASE_URL mangler — kjør SQL manuelt i Supabase SQL Editor:");
  console.error("   supabase/migrations/011_company_city_website.sql");
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/011_company_city_website.sql", "utf8");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("✅ Migrasjon 011 kjørt (city + website)");
} catch (err) {
  console.error("❌", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
