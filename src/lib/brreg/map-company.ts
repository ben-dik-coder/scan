import type { BrregEnhet } from "./client";

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

export function isGenericEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local) return false;
  if (GENERIC_LOCAL_PARTS.has(local)) return true;
  if (/^(post|info|kontakt|admin|salg)\d*$/.test(local)) return true;
  return false;
}

export function isPersonalEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local || !local.includes(".")) return false;
  if (isGenericEmail(email)) return false;
  const parts = local.split(".");
  if (parts.length >= 2 && parts.every((p) => p.length >= 2 && /^[a-zæøå]+$/i.test(p))) {
    return true;
  }
  return false;
}

export type CompanyInsert = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  industry_code: string | null;
  registered_at: string | null;
  has_email: boolean;
  email_is_generic: boolean;
  brreg_updated_at: string;
};

export function mapBrregEnhet(enhet: BrregEnhet): CompanyInsert {
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
    industry_code: enhet.naeringskode1?.kode ?? null,
    registered_at: enhet.registreringsdatoEnhetsregisteret ?? null,
    has_email: Boolean(email),
    email_is_generic: email ? isGenericEmail(email) : false,
    brreg_updated_at: new Date().toISOString(),
  };
}
