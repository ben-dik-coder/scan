const DIRECTORY_DOMAINS = [
  "brreg.no",
  "proff.no",
  "gulesider.no",
  "1881.no",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "allabolag.se",
  "purehelp.no",
  "firmalene.no",
  "daa.no",
  "google.com",
  "google.no",
  "youtube.com",
  "wikipedia.org",
  "finn.no",
  "yelp.com",
  "tiktok.com",
  "pinterest.com",
  "regnskapstall.no",
  "roller.no",
  "virksomhet.brreg.no",
  "kartverket.no",
  "ssb.no",
  "altinn.no",
  "klikk.no",
  "degulesider.no",
  "data.brreg.no",
];

const HOSTED_PLATFORM_DOMAINS = [
  "wordpress.com",
  "wix.com",
  "wixsite.com",
  "squarespace.com",
  "weebly.com",
  "blogspot.com",
  "medium.com",
];

const BOOKING_PLATFORM_DOMAINS = [
  "timma.no",
  "timma.com",
  "fixit.no",
  "fixitonline.no",
  "oss.fixitonline.no",
  "onlinebooq.com",
  "onlinebooq.no",
  "ledigtime.no",
  "ledigtime.com",
  "booksalon.no",
  "fresha.com",
  "treatwell.no",
  "treatwell.com",
  "easypractice.net",
  "easypractice.dk",
  "easypractice.com",
  "simplybook.me",
  "simplybook.it",
  "zupport.no",
  "minbestilling.no",
  "timebestilling.com",
  "planway.com",
  "bookio.com",
  "timetail.com",
  "timetail.no",
  "onlinebooking.dk",
  "salongdata.no",
  "bookeo.com",
  "calendly.com",
  "booksy.com",
];

const COMPANY_SUFFIXES = new Set([
  "as",
  "asa",
  "da",
  "sa",
  "enk",
  "ans",
  "nuf",
  "ba",
  "sf",
]);

const LISTING_PATH_RE =
  /\/(selskap|company|bedrift|profil|profile|artikkel|nyhet|news|wiki|register|enhet|organization)/i;

/** Korte ord som «bø» matcher feil (Bønes Spa ≠ Bø Pæng) */
const MIN_TOKEN_LEN = 3;

export type WebsiteKind = "own" | "booking_only" | "none";

export type SearchHit = { title: string; link: string };

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isDirectoryDomain(domain: string): boolean {
  if (!domain) return true;
  return DIRECTORY_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  );
}

export function isHostedPlatformDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return HOSTED_PLATFORM_DOMAINS.some(
    (h) => d === h || d.endsWith(`.${h}`)
  );
}

export function isBookingPlatformDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return BOOKING_PLATFORM_DOMAINS.some(
    (b) => d === b || d.endsWith(`.${b}`)
  );
}

export function isNonOwnWebsiteDomain(domain: string): boolean {
  return (
    isDirectoryDomain(domain) ||
    isBookingPlatformDomain(domain) ||
    isHostedPlatformDomain(domain)
  );
}

export function nameTokens(companyName: string): string[] {
  return companyName
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+(as|asa|da|sa|enk|ans|nuf)\s*$/i, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9æøå]/gi, ""))
    .filter((w) => w.length >= MIN_TOKEN_LEN && !COMPANY_SUFFIXES.has(w));
}

export function compactAlnum(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9æøå]/gi, "");
}

/**
 * Treff må faktisk handle om dette firmaet — ikke bare «Bø» i «Bønes Spa».
 */
export function companyMatchesResult(
  title: string,
  link: string,
  companyName: string
): boolean {
  const tokens = nameTokens(companyName);
  const hay = compactAlnum(`${title} ${link}`);

  if (tokens.length >= 2) {
    return tokens.every((t) => hay.includes(t));
  }

  if (tokens.length === 1) {
    const t = tokens[0]!;
    if (t.length < 4) return false;
    return hay.includes(t);
  }

  const compact = compactAlnum(companyName);
  if (compact.length < 5) return false;
  return hay.includes(compact);
}

export function domainSimilarToCompany(
  domain: string,
  companyName: string
): boolean {
  const base = (domain.split(".")[0] ?? "").replace(/[^a-z0-9æøå]/gi, "");
  if (base.length < 4) return false;

  const companyCompact = compactAlnum(companyName);
  if (companyCompact.length >= 5 && base.includes(companyCompact)) {
    return true;
  }
  if (companyCompact.length >= 6 && companyCompact.includes(base)) {
    return true;
  }

  const tokens = nameTokens(companyName);
  if (tokens.length >= 2) {
    return tokens.every((t) => base.includes(t));
  }
  if (tokens.length === 1) {
    const t = tokens[0]!;
    return t.length >= 4 && base.includes(t);
  }

  return false;
}

function strongTitleMatch(title: string, companyName: string): boolean {
  return companyMatchesResult(title, "", companyName);
}

function looksLikeHomepage(link: string): boolean {
  try {
    const path = new URL(link.startsWith("http") ? link : `https://${link}`)
      .pathname;
    if (path === "/" || path === "") return true;
    return path.split("/").filter(Boolean).length <= 1;
  } catch {
    return false;
  }
}

