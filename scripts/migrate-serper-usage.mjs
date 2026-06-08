/**
 * Kjør Serper API-bruk-migrasjon (019) mot Supabase.
 *
 * Krever DATABASE_URL i .env.local (Connection string → URI fra Supabase Dashboard).
 * Kjør: npm run db:serper
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
  console.error(`
❌ DATABASE_URL mangler i .env.local

Slik finner du den:
  1. Gå til https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/settings/database
  2. Under "Connection string" → velg URI
  3. Kopier og bytt [YOUR-PASSWORD] med database-passordet ditt
  4. Lim inn i .env.local:

     DATABASE_URL=postgresql://postgres.umsimryvoifrjmkaelup:PASSORD@...

Alternativ (uten passord i terminal):
  Lim inn supabase/migrations/019_serper_api_usage.sql i SQL Editor og trykk Run:
  https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new
`);
  process.exit(1);
}

const sql = readFileSync(
  "supabase/migrations/019_serper_api_usage.sql",
  "utf8"
);

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("Kobler til Supabase og kjører Serper-migrasjon (019)…");
  await client.connect();
  await client.query(sql);
  console.log("✅ Ferdig! serper_api_calls og increment_serper_usage er opprettet.");
} catch (err) {
  console.error("❌ Migrasjon feilet:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
