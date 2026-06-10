import {
  assertSerperQuota,
  recordSerperApiCall,
  SerperLimitReachedError,
} from "@/lib/billing/serper-usage";
import { companyGeoPlaces } from "@/lib/brreg/geo-place";
import {
  buildWebsiteSearchQueries,
  compactAlnum,
  dedupeHits,
  stripCompanySuffix,
  type SearchHit,
} from "./parse-results";
import {
  extractPhoneFromText,
  phonePlausibleForCompany,
} from "./phone-plausible";
import {
  GOOGLE_SERP_NUM,
  SERPER_PHONE_MAX_QUERIES,
  SERPER_WEBSITE_MAX_QUERIES,
} from "./scan-api-budget";
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
  options?: { num?: number; userId?: string }
): Promise<SearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Serper er ikke konfigurert");
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

  return (data.organic ?? [])
    .map((item) => {
      const link = serperOrganicLink(item);
      const title = item.title?.trim();
      if (!title || !link) return null;
      const snippet = item.snippet?.trim();
      return snippet ? { title, link, snippet } : { title, link };
    })
    .filter((item): item is SearchHit => item !== null);
}

export function buildPhoneSearchQueries(
  company: Pick<
    WebsiteScanCompanyInput,
    "name" | "orgnr" | "municipality_name" | "city"
  >
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
      add(`"${stripped}" ${geo} site:1881.no`);
      add(`"${stripped}" ${geo} site:gulesider.no`);
    } else {
      add(`"${stripped}" telefon`);
      add(`${stripped} telefon Norge`);
    }
    const compact = compactAlnum(stripped);
    if (compact.length >= 5 && geo) {
      add(`${compact} ${geo} telefon`);
    }
  }

  add(`${company.orgnr} telefon`);
  return queries.slice(0, SERPER_PHONE_MAX_QUERIES);
}

export type SerperPhoneDiscovery = {
  phone: string | null;
  confidence: "high" | "medium" | "low" | null;
  source: "places" | "organic" | null;
  queries: string[];
};

/** Serper Places først, deretter organisk søk med telefon i query + snippet-parsing. */
export async function discoverPhoneFromSerper(
  company: WebsiteScanCompanyInput,
  options?: { userId?: string }
): Promise<SerperPhoneDiscovery> {
  const places = await discoverFromSerperPlaces(company, options?.userId).catch(
    () => null
  );
  if (places?.phone && phonePlausibleForCompany(places.phone, company.orgnr)) {
    return {
      phone: places.phone,
      confidence: places.confidence,
      source: "places",
      queries: [],
    };
  }

  const queries = buildPhoneSearchQueries(company);
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
      const phone = extractPhoneFromText(text);
      if (phone && phonePlausibleForCompany(phone, company.orgnr)) {
        return {
          phone,
          confidence: "medium",
          source: "organic",
          queries,
        };
      }
    }
  }

  return { phone: null, confidence: null, source: null, queries };
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

  const batches = await Promise.all(
    queries.map(async (q) => {
      try {
        return await searchSerper(q, {
          num: GOOGLE_SERP_NUM,
          userId: options?.userId,
        });
      } catch (err) {
        if (err instanceof SerperLimitReachedError) throw err;
        return [] as SearchHit[];
      }
    })
  );

  return { hits: dedupeHits(batches.flat()), queries };
}
