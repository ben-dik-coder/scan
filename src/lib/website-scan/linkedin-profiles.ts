const BLOCKED_LINKEDIN_SEGMENTS = new Set([
  "in",
  "pub",
  "posts",
  "pulse",
  "feed",
  "jobs",
  "learning",
  "login",
  "signup",
  "search",
  "share",
  "groups",
  "events",
  "school",
]);

function isLinkedInHost(host: string): boolean {
  const h = host.replace(/^(www\.|m\.|[\w-]+\.)/i, "").toLowerCase();
  return h === "linkedin.com" || h.endsWith(".linkedin.com");
}

/** Kun bedriftssider (/company/), ikke personprofiler (/in/). */
export function normalizeLinkedInCompanyUrl(link: string): string | null {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.replace(/^(www\.|m\.)/i, "").toLowerCase();
    if (!isLinkedInHost(host)) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const section = parts[0]!.toLowerCase();
    if (section !== "company") return null;
    if (BLOCKED_LINKEDIN_SEGMENTS.has(section)) return null;

    const slug = parts[1]!;
    if (!slug || slug.length < 2) return null;

    return `https://www.linkedin.com/company/${slug}/`;
  } catch {
    return null;
  }
}

export function isLinkedInCompanyUrl(url: string): boolean {
  return normalizeLinkedInCompanyUrl(url) != null;
}

/** Velg beste LinkedIn company-URL fra en liste (f.eks. HTML-lenker). */
export function pickBestLinkedInUrl(urls: string[]): string | null {
  const seen = new Set<string>();
  let best: { url: string; score: number } | null = null;

  for (const raw of urls) {
    const normalized = normalizeLinkedInCompanyUrl(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    let score = 5;
    if (/\/company\//i.test(normalized)) score += 3;
    if (!/\/(posts|jobs)\//i.test(raw)) score += 2;

    if (!best || score > best.score) {
      best = { url: normalized, score };
    }
  }

  return best?.url ?? null;
}
