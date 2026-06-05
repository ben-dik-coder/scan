const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 200_000;

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "Mozilla/5.0 (compatible; NyeFirmaBot/1.0; +https://nylead.no)",
};

/** Hent offentlig HTML (booking, katalog, kontakt-side) — gratis, ingen API. */
export async function fetchPublicHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
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
