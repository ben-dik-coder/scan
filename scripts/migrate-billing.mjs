/**
 * Kjør abonnements-migrasjon mot Supabase.
 *
 * 1. Supabase → Project Settings → Database
 * 2. Kopier "Connection string" → URI (passord må byttes inn)
 * 3. Legg i .env.local: DATABASE_URL=postgresql://postgres....
 * 4. Kjør: npm run db:billing
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
  Lim inn supabase/SETUP_BILLING.sql i SQL Editor og trykk Run:
  https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new
`);
  process.exit(1);
}

const sql = readFileSync("supabase/SETUP_BILLING.sql", "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("Kobler til Supabase og kjører abonnements-migrasjon…");
  await client.connect();
  await client.query(sql);
  console.log("✅ Ferdig! Kolonnene plan, subscription_status osv. er opprettet.");
  console.log("   Prøv «Aktiver Pro (test)» i appen igjen.");
} catch (err) {
  console.error("❌ Migrasjon feilet:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
