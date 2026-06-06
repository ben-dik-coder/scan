import { isGenericEmail, isPersonalEmail } from "@/lib/brreg/map-company";
import {
  companyMatchesProfileName,
  domainSimilarToCompany,
} from "@/lib/website-scan/parse-results";
import { profileMatchesCompany } from "@/lib/website-scan/serpapi-facebook-profile";
import { socialUrlMatchesCompany } from "@/lib/website-scan/social-profiles";
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

/** Offentlige / institusjonelle domener — ikke typisk for små AS/enk. */
const INSTITUTION_DOMAIN_MARKERS = [
  "sykehus",
  "kommune",
  "fylke",
  "helsedir",
  "regjering",
  "universitet",
  "hoyskole",
  "hogskole",
  "politi",
  "nav.no",
  "statsbygg",
  "altinn",
  "skatteetaten",
  "brreg.no",
  "ssb.no",
  "forsvaret",
  "fylkesmann",
];

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

function isInstitutionalDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return INSTITUTION_DOMAIN_MARKERS.some((m) => d.includes(m));
}

/**
 * E-post må høre til firmaet — blokker f.eks. sykehus-e-post på frisør.
 */
export function emailPlausibleForCompany(
  email: string,
  companyName: string
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || isDirectoryOwnedEmail(normalized)) return false;

  const domain = emailDomain(normalized);
  if (!domain) return false;

  if (domainSimilarToCompany(domain, companyName)) return true;

  if (isInstitutionalDomain(domain)) {
    return (
      companyMatchesProfileName(domain.split(".")[0] ?? "", companyName) ||
      companyMatchesProfileName(normalized.split("@")[0] ?? "", companyName)
    );
  }

  const local = normalized.split("@")[0] ?? "";
  const genericLocals = new Set([
    "post",
    "info",
    "kontakt",
    "mail",
    "hei",
    "admin",
    "booking",
    "bestilling",
  ]);

  if (genericLocals.has(local)) {
    return domainSimilarToCompany(domain, companyName);
  }

  return domainSimilarToCompany(domain, companyName);
}

/** Hent første gyldige e-post fra fritekst (f.eks. Facebook intro). */
export function parseEmailFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(EMAIL_REGEX);
  return match ? normalizeEmail(match[0]) : null;
}

function facebookEmailTrusted(
  scan: WebsiteScanResult | null | undefined,
  companyName: string
): string | null {
  if (!scan?.facebookUrl && !scan?.facebookProfile) return null;

  if (scan.facebookProfile) {
    if (!profileMatchesCompany(scan.facebookProfile, companyName)) return null;
    const direct = normalizeEmail(scan.facebookProfile.email);
    if (direct && emailPlausibleForCompany(direct, companyName)) return direct;
    const fromIntro = parseEmailFromText(scan.facebookProfile.intro);
    if (fromIntro && emailPlausibleForCompany(fromIntro, companyName)) {
      return fromIntro;
    }
    return null;
  }

  if (
    scan.facebookUrl &&
    socialUrlMatchesCompany(scan.facebookUrl, companyName)
  ) {
    return null;
  }

  return null;
}

function instagramEmailTrusted(
  scan: WebsiteScanResult | null | undefined,
  companyName: string
): string | null {
  if (!scan?.instagramUrl && !scan?.instagramProfile) return null;

  if (scan.instagramProfile?.name?.trim()) {
    const nameOk =
      companyMatchesProfileName(scan.instagramProfile.name, companyName) ||
      (scan.instagramProfile.url &&
        socialUrlMatchesCompany(scan.instagramProfile.url, companyName));
    if (!nameOk) return null;
  } else if (
    scan.instagramUrl &&
    !socialUrlMatchesCompany(scan.instagramUrl, companyName)
  ) {
    return null;
  }

  const direct = normalizeEmail(scan.instagramProfile?.email);
  if (direct && emailPlausibleForCompany(direct, companyName)) return direct;

  const fromBio = parseEmailFromText(scan.instagramProfile?.biography);
  if (fromBio && emailPlausibleForCompany(fromBio, companyName)) return fromBio;

  return null;
}

type CompanyEmailInput = {
  name?: string;
  email?: string | null;
  has_email?: boolean;
};

/**
 * Velg beste e-post for et firma: Brreg først, deretter validert Facebook/Instagram.
 */
export function resolveCompanyEmail(
  company: CompanyEmailInput,
  scan?: WebsiteScanResult | null
): ResolvedCompanyEmail | null {
  const companyName = company.name?.trim() ?? "";

  const brregEmail = normalizeEmail(company.email);
  if (brregEmail && company.has_email !== false) {
    if (!companyName || emailPlausibleForCompany(brregEmail, companyName)) {
      return {
        email: brregEmail,
        source: "brreg",
        isGeneric: isGenericEmail(brregEmail),
        isPersonal: isPersonalEmail(brregEmail),
      };
    }
  }

  if (companyName) {
    const facebookEmail = facebookEmailTrusted(scan, companyName);
    if (facebookEmail) {
      return {
        email: facebookEmail,
        source: "facebook",
        isGeneric: isGenericEmail(facebookEmail),
        isPersonal: isPersonalEmail(facebookEmail),
      };
    }

    const instagramEmail = instagramEmailTrusted(scan, companyName);
    if (instagramEmail) {
      return {
        email: instagramEmail,
        source: "instagram",
        isGeneric: isGenericEmail(instagramEmail),
        isPersonal: isPersonalEmail(instagramEmail),
      };
    }
  }

  return null;
}
