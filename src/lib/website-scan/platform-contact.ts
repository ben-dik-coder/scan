import {
  buildGulesiderSearchQuery,
  pickGulesiderFromHits,
  type GulesiderPresence,
} from "./directory-presence";
import { websiteFromCrossLink } from "./cross-link-website";
import { fetchPublicHtml } from "./fetch-public-html";
import {
  extractEmailsFromHtml,
  extractExternalWebsiteFromHtml,
  extractPhonesFromHtml,
} from "./parse-page-contact";
import { profileMatchesCompany } from "@/lib/website-scan/serpapi-facebook-profile";
import {
  companyMatchesProfileName,
  companyMatchesResult,
  isBookingPlatformDomain,
  isDirectoryDomain,
  isHostedPlatformDomain,
  normalizeDomain,
  type SearchHit,
} from "./parse-results";
import {
  emailDomain,
  isDirectoryOwnedEmail,
  parseEmailFromText,
} from "./resolve-company-email";
import {
  emailPlausibleForCompany,
  normalizeEmail,
} from "@/lib/website-scan/resolve-company-email";
import { socialUrlMatchesCompany } from "@/lib/website-scan/social-profiles";
import type { WebsiteScanResult } from "./types";

export type PlatformContactSource =
  | "facebook"
  | "instagram"
  | "website"
  | "booking"
  | "gulesider"
  | "1881"
  | "directory"
  | "proff";

export type PlatformContactRecord = {
  source: PlatformContactSource;
  url: string;
  phone: string | null;
  email: string | null;
  externalWebsite: string | null;
};

export type PlatformContactEnrichment = {
  contacts: PlatformContactRecord[];
  gulesider: GulesiderPresence;
  enrichedPhone: string | null;
  enrichedPhoneSource: PlatformContactSource | null;
  enrichedEmail: string | null;
  enrichedEmailSource: PlatformContactSource | null;
  contactsEnriched: true;
};

const DIRECTORY_1881 = ["1881.no", "kart.1881.no"];
const DIRECTORY_PROFF = ["proff.no"];
const MAX_PLATFORM_FETCHES = 8;

const DIRECTORY_FETCH_DOMAINS = new Set([
  "gulesider.no",
  "degulesider.no",
  "1881.no",
  "kart.1881.no",
  "118.no",
  "180.no",
  "1850.no",
  "eniro.no",
  "eniro.se",
  "proff.no",
  "purehelp.no",
  "firmalene.no",
  "regnskapstall.no",
  "norske-bedrifter.no",
  "tripadvisor.com",
  "tripadvisor.no",
  "trustpilot.com",
  "trustpilot.no",
  "roller.no",
  "daa.no",
  "klikk.no",
  "bizin.no",
  "kompass.com",
  "allabolag.se",
  "yelp.com",
  "yelp.no",
  "hitta.se",
  "yellowpages.com",
  "firmanett.no",
  "lex247.com",
  "virksomhet.brreg.no",
  "kart.gulesider.no",
]);

function filterEmailsForSource(
  emails: string[],
  url: string,
  source: PlatformContactSource
): string[] {
  const sourceDomain = normalizeDomain(url);
  return emails.filter((email) => {
    if (isDirectoryOwnedEmail(email)) return false;
    const domain = emailDomain(email);
    if (!domain) return false;

    // På katalog/booking-sider er e-post på samme domene nesten alltid plattformens egen.
    if (source !== "website" && domain === sourceDomain) return false;
    return true;
  });
}

function classifyPlatform(url: string): PlatformContactSource {
  const domain = normalizeDomain(url);
  if (DIRECTORY_1881.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "1881";
  }
  if (DIRECTORY_PROFF.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "proff";
  }
  if (domain.includes("gulesider")) return "gulesider";
  if (isBookingPlatformDomain(domain)) return "booking";
  if (isDirectoryDomain(domain)) return "directory";
  return "website";
}

