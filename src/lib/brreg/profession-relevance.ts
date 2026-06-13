import type { Company } from "@/types/database";
import {
  getProfessionById,
  matchesProfessionSearch,
  resolveProfessionFilter,
} from "@/lib/constants/professions";

function normalizeProfessionText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ekstra navnemønstre utover matchesProfessionSearch (sammensatte ord). */
const PROFESSION_NAME_FALLBACK: Record<string, RegExp> = {
  apotek: /apotek|sykehusapotek|vitus|boots/i,
  megler: /megler|eiendomsmegler|boligmegler|eiendom/i,
  maler: /maler|malermester|maling|sparkel|farge/i,
  rorlegger: /rorlegger|rørlegger|vvs/i,
  murer: /murer|murverk|mur/i,
  elektriker: /elektriker|elektro|el[\s-]?install/i,
  snekker: /snekker|tomrer|tømrer|byggmester/i,
  psykolog: /psykolog|nevropsykolog/i,
};

export function isProfessionRelevantCompany(
  professionId: string | undefined,
  company: Pick<Company, "name" | "industry_code">
): boolean {
  const id = professionId?.trim();
  if (!id) return true;

  const professionMatch = resolveProfessionFilter(id);
  if (
    professionMatch &&
    matchesProfessionSearch(company.industry_code, { name: company.name }, professionMatch)
  ) {
    return true;
  }

  const fallback = PROFESSION_NAME_FALLBACK[id];
  if (fallback) {
    const text = normalizeProfessionText(company.name);
    return Boolean(text && fallback.test(text));
  }

  if (getProfessionById(id)) return false;

  return true;
}

export function isProfessionSearchFilter(filters: {
  professionId?: string;
  mappedFromProfession?: string;
}): boolean {
  const professionId = filters.professionId?.trim();
  const mapped = filters.mappedFromProfession?.trim();
  const id = professionId ?? mapped;
  if (!id) return false;
  return Boolean(getProfessionById(id) ?? PROFESSION_NAME_FALLBACK[id]);
}
