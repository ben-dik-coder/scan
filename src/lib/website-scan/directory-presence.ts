import { primaryGeoPlace } from "@/lib/brreg/geo-place";
import {
  companyMatchesResult,
  normalizeDomain,
  stripCompanySuffix,
  type SearchHit,
} from "./parse-results";

const GULESIDER_DOMAINS = ["gulesider.no", "degulesider.no"] as const;

export function isGulesiderDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return GULESIDER_DOMAINS.some((g) => d === g || d.endsWith(`.${g}`));
}

export type GulesiderPresence = {
  gulesiderListed: boolean;
  gulesiderUrl: string | null;
  gulesiderConfidence?: "high" | "medium" | "low";
};

export function buildGulesiderSearchQuery(company: {
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): string {
  const stripped = stripCompanySuffix(company.name.trim());
  const place = primaryGeoPlace(company) ?? company.municipality_name ?? company.city;
  if (place) {
    return `site:gulesider.no "${stripped}" ${place}`;
  }
  return `site:gulesider.no "${stripped}"`;
}

function scoreGulesiderHit(
  hit: SearchHit,
  companyName: string
): { url: string; confidence: "high" | "medium" | "low" } | null {
  const domain = normalizeDomain(hit.link);
  if (!isGulesiderDomain(domain)) return null;

  const titleMatch = companyMatchesResult(hit.title, hit.link, companyName);
  if (!titleMatch) return null;

  const stripped = stripCompanySuffix(companyName);
  const titleHay = `${hit.title} ${hit.link}`.toLowerCase();
  const strong =
    titleHay.includes(stripped.toLowerCase()) ||
    titleHay.includes(companyName.toLowerCase());

  return {
    url: hit.link.split("#")[0] ?? hit.link,
    confidence: strong ? "high" : "medium",
  };
}

/** Finn beste Gulesider-treff i Google-resultater. */
export function pickGulesiderFromHits(
  hits: SearchHit[],
  companyName: string
): GulesiderPresence {
  for (const hit of hits) {
    const match = scoreGulesiderHit(hit, companyName);
    if (match) {
      return {
        gulesiderListed: true,
        gulesiderUrl: match.url,
        gulesiderConfidence: match.confidence,
      };
    }
  }

  return {
    gulesiderListed: false,
    gulesiderUrl: null,
  };
}

export function mergeGulesiderPresence(
  primary: GulesiderPresence,
  secondary: GulesiderPresence
): GulesiderPresence {
  if (primary.gulesiderListed) return primary;
  if (secondary.gulesiderListed) return secondary;
  return primary;
}
