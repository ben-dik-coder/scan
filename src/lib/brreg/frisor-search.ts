import type { Company } from "@/types/database";
import { isSoleProprietorOrPerson } from "@/lib/brreg/lead-quality";

const FRISOR_POSITIVE_KEYWORDS = [
  "frisor",
  "frisør",
  "hair",
  "klipp",
  "salong",
  "barber",
  "harstudio",
  "hårstudio",
  "hår",
  "har",
  "fris",
  "klippe",
  "klipps",
  "hårfrisør",
  "harfrisor",
];

const FRISOR_EXCLUDE_KEYWORDS = [
  "massasje",
  "massor",
  "massør",
  "fotpleie",
  "feet",
  "fot ",
  " fot",
  "pedikyr",
  "thai",
  "terapi",
  "gravstein",
  "begravelse",
  "konkurs",
  "tvangsavvikling",
  "hudklinikk",
  "medispa",
  "velvaere",
  "velvære",
  "spa",
  "negler",
  "nails",
  "manikyr",
  "vipper",
  "eyelash",
  "tattoo",
  "tatover",
];

function normalizeFrisorText(value: string | null | undefined): string {
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

export function matchesFrisorNameKeywords(name: string | null | undefined): boolean {
  const text = normalizeFrisorText(name);
  if (!text) return false;
  return FRISOR_POSITIVE_KEYWORDS.some((kw) => text.includes(kw));
}

export function isFrisorExcludedByName(name: string | null | undefined): boolean {
  const text = normalizeFrisorText(name);
  if (!text) return false;

  const hasPositive = matchesFrisorNameKeywords(text);
  const hasExclude = FRISOR_EXCLUDE_KEYWORDS.some((kw) => text.includes(kw));

  if (hasExclude && !hasPositive) return true;

  if (isSoleProprietorOrPerson({ name: name ?? "" }) && !hasPositive) {
    return true;
  }

  return false;
}

export function isFrisorNaceCode(industryCode: string | null | undefined): boolean {
  const code = (industryCode ?? "").trim();
  if (!code) return false;
  if (code.startsWith("96.210")) return true;
  if (code.startsWith("96.02")) return true;
  const compact = code.replace(/\./g, "");
  return compact.startsWith("96210") || compact.startsWith("9602");
}

export function isFrisorRelevantCompany(
  company: Pick<Company, "name" | "industry_code">
): boolean {
  if (isFrisorExcludedByName(company.name)) return false;

  if (isFrisorNaceCode(company.industry_code)) {
    return matchesFrisorNameKeywords(company.name);
  }

  return matchesFrisorNameKeywords(company.name);
}

export function isFrisorSearchFilter(filters: {
  professionId?: string;
  industryGroup?: string;
  mappedFromProfession?: string;
}): boolean {
  const professionId = filters.professionId?.trim();
  const industryGroup = filters.industryGroup?.trim();
  const mapped = filters.mappedFromProfession?.trim();
  return (
    professionId === "frisor" ||
    mapped === "frisor" ||
    industryGroup === "frisor"
  );
}
