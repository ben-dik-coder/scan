import {
  domainSimilarToCompany,
  isNonOwnWebsiteDomain,
  nameTokens,
  normalizeDomain,
} from "./parse-results";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.no",
  "outlook.com",
  "outlook.no",
  "live.com",
  "live.no",
  "yahoo.com",
  "yahoo.no",
  "icloud.com",
  "me.com",
  "msn.com",
  "online.no",
  "broadpark.no",
  "getmail.no",
  "frisurf.no",
  "start.no",
  "epost.no",
  "mail.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
]);

/**
 * E-post på eget domene som ligner firmanavn → sannsynlig nettside.
 * Gmail m.m. teller ikke. post@tilfeldig.no uten navnelikhet teller ikke.
 */
export function websiteFromEmail(
  email: string | null | undefined,
  companyName: string
): { websiteUrl: string; websiteDomain: string } | null {
  if (!email?.includes("@")) return null;

  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || domain.length < 4 || !domain.includes(".")) return null;
  if (FREE_EMAIL_DOMAINS.has(domain)) return null;
  if (isNonOwnWebsiteDomain(domain)) return null;

  const websiteDomain = normalizeDomain(`https://${domain}`);
  if (!websiteDomain) return null;

  if (!domainSimilarToCompany(websiteDomain, companyName)) {
    const tokens = nameTokens(companyName);
    if (tokens.length > 0) return null;
  }

  return {
    websiteUrl: `https://${websiteDomain}`,
    websiteDomain,
  };
}
