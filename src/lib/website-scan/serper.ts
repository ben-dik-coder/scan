import {
  assertSerperQuota,
  recordSerperApiCall,
  SerperLimitReachedError,
} from "@/lib/billing/serper-usage";
import {
  buildWebsiteSearchQueries,
  dedupeHits,
  type SearchHit,
} from "./parse-results";
import { GOOGLE_SERP_NUM, SERPER_WEBSITE_MAX_QUERIES } from "./scan-api-budget";
import type { WebsiteScanCompanyInput } from "./types";

type SerperOrganic = {
  title?: string;
  link?: string;
  url?: string;
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
      return { title, link };
    })
    .filter((item): item is SearchHit => item !== null);
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
