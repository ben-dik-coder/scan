/**
 * Importerer hele Enhetsregisteret fra Brreg bulk-nedlasting til Supabase.
 *
 * 1. Legg SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL i .env.local
 * 2. Kjør: npm run brreg:bulk-import
 *    (valgfritt: npm run brreg:bulk-import -- --file ./enheter_alle.json.gz)
 *
 * Krever nok RAM (~3 GB) og disk (~400 MB). Kjør på egen maskin, ikke Vercel.
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { createReadStream, existsSync, readFileSync } from "fs";
import { pipeline } from "stream/promises";
import { Writable } from "stream";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BRREG_BULK_URL =
  "https://data.brreg.no/enhetsregisteret/api/enheter/lastned";
const BATCH_SIZE = 500;
const LOG_EVERY = 10_000;

const GENERIC_LOCAL_PARTS = new Set([
  "post",
  "info",
  "kontakt",
  "firmapost",
  "admin",
  "support",
  "salg",
  "mail",
  "office",
  "hei",
  "service",
  "booking",
  "bestilling",
]);

function isGenericEmail(email) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local) return false;
  if (GENERIC_LOCAL_PARTS.has(local)) return true;
  if (/^(post|info|kontakt|admin|salg)\d*$/.test(local)) return true;
  return false;
}

function mapEnhet(enhet) {
  const email = enhet.epostadresse?.trim() || null;
  const address = enhet.forretningsadresse ?? enhet.postadresse;
  return {
    orgnr: enhet.organisasjonsnummer,
    name: enhet.navn,
    email,
    phone: enhet.telefon?.trim() || null,
    mobile: enhet.mobil?.trim() || null,
    municipality_code: address?.kommunenummer ?? null,
    municipality_name: address?.kommune ?? null,
    city: address?.poststed?.trim() || null,
    website: enhet.hjemmeside?.trim() || null,
    industry_code: enhet.naeringskode1?.kode ?? null,
    registered_at: enhet.registreringsdatoEnhetsregisteret ?? null,
    has_email: Boolean(email),
    email_is_generic: email ? isGenericEmail(email) : false,
    brreg_updated_at: new Date().toISOString(),
  };
}

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("❌ Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function downloadBulk(targetPath) {
  console.log("⬇️  Laster ned fra Brreg (ca. 200 MB gzip)...");
  const res = await fetch(BRREG_BULK_URL);
  if (!res.ok) throw new Error(`Nedlasting feilet: ${res.status}`);
  await pipeline(res.body, createWriteStream(targetPath));
  console.log(`✅ Lagret: ${targetPath}`);
}

async function upsertBatch(rows) {
  const { error } = await supabase.from("companies").upsert(rows, {
    onConflict: "orgnr",
  });
  if (error) throw new Error(error.message);
}

/**
 * Parser JSON-array fra gzip uten å laste hele filen i minnet.
 * Forventer Brreg-format: [ { ... }, { ... }, ... ]
 */
async function importFromGzip(gzipPath) {
  let current = "";
  let inString = false;
  let escape = false;
  let depth = 0;
  let processed = 0;
  let upserted = 0;
  let batch = [];
  let started = false;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    await upsertBatch(batch);
    upserted += batch.length;
    batch = [];
  };

  const handleChar = async (ch) => {
    if (!started) {
      if (ch === "[") started = true;
      return;
    }

    if (depth === 0) {
      if (ch === "{") {
        depth = 1;
        current = "{";
        inString = false;
        escape = false;
      }
      return;
    }

    current += ch;

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      return;
    }

    if (ch === '"') {
      inString = true;
      return;
    }
    if (ch === "{") {
      depth += 1;
      return;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const enhet = JSON.parse(current);
          if (enhet?.organisasjonsnummer && enhet?.navn) {
            batch.push(mapEnhet(enhet));
            processed += 1;
            if (batch.length >= BATCH_SIZE) {
              await flushBatch();
            }
            if (processed % LOG_EVERY === 0) {
              console.log(`… ${processed.toLocaleString("nb-NO")} enheter behandlet`);
            }
          }
        } catch (err) {
          console.warn("Hoppet over ugyldig objekt:", err.message);
        }
        current = "";
      }
    }
  };

  const parser = new Writable({
    async write(chunk, _enc, cb) {
      try {
        const text = chunk.toString("utf8");
        for (let i = 0; i < text.length; i++) {
          await handleChar(text[i]);
        }
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });

  await pipeline(createReadStream(gzipPath), createGunzip(), parser);
  await flushBatch();

  await supabase.from("sync_state").upsert(
    {
      key: "brreg_enheter",
      last_sync: new Date().toISOString(),
      metadata: {
        mode: "bulk_import",
        processed,
        upserted,
      },
    },
    { onConflict: "key" }
  );

  return { processed, upserted };
}

async function main() {
  const fileArg = process.argv.indexOf("--file");
  let gzipPath =
    fileArg >= 0 ? process.argv[fileArg + 1] : join(tmpdir(), "enheter_alle.json.gz");

  if (!gzipPath) {
    console.error("Bruk: npm run brreg:bulk-import -- --file ./enheter_alle.json.gz");
    process.exit(1);
  }

  if (!existsSync(gzipPath)) {
    await downloadBulk(gzipPath);
  } else {
    console.log(`📂 Bruker eksisterende fil: ${gzipPath}`);
  }

  console.log("📥 Importerer til Supabase (kan ta 30–90 min)...");
  const started = Date.now();
  const { processed, upserted } = await importFromGzip(gzipPath);
  const mins = ((Date.now() - started) / 60_000).toFixed(1);

  console.log(`
✅ Ferdig på ${mins} min
   Behandlet: ${processed.toLocaleString("nb-NO")}
   Lagret:    ${upserted.toLocaleString("nb-NO")}

Neste steg:
  1. Sett BRREG_USE_DB=true i Vercel (eller la auto slå på ved ≥10 000 rader)
  2. Deploy appen
  3. Sett cron på POST /api/sync/brreg for daglige oppdateringer
`);
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
