import type { SearchHit } from "./parse-results";

const DDG_TIMEOUT_MS = 20_000;
const DDG_MAX_RESULTS = 10;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function decodeDdgRedirect(href: string): string {
  try {
    const url = href.startsWith("http") ? href : `https:${href}`;
    const parsed = new URL(url);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return url;
  } catch {
    return href;
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseDdgHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  const patterns = [
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]*class='[^']*result-link[^']*'[^>]*href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null && hits.length < DDG_MAX_RESULTS) {
      const rawHref = match[1].replace(/&amp;/g, "&");
      const title = stripHtml(match[2]);
      const link = decodeDdgRedirect(rawHref);
      if (!title || !link || seen.has(link)) continue;
      seen.add(link);
      hits.push({ title, link });
    }
    if (hits.length > 0) break;
  }

  return hits;
}

/** Gratis nettsøk via DuckDuckGo HTML — ingen API-nøkkel. */
export async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DDG_TIMEOUT_MS);

  let res: Response;
  try {
    const params = new URLSearchParams({ q: query });
    res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html",
      },
      body: params.toString(),
      signal: controller.signal,
      next: { revalidate: 0 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("DuckDuckGo tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`DuckDuckGo feilet (${res.status})`);
  }

  const html = await res.text();
  return parseDdgHtml(html);
}
