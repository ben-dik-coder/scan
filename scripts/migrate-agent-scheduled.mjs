/**
 * Kjør migrasjon for planlagte agent-meldinger.
 * Krever DATABASE_URL i .env.local
 * Kjør: node scripts/migrate-agent-scheduled.mjs
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
  console.error("❌ DATABASE_URL mangler i .env.local");
  process.exit(1);
}

const sql = readFileSync(
  "supabase/migrations/20260610120000_agent_scheduled_messages.sql",
  "utf8"
);

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("✅ Agent scheduled-migrasjon kjørt OK");
} catch (err) {
  console.error("❌ Migrasjon feilet:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
