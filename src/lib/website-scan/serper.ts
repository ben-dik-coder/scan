import {
  assertSerperQuota,
  recordSerperApiCall,
  SerperLimitReachedError,
} from "@/lib/billing/serper-usage";
import { companyGeoPlaces, primaryGeoPlace } from "@/lib/brreg/geo-place";
import {
  discoverWebsiteByDomainGuess,
  preferredTldFromPlace,
} from "./domain-guess";
import { fetchPublicHtml } from "./fetch-public-html";
import { fetchWebsitePageMetadata } from "./fetch-website-metadata";
import { extractPhonesFromHtml } from "./parse-page-contact";
import {
  buildWebsiteSearchQueries,
  companyMatchesResult,
  compactAlnum,
  dedupeHits,
  normalizeDomain,
  norwegianDomainCompact,
  isConfidentWebsitePick,
  pickBestWebsite,
  stripCompanySuffix,
  websiteUrlPlausibleForCompany,
  type SearchHit,
} from "./parse-results";
import {
  extractPhoneFromText,
  phoneCoreDigits,
  phonePlausibleForCompany,
  pickPlausiblePhone,
} from "./phone-plausible";
import {
  GOOGLE_SERP_NUM,
  SERPER_PHONE_MAX_QUERIES,
  SERPER_WEBSITE_MAX_QUERIES,
} from "./scan-api-budget";
import {
  getCachedSerperSearch,
  setCachedSerperSearch,
} from "./serper-query-cache";
import { discoverFromSerperPlaces } from "./serper-places";
import type { WebsiteScanCompanyInput } from "./types";

type SerperOrganic = {
  title?: string;
  link?: string;
  url?: string;
  snippet?: string;
};

function serperOrganicLink(item: SerperOrganic): string | null {
  const link = item.link?.trim() || item.url?.trim();
  return link || null;
}

type SerperResponse = {
  organic?: SerperOrganic[];
  message?: string;
};

const SERPER_TIMEOUT_MS = 20_000;

export async function searchSerper(
  query: string,
  options?: { num?: number; userId?: string; skipCache?: boolean }
): Promise<SearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Serper er ikke konfigurert");
  }

  if (!options?.skipCache) {
    const cached = getCachedSerperSearch(query);
    if (cached) return cached;
  }

  if (options?.userId) {
    await assertSerperQuota(options.userId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "no",
        hl: "no",
        num: Math.min(20, Math.max(5, options?.num ?? 10)),
      }),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Serper tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json()) as SerperResponse;

  if (!res.ok) {
    throw new Error(data.message ?? `Serper feilet (${res.status})`);
  }

  if (options?.userId) {
    await recordSerperApiCall(options.userId);
  }

  const hits = (data.organic ?? [])
    .map((item) => {
      const link = serperOrganicLink(item);
      const title = item.title?.trim();
      if (!title || !link) return null;
      const snippet = item.snippet?.trim();
      return snippet ? { title, link, snippet } : { title, link };
    })
    .filter((item): item is SearchHit => item !== null);

  if (!options?.skipCache) {
    setCachedSerperSearch(query, hits);
  }

  return hits;
}

const DIRECTORY_PHONE_DOMAINS = [
  "1881.no",
  "gulesider.no",
  "proff.no",
  "1850.no",
  "eniro.no",
  "118.no",
];

function isDirectoryPhoneDomain(domain: string): boolean {
  return DIRECTORY_PHONE_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  );
}

function extractPhonesFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  let remaining = text;
  for (let i = 0; i < 6; i++) {
    const phone = extractPhoneFromText(remaining);
    if (!phone) break;
    const core = phoneCoreDigits(phone);
    if (core && !seen.has(core)) {
      seen.add(core);
      found.push(phone);
    }
    remaining = remaining.replace(phone, " ");
  }
  return found;
}

function scorePhoneCandidate(
  hit: SearchHit,
  phone: string,
  company: WebsiteScanCompanyInput,
  websiteDomain?: string | null
): number {
  let score = 0;
  const domain = normalizeDomain(hit.link);
  const nameMatch = companyMatchesResult(hit.title, hit.link, company.name);

  if (isDirectoryPhoneDomain(domain)) {
    score += nameMatch ? 45 : 12;
  } else if (nameMatch) {
    score += 18;
  }

  if (websiteDomain && domain === websiteDomain) score += 35;
  if (hit.link.includes(company.orgnr)) score += 25;

  const core = phoneCoreDigits(phone);
  if (core) {
    const first = core[0]!;
    if (first >= "2" && first <= "7") score += 10;
    else if (first === "9") score += 2;
  }

  if (hit.snippet?.toLowerCase().includes("telefon")) score += 4;

  return score;
}

