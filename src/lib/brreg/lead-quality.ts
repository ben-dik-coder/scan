import { hasOwnWebsite, isLeadWithoutOwnSite } from "@/lib/agent/website-presence";
import { hasStoredWebsite } from "@/lib/agent/website-sales-leads";
import { computeLeadScore } from "@/lib/sales/lead-score";
import { phonePlausibleForCompany } from "@/lib/website-scan/phone-plausible";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import type { Company } from "@/types/database";

const COMPANY_FORM_SUFFIX = /\b(AS|ASA|ANS|DA|NUF|SA|BA|KS|ENK|IKS|STI)\b/i;

/** Firma som er konkurs, tvangsavviklet eller oppløst — dårlige leads. */
export function isBadLeadCompany(company: Pick<Company, "name">): boolean {
  const name = (company.name ?? "").toUpperCase();
  if (!name) return false;

  if (name.includes("KONKURSBO") || name.includes("KONKURS BO")) return true;
  if (name.includes("TVANGSAVVIKLINGSBO") || name.includes("TVANGSAVVIKLING")) {
    return true;
  }
  if (name.includes("UNDER AVVIKLING")) return true;
  if (/\bOPPL[OØ]ST\b/.test(name)) return true;
  if (/\bAVVIKLET\b/.test(name)) return true;

  return false;
}

export function hasCompanyPhone(
  company: Pick<Company, "phone" | "mobile" | "orgnr">
): boolean {
  const phone = (company.phone ?? "").trim();
  const mobile = (company.mobile ?? "").trim();
  const orgnr = (company.orgnr ?? "").trim();
  if (phone && phonePlausibleForCompany(phone, orgnr)) return true;
  if (mobile && phonePlausibleForCompany(mobile, orgnr)) return true;
  return false;
}

export function getPlausibleCompanyPhone(
  company: Pick<Company, "phone" | "mobile" | "orgnr">
): string | null {
  const orgnr = (company.orgnr ?? "").trim();
  const phone = (company.phone ?? "").trim();
  if (phone && phonePlausibleForCompany(phone, orgnr)) return phone;
  const mobile = (company.mobile ?? "").trim();
  if (mobile && phonePlausibleForCompany(mobile, orgnr)) return mobile;
  return null;
}

/** ENK eller personnavn uten vanlig selskapsform. */
export function isSoleProprietorOrPerson(
  company: Pick<Company, "name">
): boolean {
  const name = (company.name ?? "").trim();
  if (!name) return false;
  if (/\bENK\b/i.test(name)) return true;
  return !COMPANY_FORM_SUFFIX.test(name);
}

/** Holdingselskap: navn med «holding» eller næringskode 64.20x */
export function isHoldingCompany(
  company: Pick<Company, "name" | "industry_code">
): boolean {
  if (/\bholding\b/i.test(company.name ?? "")) return true;
  return (company.industry_code ?? "").startsWith("64.2");
}

/** Uklassifisert / holding-lignende næringskode fra Brreg. */
export function isUnclassifiedIndustryCode(
  industryCode: string | null | undefined
): boolean {
  const code = (industryCode ?? "").trim();
  return code === "00.000" || code.startsWith("64.2");
}

export function companyHasKnownWebsite(
  company: Pick<Company, "website">,
  scan?: WebsiteScanResult
): boolean {
  if (hasStoredWebsite(company.website)) return true;
  return hasOwnWebsite(scan);
}

/** Finans/kapital — dårlig mål for nettside-salg. */
function isCapitalIndustry(industryCode: string | null | undefined): boolean {
  return (industryCode ?? "").trim().startsWith("64.");
}

/** Eiendom/megling — ofte store aktører, lavere prioritet. */
function isEiendomIndustry(industryCode: string | null | undefined): boolean {
  return (industryCode ?? "").trim().startsWith("68.");
}

