/**
 * One-time restore: re-apply addedEmail/addedPhone from enrich progress logs
 * when Brreg refresh wiped them. Dry-run by default.
 *
 * Kjør: npx tsx scripts/restore-contacts-from-enrich-progress.ts
 *       npx tsx scripts/restore-contacts-from-enrich-progress.ts --apply
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { isGenericEmail } from "../src/lib/brreg/map-company.ts";
import { phoneCoreDigits } from "../src/lib/website-scan/phone-plausible.ts";
import type { Company } from "../src/types/database.ts";

type Progress = {
  results?: Record<
    string,
    {
      addedEmail?: string;
      addedPhone?: string;
    }
  >;
};

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

function storePhone(value: string): { mobile?: string; phone?: string } {
  const core = phoneCoreDigits(value);
  if (!core || core.length !== 8) return {};
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  if (core.startsWith("7") || core.startsWith("2") || core.startsWith("3")) {
    return { phone: core };
  }
  return { mobile: core };
}

function collectFromProgress(cacheDir: string) {
  const contacts = new Map<string, { email?: string; phone?: string }>();
  for (const file of readdirSync(cacheDir)) {
    if (!file.includes("enrich-progress") || !file.endsWith(".json")) continue;
    let progress: Progress;
    try {
      progress = JSON.parse(readFileSync(resolve(cacheDir, file), "utf8")) as Progress;
    } catch {
      continue;
    }
    for (const [orgnr, row] of Object.entries(progress.results ?? {})) {
      const email = (row.addedEmail ?? "").trim();
      const phone = (row.addedPhone ?? "").trim();
      if (!email && !phone) continue;
      const prev = contacts.get(orgnr) ?? {};
      contacts.set(orgnr, {
        email: email || prev.email,
        phone: phone || prev.phone,
      });
    }
  }
  return contacts;
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");
  const cacheDir = resolve(process.cwd(), "scripts/.cache");
  const contacts = collectFromProgress(cacheDir);
  const supabase = createServiceClient();

  let restoredEmail = 0;
  let restoredPhone = 0;

  for (const [orgnr, saved] of contacts) {
    const { data } = await supabase
      .from("companies")
      .select("orgnr, name, email, phone, mobile")
      .eq("orgnr", orgnr)
      .maybeSingle();
    if (!data) continue;

    const company = data as Company;
    const patch: Record<string, string | boolean> = {};
    const hasEmail = Boolean((company.email ?? "").trim());
    const hasPhone = Boolean(
      (company.phone ?? "").trim() || (company.mobile ?? "").trim()
    );

    if (saved.email && !hasEmail) {
      patch.email = saved.email;
      patch.has_email = true;
      patch.email_is_generic = isGenericEmail(saved.email);
      restoredEmail++;
      console.log(`e-post ${orgnr} ${company.name}: ${saved.email}`);
    }

    if (saved.phone && !hasPhone) {
      Object.assign(patch, storePhone(saved.phone));
      if (patch.mobile || patch.phone) {
        restoredPhone++;
        console.log(`telefon ${orgnr} ${company.name}: ${saved.phone}`);
      }
    }

    if (Object.keys(patch).length > 0 && apply) {
      await supabase.from("companies").update(patch).eq("orgnr", orgnr);
    }
  }

  console.log(
    `\n${apply ? "Gjenopprettet" : "Ville gjenopprette"}: ${restoredEmail} e-post, ${restoredPhone} telefon (${contacts.size} orgnr i logger)`
  );
  if (!apply) console.log("Kjør med --apply for å skrive til DB.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
