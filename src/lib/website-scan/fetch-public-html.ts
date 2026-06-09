const FETCH_TIMEOUT_MS = 7_000;
const MAX_BYTES = 200_000;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; NyeFirmaBot/1.0; +https://nylead.no)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": DEFAULT_USER_AGENT,
};

function userAgentForUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (/1881\.no|gulesider\.no/i.test(host)) return BROWSER_USER_AGENT;
  } catch {
    /* ignore */
  }
  return DEFAULT_USER_AGENT;
}

/** Hent offentlig HTML (booking, katalog, kontakt-side) — gratis, ingen API. */
export async function fetchPublicHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const target = url.startsWith("http") ? url : `https://${url}`;

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        ...FETCH_HEADERS,
        "User-Agent": userAgentForUrl(target),
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;

    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }

    reader.cancel().catch(() => {});
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