function isFrisorCompany(
  company: Pick<Company, "name" | "industry_code">
): boolean {
  const code = (company.industry_code ?? "").trim();
  if (code.startsWith("96.0") || code.startsWith("96.02")) return true;
  return /fris|salong|hår|klipp|barber/i.test(company.name ?? "");
}

/** Dårlige leads ved salg av nettside — holding, ENK/person uten telefon. */
export function isWeakWebsiteSalesLead(
  company: Pick<Company, "name" | "industry_code" | "phone" | "mobile" | "orgnr">
): boolean {
  if (isBadLeadCompany(company)) return true;
  if (isHoldingCompany(company)) return true;
  if (isUnclassifiedIndustryCode(company.industry_code)) return true;
  if (isCapitalIndustry(company.industry_code)) return true;
  if (isEiendomIndustry(company.industry_code)) return true;
  if (/\bENK\b/i.test(company.name ?? "") && !hasCompanyPhone(company)) return true;
  if (isSoleProprietorOrPerson(company) && !hasCompanyPhone(company)) return true;
  return false;
}

export function websiteSalesLeadRankScore(
  company: Company,
  scan?: WebsiteScanResult
): number {
  if (isWeakWebsiteSalesLead(company)) return -10_000;
  if (companyHasKnownWebsite(company, scan)) return -10_000;

  let score = computeLeadScore(company);
  if (scan && isLeadWithoutOwnSite(scan)) score += 120;
  else if (!scan) score -= 25;
  if (hasCompanyPhone(company)) score += 60;
  if (/\bAS\b/i.test(company.name) && hasCompanyPhone(company)) score += 25;
  if (/\bENK\b/i.test(company.name)) score -= 35;
  if (/\bENK\b/i.test(company.name) && isFrisorCompany(company)) score -= 40;
  if (isSoleProprietorOrPerson(company)) score -= 30;

  return score;
}

export function filterWebsiteSalesLeadCompanies<T extends Company>(
  companies: T[]
): T[] {
  return companies.filter((company) => !isWeakWebsiteSalesLead(company));
}

export function rankWebsiteSalesLeadCompanies<T extends Company>(
  companies: T[],
  scanByOrgnr: Map<string, WebsiteScanResult>
): T[] {
  return [...companies].sort((a, b) => {
    const diff =
      websiteSalesLeadRankScore(b, scanByOrgnr.get(b.orgnr)) -
      websiteSalesLeadRankScore(a, scanByOrgnr.get(a.orgnr));
    if (diff !== 0) return diff;
    return (b.registered_at ?? "").localeCompare(a.registered_at ?? "");
  });
}

export function agentLeadRankScore(company: Company): number {
  if (isBadLeadCompany(company)) return -10_000;
  if (isHoldingCompany(company)) return -5_000;

  let score = computeLeadScore(company);
  if (hasCompanyPhone(company)) score += 50;
  if (isSoleProprietorOrPerson(company) && !hasCompanyPhone(company)) {
    score -= 40;
  }
  if (/\bENK\b/i.test(company.name) && !hasCompanyPhone(company)) score -= 30;
  if (/\bAS\b/i.test(company.name) && hasCompanyPhone(company)) score += 10;

  return score;
}

export function rankAgentLeadCompanies<T extends Company>(companies: T[]): T[] {
  return [...companies].sort((a, b) => {
    const diff = agentLeadRankScore(b) - agentLeadRankScore(a);
    if (diff !== 0) return diff;
    return (b.registered_at ?? "").localeCompare(a.registered_at ?? "");
  });
}

export function filterAgentLeadCompanies<T extends Company>(
  companies: T[]
): T[] {
  return companies.filter((company) => !isBadLeadCompany(company));
}

export function selectAgentLeadCompanies<T extends Company>(
  companies: T[],
  limit: number
): T[] {
  const filtered = filterAgentLeadCompanies(companies);
  const ranked = rankAgentLeadCompanies(filtered);
  return ranked.slice(0, limit);
}
