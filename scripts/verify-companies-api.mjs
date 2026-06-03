/**
 * Verifiserer at prod-miljø bruker Supabase DB for firma.
 * Kjør: npx vercel env run --environment production -- node scripts/verify-companies-api.mjs
 */
import { createClient } from "@supabase/supabase-js";

const mode = (process.env.BRREG_USE_DB ?? "auto").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Mangler Supabase-env");
  process.exit(1);
}

const sb = createClient(url, key);
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();

async function countFiltered({ kommune, days }) {
  let q = sb.from("companies").select("*", { count: "exact", head: true });
  if (kommune) q = q.eq("municipality_code", kommune);
  if (days) q = q.gte("registered_at", daysAgo(days));
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const { count: dbTotal, error } = await sb
  .from("companies")
  .select("*", { count: "exact", head: true });
if (error) throw new Error(error.message);

const useDb =
  mode === "true" ||
  mode === "1" ||
  mode === "yes" ||
  ((mode === "auto" || !["false", "0", "no"].includes(mode)) && (dbTotal ?? 0) >= 10_000);

console.log(JSON.stringify({
  BRREG_USE_DB: process.env.BRREG_USE_DB ?? "(auto)",
  source: useDb ? "db" : "brreg",
  dbCompanyCount: dbTotal,
  filters: {
    oslo_30d: await countFiltered({ kommune: "0301", days: 30 }),
    oslo_alle: await countFiltered({ kommune: "0301", days: 0 }),
    narvik_alle: await countFiltered({ kommune: "1804", days: 0 }),
    hele_norge_alle: await countFiltered({ days: 0 }),
  },
}, null, 2));
