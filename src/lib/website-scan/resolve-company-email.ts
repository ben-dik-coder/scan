import { isGenericEmail, isPersonalEmail } from "@/lib/brreg/map-company";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

export type CompanyEmailSource = "brreg" | "facebook" | "instagram";

export type ResolvedCompanyEmail = {
  email: string;
  source: CompanyEmailSource;
  isGeneric: boolean;
  isPersonal: boolean;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const DIRECTORY_EMAIL_DOMAINS = new Set([
  "118.no",
  "180.no",
  "1850.no",
  "1881.no",
  "allabolag.se",
  "bizin.no",
  "brreg.no",
  "daa.no",
  "degulesider.no",
  "eniro.no",
  "eniro.se",
  "firmalene.no",
  "firmanett.no",
  "gulesider.no",
  "hitta.se",
  "kompass.com",
  "proff.no",
  "purehelp.no",
  "regnskapstall.no",
  "roller.no",
  "trustpilot.com",
  "trustpilot.no",
  "yellowpages.com",
  "yelp.com",
  "yelp.no",
]);

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return null;
  const match = trimmed.match(EMAIL_REGEX);
  return match?.[0] ?? null;
}

export function emailDomain(email: string): string {
  return email.split("@")[1]?.replace(/^www\./i, "").toLowerCase() ?? "";
}

export function isDirectoryOwnedEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const domain = emailDomain(normalized);
  return DIRECTORY_EMAIL_DOMAINS.has(domain);
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

function instagramEmailFromScan(scan?: WebsiteScanResult | null): string | null {
  const profile = scan?.instagramProfile;
  if (!profile) return null;

  const direct = normalizeEmail(profile.email);
  if (direct) return direct;

  return parseEmailFromText(profile.biography);
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

  const instagramEmail = instagramEmailFromScan(scan);
  if (instagramEmail) {
    return {
      email: instagramEmail,
      source: "instagram",
      isGeneric: isGenericEmail(instagramEmail),
      isPersonal: isPersonalEmail(instagramEmail),
    };
  }

  return null;
}
