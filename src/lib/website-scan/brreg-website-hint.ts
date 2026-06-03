import {
  isNonOwnWebsiteDomain,
  normalizeDomain,
} from "@/lib/website-scan/parse-results";

/**
 * Offisiell hjemmeside fra Brreg — høyere prioritet enn e-postdomene-gjetning.
 */
export function websiteFromBrreg(
  website: string | null | undefined
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

    return {
      websiteUrl: parsed.href,
      websiteDomain: domain,
    };
  } catch {
    return null;
  }
}
