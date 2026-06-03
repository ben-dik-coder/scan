import {
  normalizeFacebookUrl,
  normalizeInstagramUrl,
} from "@/lib/website-scan/social-profiles";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 180_000;

export type WebsitePageMetadata = {
  displayName: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function cleanTitle(raw: string): string {
  let title = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  if (!title) return "";

  const separators = [" | ", " – ", " — ", " - ", " · "];
  for (const sep of separators) {
    const parts = title.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      title = parts[0]!;
      break;
    }
  }

  return title.slice(0, 120);
}

function extractMetaSiteName(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']application-name["']/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const cleaned = cleanTitle(m[1]);
      if (cleaned.length >= 2) return cleaned;
    }
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  const cleaned = cleanTitle(m[1]);
  return cleaned.length >= 2 ? cleaned : null;
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m?.[1]) return null;
  const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 2 && text.length <= 80 ? text : null;
}

/** Finn alle rå lenker til Facebook/Instagram i HTML (footer, header, JSON-LD). */
function extractRawSocialUrls(html: string): {
  facebook: string[];
  instagram: string[];
} {
  const facebook: string[] = [];
  const instagram: string[] = [];
  const seenFb = new Set<string>();
  const seenIg = new Set<string>();

  const patterns = [
    /https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.com|fb\.me)\/[^\s"'<>\\]+/gi,
    /https?:\/\/(?:[\w-]+\.)?instagram\.com\/[^\s"'<>\\]+/gi,
    /(?:https?:)?\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.com)\/[^\s"'<>\\]+/gi,
    /(?:https?:)?\/\/(?:[\w-]+\.)?instagram\.com\/[^\s"'<>\\]+/gi,
  ];

  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      let raw = m[0]!.replace(/\\u0026/g, "&").replace(/&amp;/gi, "&");
      if (!raw.startsWith("http")) raw = `https:${raw}`;

      if (/facebook|fb\.com|fb\.me/i.test(raw)) {
        const norm = normalizeFacebookUrl(raw);
        if (norm && !seenFb.has(norm)) {
          seenFb.add(norm);
          facebook.push(norm);
        }
      } else if (/instagram/i.test(raw)) {
        const norm = normalizeInstagramUrl(raw);
        if (norm && !seenIg.has(norm)) {
          seenIg.add(norm);
          instagram.push(norm);
        }
      }
    }
  }

  return { facebook, instagram };
}

function pickBestSocialUrl(urls: string[]): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0]!;
  const scored = urls.map((url) => {
    let score = 0;
    if (!/\/(posts|photos|reel|reels|p)\//i.test(url)) score += 5;
    if (!/profile\.php/i.test(url)) score += 2;
    return { url, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.url;
}

export function parseWebsitePageMetadata(html: string): WebsitePageMetadata {
  const { facebook, instagram } = extractRawSocialUrls(html);
  return {
    displayName:
      extractMetaSiteName(html) ?? extractTitle(html) ?? extractH1(html),
    facebookUrl: pickBestSocialUrl(facebook),
    instagramUrl: pickBestSocialUrl(instagram),
  };
}

/** Hent visningsnavn + sosiale lenker fra firmas nettside (gratis, høy treffsikkerhet). */
export async function fetchWebsitePageMetadata(
  url: string
): Promise<WebsitePageMetadata> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; NyeFirmaBot/1.0; +https://nye-firma.no)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { displayName: null, facebookUrl: null, instagramUrl: null };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { displayName: null, facebookUrl: null, instagramUrl: null };
    }

    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;

    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (
        html.includes("</footer>") ||
        (html.includes("</head>") && html.includes("instagram.com"))
      ) {
        break;
      }
    }

    reader.cancel().catch(() => {});

    return parseWebsitePageMetadata(html);
  } catch {
    return { displayName: null, facebookUrl: null, instagramUrl: null };
  } finally {
    clearTimeout(timer);
  }
}
