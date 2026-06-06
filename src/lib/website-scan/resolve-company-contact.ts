import { phonePlausibleForCompany } from "./phone-plausible";
import type { WebsiteScanResult } from "./types";
import {
  resolveCompanyEmail,
  type ResolvedCompanyEmail,
} from "./resolve-company-email";

type CompanyContactInput = {
  orgnr?: string;
  email?: string | null;
  has_email?: boolean;
  phone?: string | null;
  mobile?: string | null;
};

export type ResolvedCompanyPhone = {
  phone: string;
  source: "brreg" | "mobile" | "platform";
  platformSource?: string | null;
};

export function normalizeDisplayPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  let core = digits;
  if (core.startsWith("47") && core.length === 10) core = core.slice(2);
  if (core.length !== 8) return value.trim();
  return core.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
}

function plausibleBrregPhone(
  phone: string,
  orgnr: string | undefined
): boolean {
  if (!orgnr?.trim()) return true;
  return phonePlausibleForCompany(phone, orgnr);
}

/** Beste telefon: Brreg først, deretter funn fra booking/katalog/nettside/Facebook. */
export function resolveCompanyPhone(
  company: CompanyContactInput,
  scan?: WebsiteScanResult | null
): ResolvedCompanyPhone | null {
  const orgnr = company.orgnr?.trim() ?? "";

  const mobile = company.mobile?.trim();
  if (mobile && plausibleBrregPhone(mobile, orgnr)) {
    return { phone: normalizeDisplayPhone(mobile), source: "mobile" };
  }

  const phone = company.phone?.trim();
  if (phone && plausibleBrregPhone(phone, orgnr)) {
    return { phone: normalizeDisplayPhone(phone), source: "brreg" };
  }

  if (scan?.enrichedPhone && plausibleBrregPhone(scan.enrichedPhone, orgnr)) {
    return {
      phone: normalizeDisplayPhone(scan.enrichedPhone),
      source: "platform",
      platformSource: scan.enrichedPhoneSource ?? null,
    };
  }

  return null;
}

/** Beste e-post: Brreg, deretter Facebook, deretter plattform-uttrekk. */
export function resolveCompanyContactEmail(
  company: CompanyContactInput,
  scan?: WebsiteScanResult | null
): ResolvedCompanyEmail | null {
  const brreg = resolveCompanyEmail(company, scan);
  if (brreg) return brreg;

  return null;
}