export function buildPhoneSearchQueries(
  company: Pick<
    WebsiteScanCompanyInput,
    "name" | "orgnr" | "municipality_name" | "city"
  >,
  context?: { websiteDomain?: string | null }
): string[] {
  const stripped = stripCompanySuffix(company.name.trim());
  const places = companyGeoPlaces(company);
  const queries: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const key = q.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };

  for (const place of places.length > 0 ? places : [null]) {
    const geo = place ?? "";
    if (geo) {
      add(`"${stripped}" ${geo} telefon`);
      add(`${stripped} ${geo} telefon`);
      add(`${stripped} ${geo} tlf`);
      add(`${stripped} ${geo} kontakt`);
      add(`"${stripped}" ${geo} site:1881.no`);
      add(`"${stripped}" ${geo} site:gulesider.no`);
      add(`${company.orgnr} ${geo}`);
    } else {
      add(`"${stripped}" telefon`);
      add(`${stripped} telefon Norge`);
    }
    const compact = compactAlnum(stripped);
    if (compact.length >= 5 && geo) {
      add(`${compact} ${geo} telefon`);
      add(`site:1881.no ${compact} ${geo}`);
    }
  }

  const webDomain = context?.websiteDomain?.trim();
  if (webDomain) {
    add(`site:${webDomain} telefon`);
    add(`site:${webDomain} kontakt`);
  }

  add(`${company.orgnr} telefon`);
  add(`site:1881.no ${company.orgnr}`);
  return queries.slice(0, SERPER_PHONE_MAX_QUERIES);
}

export type SerperPhoneDiscovery = {
  phone: string | null;
  confidence: "high" | "medium" | "low" | null;
  source: "places" | "organic" | null;
  queries: string[];
};