function shouldFetchUrl(url: string): boolean {
  const domain = normalizeDomain(url);
  if (!domain) return false;
  if (isHostedPlatformDomain(domain)) return false;
  if (domain === "g.page" || domain === "business.site") return true;
  if (/facebook|instagram|linkedin|twitter|youtube|google\.|finn\.no|wikipedia/i.test(domain)) {
    return false;
  }
  if (
    isBookingPlatformDomain(domain) ||
    DIRECTORY_FETCH_DOMAINS.has(domain) ||
    domain.includes("gulesider")
  ) {
    return true;
  }
  return !isDirectoryDomain(domain);
}

function pick1881FromHits(
  hits: SearchHit[],
  companyName: string
): { url: string } | null {
  for (const hit of hits) {
    const domain = normalizeDomain(hit.link);
    if (!DIRECTORY_1881.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      continue;
    }
    if (!companyMatchesResult(hit.title, hit.link, companyName)) continue;
    return { url: hit.link.split("#")[0] ?? hit.link };
  }
  return null;
}

export function build1881SearchQuery(company: {
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): string {
  const place =
    company.municipality_name ?? company.city ?? "";
  const name = company.name.trim();
  return place
    ? `site:1881.no "${name}" ${place}`
    : `site:1881.no "${name}"`;
}

function pickPhoneFromSerpApiText(
  direct: string | null | undefined,
  ...texts: Array<string | null | undefined>
): string | null {
  const trimmed = direct?.trim();
  if (trimmed) {
    const normalized = extractPhonesFromHtml(trimmed)[0];
    if (normalized) return normalized;
  }
  for (const text of texts) {
    const phone = extractPhonesFromHtml(text ?? "")[0];
    if (phone) return phone;
  }
  return null;
}

function pickEmailFromSerpApiText(
  direct: string | null | undefined,
  ...texts: Array<string | null | undefined>
): string | null {
  const fromDirect = parseEmailFromText(direct);
  if (fromDirect) return fromDirect;
  for (const text of texts) {
    const email = parseEmailFromText(text);
    if (email) return email;
  }
  return null;
}

function externalWebsiteFromUrl(
  url: string | null | undefined,
  companyName: string
): string | null {
  if (!url?.trim()) return null;
  return websiteFromCrossLink(url, companyName)?.websiteUrl ?? null;
}

function facebookContactTrusted(
  scan: WebsiteScanResult,
  companyName: string
): boolean {
  if (scan.facebookProfile) {
    return profileMatchesCompany(scan.facebookProfile, companyName);
  }
  return Boolean(
    scan.facebookUrl && socialUrlMatchesCompany(scan.facebookUrl, companyName)
  );
}

function instagramContactTrusted(
  scan: WebsiteScanResult,
  companyName: string
): boolean {
  if (scan.instagramProfile?.name?.trim()) {
    return (
      companyMatchesProfileName(scan.instagramProfile.name, companyName) ||
      companyMatchesResult(
        scan.instagramProfile.name,
        scan.instagramProfile.url ?? "",
        companyName
      )
    );
  }
  return Boolean(
    scan.instagramUrl && socialUrlMatchesCompany(scan.instagramUrl, companyName)
  );
}

function recordFromFacebook(
  scan: WebsiteScanResult,
  companyName: string
): PlatformContactRecord | null {
  const profile = scan.facebookProfile;
  if (!profile?.url && !scan.facebookUrl) return null;
  if (!facebookContactTrusted(scan, companyName)) return null;

  const phone = pickPhoneFromSerpApiText(
    profile?.phone,
    profile?.intro,
    profile?.address
  );
  const rawEmail = pickEmailFromSerpApiText(
    profile?.email,
    profile?.intro,
    profile?.address
  );
  const email =
    rawEmail && emailPlausibleForCompany(rawEmail, companyName)
      ? normalizeEmail(rawEmail)
      : null;

  if (!phone && !email) return null;

  return {
    source: "facebook",
    url: profile?.url ?? scan.facebookUrl ?? "",
    phone,
    email,
    externalWebsite: profile?.linkedWebsiteUrl ?? null,
  };
}

function recordFromInstagram(
  scan: WebsiteScanResult,
  companyName: string
): PlatformContactRecord | null {
  const profile = scan.instagramProfile;
  if (!profile?.url && !scan.instagramUrl) return null;
  if (!instagramContactTrusted(scan, companyName)) return null;

  const phone = pickPhoneFromSerpApiText(profile?.phone, profile?.biography);
  const rawEmail = pickEmailFromSerpApiText(profile?.email, profile?.biography);
  const email =
    rawEmail && emailPlausibleForCompany(rawEmail, companyName)
      ? normalizeEmail(rawEmail)
      : null;
  const externalWebsite = externalWebsiteFromUrl(profile?.externalUrl, companyName);

  if (!phone && !email) return null;

  return {
    source: "instagram",
    url: profile?.url ?? scan.instagramUrl ?? "",
    phone,
    email,
    externalWebsite,
  };
}

function collectFetchUrls(
  scan: WebsiteScanResult,
  companyName: string
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const add = (url: string | null | undefined) => {
    if (!url) return;
    const key = url.split("#")[0]!.toLowerCase();
    if (seen.has(key) || !shouldFetchUrl(url)) return;
    seen.add(key);
    urls.push(url);
  };

  if (scan.websiteUrl) add(scan.websiteUrl);
  if (scan.gulesiderUrl) add(scan.gulesiderUrl);
  add(scan.facebookProfile?.linkedWebsiteUrl);
  add(scan.instagramProfile?.externalUrl);

  for (const hit of scan.topHits ?? []) {
    if (companyMatchesResult(hit.title, hit.link, companyName)) {
      add(hit.link);
    }
  }

  const hit1881 = pick1881FromHits(
    (scan.topHits ?? []).map((h) => ({ title: h.title, link: h.link })),
    companyName
  );
  if (hit1881) add(hit1881.url);

  if (scan.websiteKind === "own" && scan.websiteUrl) {
    const base = scan.websiteUrl.replace(/\/$/, "");
    for (const path of ["/kontakt", "/contact", "/kontakt-oss"]) {
      add(`${base}${path}`);
    }
  }

  return urls.slice(0, MAX_PLATFORM_FETCHES);
}

async function fetchPlatformRecord(
  url: string
): Promise<PlatformContactRecord | null> {
  const html = await fetchPublicHtml(url);
  if (!html) return null;

  const domain = normalizeDomain(url);
  const source = classifyPlatform(url);
  const phones = extractPhonesFromHtml(html);
  const emails = filterEmailsForSource(extractEmailsFromHtml(html), url, source);
  const external =
    source !== "website"
      ? extractExternalWebsiteFromHtml(html, domain)
      : null;

  if (phones.length === 0 && emails.length === 0 && !external) return null;

  return {
    source,
    url,
    phone: phones[0] ?? null,
    email: emails[0] ?? null,
    externalWebsite: external,
  };
}

const PHONE_PRIORITY: PlatformContactSource[] = [
  "website",
  "facebook",
  "instagram",
  "booking",
  "gulesider",
  "1881",
  "proff",
  "directory",
];

const EMAIL_PRIORITY: PlatformContactSource[] = [
  "website",
  "facebook",
  "instagram",
  "booking",
  "gulesider",
  "1881",
  "proff",
  "directory",
];

function pickBest(
  contacts: PlatformContactRecord[],
  field: "phone" | "email",
  priority: PlatformContactSource[]
): { value: string; source: PlatformContactSource } | null {
  for (const source of priority) {
    const row = contacts.find((c) => c.source === source && c[field]);
    if (row?.[field]) return { value: row[field]!, source };
  }
  const any = contacts.find((c) => c[field]);
  if (any?.[field]) return { value: any[field]!, source: any.source };
  return null;
}

export type EnrichPlatformContactsOptions = {
  /** Ekstra Google-treff (allerede betalt) — brukes for Gulesider/1881-URL */
  hits?: SearchHit[];
  /** Kjør site:-søk for Gulesider hvis ikke i treff (koster API) */
  runDirectorySearch?: boolean;
  fetchHitsForQueries?: (
    queries: string[],
    options?: { orgnr?: string; serpNum?: number }
  ) => Promise<SearchHit[]>;
  /** Demo-modus — ikke hent HTML */
  skipFetch?: boolean;
};

export async function enrichPlatformContacts(
  company: {
    orgnr: string;
    name: string;
    municipality_name?: string | null;
    city?: string | null;
  },
  scan: WebsiteScanResult,
  options?: EnrichPlatformContactsOptions
): Promise<PlatformContactEnrichment> {
  const hits = options?.hits ?? [];
  let gulesider = pickGulesiderFromHits(hits, company.name);
  if (!gulesider.gulesiderListed && scan.gulesiderUrl) {
    gulesider = {
      gulesiderListed: true,
      gulesiderUrl: scan.gulesiderUrl,
      gulesiderConfidence: scan.gulesiderConfidence,
    };
  }

  const workingScan: WebsiteScanResult = {
    ...scan,
    gulesiderUrl: gulesider.gulesiderUrl,
    gulesiderListed: gulesider.gulesiderListed,
  };

  if (
    options?.runDirectorySearch &&
    options.fetchHitsForQueries &&
    !gulesider.gulesiderListed
  ) {
    try {
      const gHits = await options.fetchHitsForQueries(
        [buildGulesiderSearchQuery(company)],
        { orgnr: company.orgnr, serpNum: 8 }
      );
      gulesider = pickGulesiderFromHits(gHits, company.name);
      workingScan.gulesiderUrl = gulesider.gulesiderUrl;
      workingScan.gulesiderListed = gulesider.gulesiderListed;
    } catch {
      /* ignore */
    }
  }

  const contacts: PlatformContactRecord[] = [];

  const fb = recordFromFacebook(scan, company.name);
  if (fb) contacts.push(fb);

  const ig = recordFromInstagram(scan, company.name);
  if (ig) contacts.push(ig);

  if (!options?.skipFetch) {
    const urls = collectFetchUrls(workingScan, company.name);
    const fetched = await Promise.all(urls.map((url) => fetchPlatformRecord(url)));
    for (const row of fetched) {
      if (row) contacts.push(row);
    }
  }

  const bestPhone = pickBest(contacts, "phone", PHONE_PRIORITY);
  const bestEmail = pickBest(contacts, "email", EMAIL_PRIORITY);

  return {
    contacts,
    gulesider,
    enrichedPhone: bestPhone?.value ?? null,
    enrichedPhoneSource: bestPhone?.source ?? null,
    enrichedEmail: bestEmail?.value ?? null,
    enrichedEmailSource: bestEmail?.source ?? null,
    contactsEnriched: true,
  };
}

export function applyPlatformContactEnrichment(
  scan: WebsiteScanResult,
  enrichment: PlatformContactEnrichment
): WebsiteScanResult {
  return {
    ...scan,
    gulesiderListed: enrichment.gulesider.gulesiderListed,
    gulesiderUrl: enrichment.gulesider.gulesiderUrl,
    gulesiderConfidence: enrichment.gulesider.gulesiderConfidence,
    platformContacts: enrichment.contacts,
    enrichedPhone: enrichment.enrichedPhone,
    enrichedPhoneSource: enrichment.enrichedPhoneSource,
    enrichedEmail: enrichment.enrichedEmail,
    enrichedEmailSource: enrichment.enrichedEmailSource,
    contactsEnriched: true,
  };
}
