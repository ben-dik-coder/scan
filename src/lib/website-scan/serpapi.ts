import type { SearchHit } from "./parse-results";

type SerpOrganic = {
  title?: string;
  link?: string;
};

type SerpApiResponse = {
  organic_results?: SerpOrganic[];
  error?: string;
};

const SERPAPI_TIMEOUT_MS = 20_000;

export async function searchSerpApi(
  query: string,
  options?: { num?: number }
): Promise<SearchHit[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SerpAPI er ikke konfigurert");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: query,
    gl: "no",
    hl: "no",
    google_domain: "google.no",
    num: String(Math.min(20, Math.max(5, options?.num ?? 10))),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("SerpAPI tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json()) as SerpApiResponse;

  if (!res.ok) {
    throw new Error(data.error ?? `SerpAPI feilet (${res.status})`);
  }

  return (data.organic_results ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!,
      link: item.link!,
    }));
}
