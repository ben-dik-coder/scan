import {
  matchesIndustryGroup,
  WEBBYRA_NAME_KEYWORDS,
} from "@/lib/constants/industries";
import type { Company } from "@/types/database";

/** Bransjer som selger nettsider — aldri leads når brukeren vil selge nettside. */
export const WEBSITE_SALES_COMPETITOR_GROUPS = [
  "webbyra",
  "it",
  "reklame",
] as const;

function normalizeText(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

function matchesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    return k.length >= 2 && lower.includes(k);
  });
}

/** Bruker vil finne leads å selge nettside til — ikke søke etter webbyrå. */
export function isWebsiteSalesLeadIntent(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (
    /\b(selge|salg av|selge\s+)(nettside|hjemmeside|websider|webside)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  if (
    /\b(gode\s+)?leads?\b/.test(normalized) &&
    /\b(selge|nettside|hjemmeside|kontakte|oppfolging|oppfølging)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  if (
    /\b(kontakte|ringe|ta kontakt)\b/.test(normalized) &&
    /\b(nettside|hjemmeside|webside)\b/.test(normalized)
  ) {
    return true;
  }

  if (
    /\bfinn\b/.test(normalized) &&
    /\bleads?\b/.test(normalized) &&
    !/\b(webbyra|webbyrå|webdesign|it[\s-]?firma|markedsforing|markedsføring|reklamebyra|reklamebyrå)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

/** Fjern salgs-fraser før bransjetolkning — «nettside» skal ikke bli webdesign. */
export function messageForIndustryResolution(message: string): string {
  if (!isWebsiteSalesLeadIntent(message)) return message;

  return message
    .replace(
      /\b(selge|salg av)\s+(nettside|hjemmeside|websider|webside)\b/gi,
      " "
    )
    .replace(/\b(gode\s+)?leads?\b/gi, " ")
    .replace(
      /\b(jeg|du|vi)\s+(mest\s+sannsynlig\s+)?kan\s+kontakte\b/gi,
      " "
    )
    .replace(/\bmest\s+sannsynlig\b/gi, " ")
    .replace(/\b(uten|mangler|trenger)\s+nettside\b/gi, " ")
    .replace(/\b(finn|vis|gi|hent)\s+(meg|oss|litt)\b/gi, "$1 ")
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCompetitorIndustryKeyword(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    /\b(webbyra|webbyrå|webdesign|digitalbyra|digitalbyrå)\b/.test(
      normalized
    ) ||
    /\b(it[\s-]?firma|it[\s-]?selskap|it[\s-]?bedrift)\b/.test(normalized) ||
    /\b(reklamebyra|reklamebyrå|markedsforing|markedsføring)\b/.test(
      normalized
    )
  );
}

export function isCompetitorLeadCompany(
  company: Pick<Company, "name" | "industry_code" | "industry_description">
): boolean {
  const context = {
    name: company.name,
    industryDescription: company.industry_description,
  };

  for (const groupId of WEBSITE_SALES_COMPETITOR_GROUPS) {
    if (matchesIndustryGroup(company.industry_code, groupId, context)) {
      return true;
    }
  }

  const text = [company.name, company.industry_description]
    .filter(Boolean)
    .join(" ");
  return matchesAnyKeyword(text, WEBBYRA_NAME_KEYWORDS);
}

export function hasStoredWebsite(website: string | null | undefined): boolean {
  return Boolean((website ?? "").trim());
}

export function parseDefaultIndustryFromPrompt(
  systemPromptExtra?: string
): { industryGroup?: string; professionId?: string; label?: string } | null {
  if (!systemPromptExtra?.trim()) return null;

  const match = systemPromptExtra.match(/default_industry:\s*([^\n]+)/i);
  if (!match?.[1]) return null;

  const value = match[1].trim().toLowerCase();
  if (!value) return null;

  return { industryGroup: value, label: value };
}