function isListingPage(link: string): boolean {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    return LISTING_PATH_RE.test(u.pathname);
  } catch {
    return false;
  }
}

type ScoredHit = SearchHit & {
  domain: string;
  score: number;
  nameInDomain: boolean;
};

function scoreHit(
  domain: string,
  title: string,
  link: string,
  companyName: string
): ScoredHit | null {
  if (!domain || isNonOwnWebsiteDomain(domain)) return null;
  if (isListingPage(link)) return null;
  if (!companyMatchesResult(title, link, companyName)) return null;

  const tokens = nameTokens(companyName);
  const domainBase = (domain.split(".")[0] ?? "").replace(/[^a-z0-9æøå]/gi, "");
  let score = 0;
  let nameInDomain = false;

  if (domainSimilarToCompany(domain, companyName)) {
    nameInDomain = true;
    score += 10;
  }

  for (const token of tokens) {
    if (domainBase.includes(token)) {
      nameInDomain = true;
      score += 4;
    }
  }

  if (strongTitleMatch(title, companyName)) score += 4;
  if (looksLikeHomepage(link)) score += 2;
  if (domain.endsWith(".no") || domain.endsWith(".com")) score += 1;

  const acceptAsOwn =
    nameInDomain || (strongTitleMatch(title, companyName) && looksLikeHomepage(link));

  if (!acceptAsOwn || score < 6) return null;

  return { title, link, domain, score, nameInDomain };
}

function findBookingOnlyHit(
  hits: SearchHit[],
  companyName: string
): { link: string; domain: string; confidence: "high" | "medium" } | null {
  for (const h of hits) {
    const domain = normalizeDomain(h.link);
    if (!isBookingPlatformDomain(domain)) continue;
    if (!companyMatchesResult(h.title, h.link, companyName)) continue;

    const slugMatch =
      /timma\.no\/salong\/([^/?#]+)/i.test(h.link) &&
      companyMatchesResult(h.title, h.link.split("/salong/")[1] ?? "", companyName);

    return {
      link: h.link,
      domain,
      confidence: slugMatch || strongTitleMatch(h.title, companyName) ? "high" : "medium",
    };
  }
  return null;
}

export function pickBestWebsite(
  hits: SearchHit[],
  companyName: string
): {
  hasWebsite: boolean;
  websiteKind: WebsiteKind;
  websiteUrl: string | null;
  websiteDomain: string | null;
  bookingPlatform: string | null;
  topHits: Array<{ title: string; link: string; domain: string }>;
  confidence: "high" | "medium" | "low";
} {
  const topHits = hits.slice(0, 8).map((h) => ({
    title: h.title,
    link: h.link,
    domain: normalizeDomain(h.link),
  }));

  const analyzed = hits
    .map((h) => {
      const domain = normalizeDomain(h.link);
      return scoreHit(domain, h.title, h.link, companyName);
    })
    .filter((h): h is ScoredHit => h !== null)
    .sort((a, b) => b.score - a.score);

  const best = analyzed[0];
  if (best) {
    const confidence: "high" | "medium" | "low" =
      best.nameInDomain && best.score >= 10
        ? "high"
        : best.nameInDomain
          ? "medium"
          : "low";

    return {
      hasWebsite: true,
      websiteKind: "own",
      websiteUrl: best.link,
      websiteDomain: best.domain,
      bookingPlatform: null,
      topHits,
      confidence,
    };
  }

  const booking = findBookingOnlyHit(hits, companyName);
  if (booking) {
    return {
      hasWebsite: false,
      websiteKind: "booking_only",
      websiteUrl: booking.link,
      websiteDomain: booking.domain,
      bookingPlatform: booking.domain,
      topHits,
      confidence: booking.confidence,
    };
  }

  return {
    hasWebsite: false,
    websiteKind: "none",
    websiteUrl: null,
    websiteDomain: null,
    bookingPlatform: null,
    topHits,
    confidence: "low",
  };
}

export function buildSearchQueries(company: {
  name: string;
  municipality_name?: string | null;
}): string[] {
  const name = company.name.trim();
  const place = company.municipality_name?.trim();

  if (place) {
    return [`"${name}" ${place}`, `${name} ${place} nettside`];
  }

  return [`"${name}"`, `${name} nettside`];
}

export function buildSearchQuery(company: {
  name: string;
  municipality_name?: string | null;
}): string {
  return buildSearchQueries(company)[0]!;
}

export function hasUncertainWebsiteHits(
  topHits: Array<{ link: string; domain?: string; title?: string }> | undefined,
  companyName?: string
): boolean {
  if (!topHits?.length || !companyName) return false;
  return topHits.some((h) => {
    const domain = h.domain || normalizeDomain(h.link);
    if (!domain || isNonOwnWebsiteDomain(domain)) return false;
    if (isBookingPlatformDomain(domain)) return false;
    return !companyMatchesResult(h.title ?? "", h.link, companyName);
  });
}

export function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const key = h.link.split("#")[0]?.toLowerCase() ?? h.link;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
