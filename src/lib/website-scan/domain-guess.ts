import { fetchWebsitePageMetadata } from "./fetch-website-metadata";
import {
  compactAlnum,
  domainSimilarToCompany,
  isNonOwnWebsiteDomain,
  nameTokens,
  normalizeDomain,
  stripCompanySuffix,
  websiteUrlPlausibleForCompany,
} from "./parse-results";

const PROBE_TIMEOUT_MS = 6_000;
const MAX_BASES = 8;
const EXTRA_TLDS = [".com", ".dk", ".org", ".tech", ".art", ".fi", ".se"];

const GENERIC = new Set([
  "auto",
  "bygg",
  "care",
  "consult",
  "consulting",
  "energy",
  "group",
  "holding",
  "partner",
  "service",
  "services",
  "solutions",
  "systems",
  "system",
  "tech",
  "transport",
]);

function domainBases(companyName: string): string[] {
  const stripped = stripCompanySuffix(companyName);
  const compact = compactAlnum(stripped);
  const rawTokens = nameTokens(companyName).map((t) => compactAlnum(t));
  const brandTokens = rawTokens.filter((t) => t.length >= 4 && !GENERIC.has(t));

  const ordered: string[] = [];
  const add = (b: string) => {
    if (b.length >= 4 && !ordered.includes(b)) ordered.push(b);
  };

  const hyphenSlug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9æøå-]+/gi, "-")
    .replace(/^-|-$/g, "");
  if (hyphenSlug.includes("-")) add(hyphenSlug);

  if (brandTokens.length >= 2) add(brandTokens.slice(0, 2).join(""));
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const a = rawTokens[i]!;
    const b = rawTokens[i + 1]!;
    if (b === "systems" && a.length >= 4) add(a + "system");
  }

  for (const token of brandTokens) add(token);

  if (compact.length >= 5 && compact.length <= 24) add(compact);

  for (const len of [14, 12, 11, 10, 9, 8]) {
    if (compact.length > len) add(compact.slice(0, len));
  }

  return ordered.slice(0, MAX_BASES);
}

async function probeUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NyLead/1.0)" },
    });
    if (res.status >= 200 && res.status < 500) return res.url;
  } catch {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NyLead/1.0)" },
      });
      if (res.status >= 200 && res.status < 500) return res.url;
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function tryDomain(
  base: string,
  tld: string,
  companyName: string
): Promise<{ websiteUrl: string; websiteDomain: string } | null> {
  const domain = `${base}${tld}`;
  if (isNonOwnWebsiteDomain(domain)) return null;
  if (!domainSimilarToCompany(domain, companyName)) return null;

  const finalUrl = await probeUrl(`https://${domain}/`);
  if (!finalUrl) return null;

  const normalized = normalizeDomain(finalUrl);
  if (!normalized || isNonOwnWebsiteDomain(normalized)) return null;
  if (!domainSimilarToCompany(normalized, companyName)) return null;

  const meta = await fetchWebsitePageMetadata(finalUrl).catch(() => ({
    displayName: null,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
  }));

  if (websiteUrlPlausibleForCompany(finalUrl, companyName, meta.displayName)) {
    return { websiteUrl: finalUrl, websiteDomain: normalized };
  }

  return null;
}

export function preferredTldFromPlace(place: string | null | undefined): string | null {
  if (!place) return null;
  const p = place.toUpperCase();
  if (p.startsWith("DK")) return ".dk";
  if (p.startsWith("SE")) return ".se";
  if (p.startsWith("FI")) return ".fi";
  if (p.startsWith("FR")) return ".fr";
  if (p.startsWith("CH")) return ".ch";
  return null;
}

/** Siste utvei når Google ikke lister nettsiden — prøv sannsynlige domener. */
export async function discoverWebsiteByDomainGuess(
  companyName: string,
  options?: { preferredTld?: string | null }
): Promise<{ websiteUrl: string; websiteDomain: string } | null> {
  const bases = domainBases(companyName);
  const preferred = options?.preferredTld;

  if (preferred && preferred !== ".no") {
    for (const base of bases) {
      const hit = await tryDomain(base, preferred, companyName);
      if (hit) return hit;
    }
  }

  for (const base of bases) {
    const noHit = await tryDomain(base, ".no", companyName);
    if (noHit) return noHit;
  }

  for (const base of bases.slice(0, 4)) {
    for (const tld of EXTRA_TLDS) {
      if (tld === preferred) continue;
      const hit = await tryDomain(base, tld, companyName);
      if (hit) return hit;
    }
  }

  return null;
}
