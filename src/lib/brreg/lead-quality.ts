import { computeLeadScore } from "@/lib/sales/lead-score";
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
  company: Pick<Company, "phone" | "mobile">
): boolean {
  return Boolean(
    (company.phone ?? "").trim() || (company.mobile ?? "").trim()
  );
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

export function agentLeadRankScore(company: Company): number {
  if (isBadLeadCompany(company)) return -10_000;

  let score = computeLeadScore(company);
  if (hasCompanyPhone(company)) score += 50;
  if (isSoleProprietorOrPerson(company) && !hasCompanyPhone(company)) {
    score -= 40;
  }
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
