import { isGenericEmail, isPersonalEmail } from "@/lib/brreg/map-company";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

export type CompanyEmailSource = "brreg" | "facebook" | "platform";

export type ResolvedCompanyEmail = {
  email: string;
  source: CompanyEmailSource;
  isGeneric: boolean;
  isPersonal: boolean;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return null;
  const match = trimmed.match(EMAIL_REGEX);
  return match?.[0] ?? null;
}

/** Hent første gyldige e-post fra fritekst (f.eks. Facebook intro). */
export function parseEmailFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(EMAIL_REGEX);
  return match ? normalizeEmail(match[0]) : null;
}

function facebookEmailFromScan(scan?: WebsiteScanResult | null): string | null {
  const profile = scan?.facebookProfile;
  if (!profile) return null;

  const direct = normalizeEmail(profile.email);
  if (direct) return direct;

  return parseEmailFromText(profile.intro);
}

type CompanyEmailInput = {
  email?: string | null;
  has_email?: boolean;
};

/**
 * Velg beste e-post for et firma: Brreg først, deretter Facebook-profil fra skann.
 */
export function resolveCompanyEmail(
  company: CompanyEmailInput,
  scan?: WebsiteScanResult | null
): ResolvedCompanyEmail | null {
  const brregEmail = normalizeEmail(company.email);
  if (brregEmail && company.has_email !== false) {
    return {
      email: brregEmail,
      source: "brreg",
      isGeneric: isGenericEmail(brregEmail),
      isPersonal: isPersonalEmail(brregEmail),
    };
  }

  const facebookEmail = facebookEmailFromScan(scan);
  if (facebookEmail) {
    return {
      email: facebookEmail,
      source: "facebook",
      isGeneric: isGenericEmail(facebookEmail),
      isPersonal: isPersonalEmail(facebookEmail),
    };
  }

  const platformEmail = normalizeEmail(scan?.enrichedEmail);
  if (platformEmail) {
    return {
      email: platformEmail,
      source: "platform",
      isGeneric: isGenericEmail(platformEmail),
      isPersonal: isPersonalEmail(platformEmail),
    };
  }

  return null;
}
