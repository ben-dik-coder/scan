import {
  domainSimilarToCompany,
  isNonOwnWebsiteDomain,
  normalizeDomain,
} from "@/lib/website-scan/parse-results";

/**
 * Offisiell hjemmeside fra Brreg — høyere prioritet enn e-postdomene-gjetning.
 * Krever at domenet ligner firmanavn (Brreg-data er ofte utdatert/feil).
 */
export function websiteFromBrreg(
  website: string | null | undefined,
  companyName?: string
): { websiteUrl: string; websiteDomain: string } | null {
  if (!website?.trim()) return null;

  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/\//, "")}`;
  }

  try {
    const parsed = new URL(url);
    const domain = normalizeDomain(parsed.href);
    if (!domain || isNonOwnWebsiteDomain(domain)) return null;
  if (!companyName?.trim()) return null;
  if (!domainSimilarToCompany(domain, companyName)) {
    return null;
  }

    return {
      websiteUrl: parsed.href,
      websiteDomain: domain,
    };
  } catch {
    return null;
  }
}