/** Serper Places først, deretter katalog-søk (1881/Gulesider) med scoring. */
export async function discoverPhoneFromSerper(
  company: WebsiteScanCompanyInput,
  options?: {
    userId?: string;
    websiteDomain?: string | null;
    websiteUrl?: string | null;
  }
): Promise<SerperPhoneDiscovery> {
  const queries = buildPhoneSearchQueries(company, {
    websiteDomain: options?.websiteDomain,
  });

  type Candidate = { phone: string; score: number; fromPlaces: boolean };
  const candidates: Candidate[] = [];

  const websiteUrl =
    options?.websiteUrl?.trim() ||
    (options?.websiteDomain?.trim()
      ? `https://${options.websiteDomain.trim()}/`
      : null);
  if (websiteUrl) {
    const html = await fetchPublicHtml(websiteUrl).catch(() => null);
    if (html) {
      const phone = pickPlausiblePhone(
        extractPhonesFromHtml(html, { trustTextRegex: false }),
        company.orgnr
      );
      if (phone) {
        candidates.push({ phone, score: 58, fromPlaces: false });
      }
    }
  }

  const places = await discoverFromSerperPlaces(company, options?.userId).catch(
    () => null
  );
  if (places?.phone && phonePlausibleForCompany(places.phone, company.orgnr)) {
    candidates.push({
      phone: places.phone,
      score: 50 + (places.confidence === "high" ? 10 : 0),
      fromPlaces: true,
    });
  }

  for (const query of queries) {
    let hits: SearchHit[];
    try {
      hits = await searchSerper(query, {
        num: GOOGLE_SERP_NUM,
        userId: options?.userId,
      });
    } catch (err) {
      if (err instanceof SerperLimitReachedError) throw err;
      continue;
    }

    for (const hit of hits) {
      const text = `${hit.title} ${hit.snippet ?? ""} ${hit.link}`;
      for (const phone of extractPhonesFromText(text)) {
        if (!phonePlausibleForCompany(phone, company.orgnr)) continue;
        const score = scorePhoneCandidate(
          hit,
          phone,
          company,
          options?.websiteDomain
        );
        candidates.push({ phone, score, fromPlaces: false });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return { phone: null, confidence: null, source: null, queries };
  }

  return {
    phone: best.phone,
    confidence:
      best.score >= 40 ? "high" : best.score >= 20 ? "medium" : "low",
    source: best.fromPlaces ? "places" : "organic",
    queries,
  };
}

export type SerperWebsiteSearchResult = {
  hits: SearchHit[];
  queries: string[];
};

/** Organisk Serper /search optimalisert for å finne firmets offisielle nettside. */
export async function searchSerperForWebsite(
  company: Pick<
    WebsiteScanCompanyInput,
    "name" | "municipality_name" | "city" | "industry_code"
  >,
  options?: { userId?: string; maxQueries?: number }
): Promise<SerperWebsiteSearchResult> {
  const queries = buildWebsiteSearchQueries(company).slice(
    0,
    options?.maxQueries ?? SERPER_WEBSITE_MAX_QUERIES
  );
  if (!queries.length) {
    return { hits: [], queries: [] };
  }

  const allHits: SearchHit[] = [];
  const usedQueries: string[] = [];

  for (const q of queries) {
    usedQueries.push(q);
    try {
      const batch = await searchSerper(q, {
        num: GOOGLE_SERP_NUM,
        userId: options?.userId,
      });
      allHits.push(...batch);
    } catch (err) {
      if (err instanceof SerperLimitReachedError) throw err;
      continue;
    }

    const merged = dedupeHits(allHits);
    const pick = pickBestWebsite(merged, company.name, {
      municipalityName: company.municipality_name ?? company.city,
    });
    if (isConfidentWebsitePick(pick, company.name)) {
      return { hits: merged, queries: usedQueries };
    }
  }

  return { hits: dedupeHits(allHits), queries: usedQueries };
}

export type SerperWebsiteDiscovery = {
  websiteUrl: string | null;
  websiteDomain: string | null;
  confidence: "high" | "medium" | "low";
  queries: string[];
  source: "organic" | "domain_guess" | "booking" | "none";
};

/**
 * Serper nettside + domene-gjetning når søk bare finner booking/katalog.
 * Speiler non-Serper pipeline (Google/DDG + domene-gjetning).
 */
export async function discoverWebsiteFromSerper(
  company: WebsiteScanCompanyInput,
  options?: { userId?: string; maxQueries?: number }
): Promise<SerperWebsiteDiscovery> {
  const { hits, queries } = await searchSerperForWebsite(company, options);
  const pick = pickBestWebsite(hits, company.name, {
    municipalityName: company.municipality_name ?? company.city,
  });

  const guessed = await discoverWebsiteByDomainGuess(company.name, {
    preferredTld: preferredTldFromPlace(primaryGeoPlace(company)),
  });

  if (pick.hasWebsite && pick.websiteKind === "own" && pick.websiteUrl) {
    const organicMeta = await fetchWebsitePageMetadata(pick.websiteUrl).catch(
      () => ({
        displayName: null,
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      })
    );
    const organicPlausible = websiteUrlPlausibleForCompany(
      pick.websiteUrl,
      company.name,
      organicMeta.displayName
    );

    if (guessed) {
      const brandCompact = norwegianDomainCompact(company.name);
      const guessCompact = compactAlnum(
        (guessed.websiteDomain.split(".")[0] ?? "")
      );
      const organicCompact = compactAlnum(
        (pick.websiteDomain?.split(".")[0] ?? "")
      );
      const preferGuess =
        (guessCompact.length >= 4 &&
          guessCompact === brandCompact &&
          guessCompact !== organicCompact) ||
        (guessed.websiteDomain.endsWith(".no") &&
          !pick.websiteDomain?.endsWith(".no") &&
          guessCompact.length >= 4 &&
          guessCompact === brandCompact);

      if (preferGuess) {
        const meta = await fetchWebsitePageMetadata(guessed.websiteUrl).catch(
          () => ({
            displayName: null,
            facebookUrl: null,
            instagramUrl: null,
            linkedinUrl: null,
          })
        );
        if (
          websiteUrlPlausibleForCompany(
            guessed.websiteUrl,
            company.name,
            meta.displayName
          )
        ) {
          return {
            websiteUrl: guessed.websiteUrl,
            websiteDomain: guessed.websiteDomain,
            confidence: "high",
            queries,
            source: "domain_guess",
          };
        }
      }
    }

    if (organicPlausible) {
      return {
        websiteUrl: pick.websiteUrl,
        websiteDomain: pick.websiteDomain,
        confidence: pick.confidence,
        queries,
        source: "organic",
      };
    }
  }

  if (guessed) {
    const meta = await fetchWebsitePageMetadata(guessed.websiteUrl).catch(
      () => ({
        displayName: null,
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      })
    );
    if (
      websiteUrlPlausibleForCompany(
        guessed.websiteUrl,
        company.name,
        meta.displayName
      )
    ) {
      return {
        websiteUrl: guessed.websiteUrl,
        websiteDomain: guessed.websiteDomain,
        confidence: "high",
        queries,
        source: "domain_guess",
      };
    }
  }

  if (pick.websiteUrl) {
    return {
      websiteUrl: pick.websiteUrl,
      websiteDomain: pick.websiteDomain,
      confidence: pick.confidence,
      queries,
      source: pick.websiteKind === "booking_only" ? "booking" : "organic",
    };
  }

  return {
    websiteUrl: null,
    websiteDomain: null,
    confidence: "low",
    queries,
    source: "none",
  };
}
