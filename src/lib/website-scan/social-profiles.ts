import { websiteFromEmail } from "@/lib/website-scan/email-hint";
import { companyGeoPlaces } from "@/lib/brreg/geo-place";
import {
  facebookUrlHasForeignLocale,
  scoreFacebookSearchHit,
} from "@/lib/website-scan/facebook-geo";
import {
  companyMatchesProfileName,
  companyMatchesResult,
  compactAlnum,
  nameTokens,
  normalizeDomain,
  primarySearchTokens,
  stripCompanySuffix,
  type SearchHit,
} from "@/lib/website-scan/parse-results";

const MAX_SOCIAL_SEARCH_QUERIES = 8;

export type SocialLinkConfidence = "high" | "medium" | "low";

export type SocialUrlPick = {
  url: string | null;
  confidence: SocialLinkConfidence;
};

function addUniqueQuery(queries: string[], seen: Set<string>, q: string) {
  const key = q.toLowerCase().replace(/\s+/g, " ").trim();
  if (!key || seen.has(key)) return;
  seen.add(key);
  queries.push(q);
}

/** Delvis navnetreff når Brreg-navn er langt (f.eks. «Oslo Beauty Studio AS»). */
function partialCompanyMatch(
  title: string,
  link: string,
  companyName: string
): boolean {
  const tokens = nameTokens(companyName);
  if (tokens.length < 4) return false;
  const handle =
    socialHandleFromLink(link, "facebook") ??
    socialHandleFromLink(link, "instagram");
  const hay = compactAlnum(`${title} ${handle ?? ""}`);
  const matched = tokens.filter((t) => hay.includes(t)).length;
  const required = Math.ceil(tokens.length * 0.75);
  return matched >= required;
}

function socialHandleFromLink(
  link: string,
  platform: "facebook" | "instagram"
): string | null {
  const normalized =
    platform === "facebook"
      ? normalizeFacebookUrl(link)
      : normalizeInstagramUrl(link);
  if (!normalized) return null;
  try {
    const parts = new URL(normalized).pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0]!.toLowerCase();
    if (first === "pages" && parts[1]) return parts[1]!.toLowerCase();
    if (first === "people" && parts[1]) return parts[1]!.toLowerCase();
    if (first === "profile.php") return null;
    return first;
  } catch {
    return null;
  }
}

function handleMatchesCompany(handle: string, companyName: string): boolean {
  const normalized = handle.replace(/[._-]+/g, " ");
  return companyMatchesProfileName(normalized, companyName);
}

function socialHitMatchesCompany(
  hit: SearchHit,
  companyName: string,
  alternateNames?: string[]
): { match: boolean; strength: number; hadTitleMatch: boolean } {
  const stripped = stripCompanySuffix(companyName);
  const titleMatch = companyMatchesProfileName(hit.title, companyName);
  const strippedTitleMatch =
    stripped !== companyName && companyMatchesProfileName(hit.title, stripped);
  const legal = titleMatch;
  const strippedMatch = strippedTitleMatch;
  const partial = partialCompanyMatch(hit.title, hit.link, companyName);
  const fbHandle = socialHandleFromLink(hit.link, "facebook");
  const igHandle = socialHandleFromLink(hit.link, "instagram");
  const handle = fbHandle ?? igHandle;
  const slug =
    handle != null && handleMatchesCompany(handle, companyName);

  let altMatch = false;
  for (const alt of alternateNames ?? []) {
    if (
      companyMatchesProfileName(hit.title, alt) ||
      partialCompanyMatch(hit.title, hit.link, alt) ||
      (handle != null && handleMatchesCompany(handle, alt))
    ) {
      altMatch = true;
      break;
    }
  }

  const hadTitleMatch = titleMatch || strippedTitleMatch;

  if (!legal && !strippedMatch && !partial && !slug && !altMatch) {
    return { match: false, strength: 0, hadTitleMatch: false };
  }

  let strength = 0;
  if (titleMatch) strength += 6;
  if (strippedTitleMatch) strength += 5;
  if (legal) strength += 5;
  if (strippedMatch) strength += 4;
  if (slug) strength += 6;
  if (partial) strength += 2;
  if (altMatch) strength += 5;
  return { match: true, strength, hadTitleMatch };
}

/** Valider sosial URL (f.eks. fra nettside-scrape) mot firmanavn. */
export function socialUrlMatchesCompany(url: string, companyName: string): boolean {
  const { match, strength } = socialHitMatchesCompany(
    { title: "", link: url },
    companyName
  );
  return match && strength >= 6;
}

function strengthToConfidence(
  strength: number,
  hadTitleMatch: boolean
): SocialLinkConfidence {
  if (strength >= 10 && hadTitleMatch) return "high";
  if (strength >= 5) return "medium";
  return "low";
}

function geoScoreForPlaces(
  title: string,
  link: string,
  places: string[]
): number {
  if (places.length === 0) return scoreFacebookSearchHit(title, link, null);
  let best = -1;
  for (const place of places) {
    best = Math.max(best, scoreFacebookSearchHit(title, link, place));
  }
  return best;
}

function instagramGeoBonus(title: string, places: string[]): number {
  const hay = compactAlnum(title);
  let bonus = 0;
  for (const place of places) {
    if (hay.includes(compactAlnum(place))) bonus = Math.max(bonus, 3);
  }
  return bonus;
}

function emailDomainSearchHint(
  email: string | null | undefined,
  companyName: string
): string | null {
  const hint = websiteFromEmail(email, companyName);
  if (!hint) return null;
  const base = hint.websiteDomain.split(".")[0] ?? "";
  const slug = base.replace(/[^a-z0-9æøå]/gi, "");
  return slug.length >= 4 ? slug : null;
}

function isFacebookHost(domain: string): boolean {
  const d = domain.toLowerCase();
  return d === "facebook.com" || d.endsWith(".facebook.com") || d === "fb.com";
}

const FB_BLOCKED_PATH_PREFIXES = [
  "/login",
  "/home.php",
  "/sharer",
  "/share",
  "/l.php",
  "/dialog/",
  "/help",
  "/policies",
  "/legal",
];

const FB_BLOCKED_SEGMENTS = new Set([
  "groups",
  "watch",
  "marketplace",
  "gaming",
  "events",
  "reel",
  "reels",
  "hashtag",
  "stories",
  "notes",
  "photo.php",
  "story.php",
]);

/** Gjør Facebook-URL om til side-profil (ikke enkeltinnlegg). */
export function normalizeFacebookUrl(link: string): string | null {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.replace(/^(www\.|m\.|mbasic\.)/i, "").toLowerCase();
    if (!isFacebookHost(host)) return null;

    const path = u.pathname;
    if (FB_BLOCKED_PATH_PREFIXES.some((p) => path.startsWith(p))) return null;

    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    const first = parts[0]!.toLowerCase();
    if (FB_BLOCKED_SEGMENTS.has(first)) return null;

    if (first === "pages" && parts.length >= 2) {
      return `https://www.facebook.com/pages/${parts[1]}`;
    }

    if (first === "people") return null;

    if (first === "profile.php") {
      const id = u.searchParams.get("id");
      return id ? `https://www.facebook.com/profile.php?id=${id}` : null;
    }

    if (first === "p" || first === "posts" || first === "photos") return null;

    const pageSlug = parts[0]!;
    const sub = parts[1]?.toLowerCase();
    const pageSections = new Set([
      "posts",
      "about",
      "reviews",
      "services",
      "photos",
      "videos",
      "mentions",
      "community",
    ]);

    if (parts.length === 1 || (sub && pageSections.has(sub))) {
      return `https://www.facebook.com/${pageSlug}`;
    }

    return `https://www.facebook.com/${pageSlug}`;
  } catch {
    return null;
  }
}

export function extractFacebookProfile(
  hits: SearchHit[],
  companyName: string,
  municipalityName?: string | null,
  options?: { alternateNames?: string[] }
): string | null {
  return pickFacebookFromHits(hits, companyName, municipalityName, options).url;
}

export function pickFacebookFromHits(
  hits: SearchHit[],
  companyName: string,
  municipalityName?: string | null,
  options?: {
    alternateNames?: string[];
    geoPlaces?: string[];
  }
): SocialUrlPick {
  const seen = new Set<string>();
  let best: { url: string; score: number; hadTitleMatch: boolean } | null = null;
  const places =
    options?.geoPlaces ??
    (municipalityName?.trim() ? [municipalityName.trim()] : []);

  for (const h of hits) {
    const domain = normalizeDomain(h.link);
    if (!isFacebookHost(domain)) continue;
    if (facebookUrlHasForeignLocale(h.link)) continue;

    const { match, strength, hadTitleMatch } = socialHitMatchesCompany(
      h,
      companyName,
      options?.alternateNames
    );
    if (!match) continue;

    const geoScore = geoScoreForPlaces(h.title, h.link, places);
    if (geoScore < 0) continue;

    const url = normalizeFacebookUrl(h.link);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const score = strength + geoScore;
    if (!best || score > best.score) {
      best = { url, score, hadTitleMatch };
    }
  }

  if (!best) return { url: null, confidence: "low" };
  return {
    url: best.url,
    confidence: strengthToConfidence(best.score, best.hadTitleMatch),
  };
}

export function buildFacebookSearchQueries(
  company: {
    name: string;
    municipality_name?: string | null;
    city?: string | null;
    email?: string | null;
  },
  context?: {
    displayName?: string | null;
    websiteDomain?: string | null;
  }
): string[] {
  const name = company.name.trim();
  const places = companyGeoPlaces(company);
  const stripped = stripCompanySuffix(name);
  const tokens = primarySearchTokens(name, 3);
  const domainHint = emailDomainSearchHint(company.email, name);
  const websiteSlug = context?.websiteDomain?.split(".")[0]?.trim();
  const display = context?.displayName?.trim();
  const queries: string[] = [];
  const seen = new Set<string>();

  const addPlaceQueries = (place: string) => {
    addUniqueQuery(queries, seen, `${name} ${place} site:facebook.com`);
    addUniqueQuery(queries, seen, `${stripped} ${place} site:facebook.com`);
    if (tokens.length > 0) {
      addUniqueQuery(
        queries,
        seen,
        `${tokens.join(" ")} ${place} site:facebook.com`
      );
    }
    addUniqueQuery(queries, seen, `${stripped} ${place} facebook`);
    addUniqueQuery(queries, seen, `"${stripped}" ${place} facebook side`);
  };

  if (places.length > 0) {
    for (const place of places) addPlaceQueries(place);
  } else {
    addUniqueQuery(queries, seen, `${name} site:facebook.com`);
    addUniqueQuery(queries, seen, `${stripped} site:facebook.com`);
    addUniqueQuery(queries, seen, `${stripped} facebook Norge`);
  }

  if (stripped !== name) {
    addUniqueQuery(queries, seen, `"${stripped}" site:facebook.com`);
  }

  if (display && display !== name && display !== stripped) {
    for (const place of places) {
      addUniqueQuery(queries, seen, `${display} ${place} site:facebook.com`);
    }
    addUniqueQuery(queries, seen, `"${display}" site:facebook.com`);
  }

  if (domainHint) {
    addUniqueQuery(queries, seen, `${domainHint} site:facebook.com`);
    for (const place of places) {
      addUniqueQuery(
        queries,
        seen,
        `${domainHint} ${place} site:facebook.com`
      );
    }
  }

  if (websiteSlug && websiteSlug.length >= 4 && websiteSlug !== domainHint) {
    addUniqueQuery(queries, seen, `${websiteSlug} site:facebook.com`);
    for (const place of places) {
      addUniqueQuery(
        queries,
        seen,
        `${websiteSlug} ${place} site:facebook.com`
      );
    }
  }

  return queries.slice(0, MAX_SOCIAL_SEARCH_QUERIES);
}

/** @deprecated Bruk buildFacebookSearchQueries */
export function buildFacebookSearchQuery(company: {
  name: string;
  municipality_name?: string | null;
  email?: string | null;
}): string {
  return buildFacebookSearchQueries(company)[0]!;
}

function isInstagramHost(domain: string): boolean {
  const d = domain.toLowerCase();
  return d === "instagram.com" || d.endsWith(".instagram.com");
}

/** Gjør Instagram-URL om til profil-lenke (ikke enkeltinnlegg). */
export function normalizeInstagramUrl(link: string): string | null {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.replace(/^(www\.|m\.)/i, "").toLowerCase();
    if (!isInstagramHost(host)) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    const blocked = new Set(["p", "reel", "reels", "stories", "explore", "tv"]);
    const slug = parts[0]!.toLowerCase();
    if (blocked.has(slug)) return null;

    return `https://www.instagram.com/${parts[0]}/`;
  } catch {
    return null;
  }
}

export function extractInstagramProfile(
  hits: SearchHit[],
  companyName: string,
  municipalityName?: string | null,
  options?: { alternateNames?: string[] }
): string | null {
  return pickInstagramFromHits(hits, companyName, municipalityName, options).url;
}

export function pickInstagramFromHits(
  hits: SearchHit[],
  companyName: string,
  municipalityName?: string | null,
  options?: {
    alternateNames?: string[];
    geoPlaces?: string[];
  }
): SocialUrlPick {
  const seen = new Set<string>();
  let best: { url: string; score: number; hadTitleMatch: boolean } | null = null;
  const places =
    options?.geoPlaces ??
    (municipalityName?.trim() ? [municipalityName.trim()] : []);

  for (const h of hits) {
    const domain = normalizeDomain(h.link);
    if (!isInstagramHost(domain)) continue;

    const { match, strength, hadTitleMatch } = socialHitMatchesCompany(
      h,
      companyName,
      options?.alternateNames
    );
    if (!match) continue;

    const geoBonus = instagramGeoBonus(h.title, places);
    if (places.length > 0 && geoBonus === 0 && !hadTitleMatch) continue;

    const url = normalizeInstagramUrl(h.link);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const score = strength + geoBonus;

    if (!best || score > best.score) {
      best = { url, score, hadTitleMatch };
    }
  }

  if (!best) return { url: null, confidence: "low" };
  return {
    url: best.url,
    confidence: strengthToConfidence(best.score, best.hadTitleMatch),
  };
}

export function buildInstagramSearchQueries(
  company: {
    name: string;
    municipality_name?: string | null;
    city?: string | null;
    email?: string | null;
  },
  context?: {
    displayName?: string | null;
    websiteDomain?: string | null;
  }
): string[] {
  const name = company.name.trim();
  const places = companyGeoPlaces(company);
  const stripped = stripCompanySuffix(name);
  const tokens = primarySearchTokens(name, 3);
  const domainHint = emailDomainSearchHint(company.email, name);
  const websiteSlug = context?.websiteDomain?.split(".")[0]?.trim();
  const display = context?.displayName?.trim();
  const queries: string[] = [];
  const seen = new Set<string>();

  const addPlaceQueries = (place: string) => {
    addUniqueQuery(queries, seen, `${name} ${place} site:instagram.com`);
    addUniqueQuery(queries, seen, `${stripped} ${place} site:instagram.com`);
    if (tokens.length > 0) {
      addUniqueQuery(
        queries,
        seen,
        `${tokens.join(" ")} ${place} site:instagram.com`
      );
    }
    addUniqueQuery(queries, seen, `${stripped} ${place} instagram`);
    addUniqueQuery(queries, seen, `"${stripped}" ${place} instagram`);
  };

  if (places.length > 0) {
    for (const place of places) addPlaceQueries(place);
  } else {
    addUniqueQuery(queries, seen, `${name} site:instagram.com`);
    addUniqueQuery(queries, seen, `${stripped} site:instagram.com`);
  }

  if (display && display !== name && display !== stripped) {
    for (const place of places) {
      addUniqueQuery(queries, seen, `${display} ${place} site:instagram.com`);
    }
    addUniqueQuery(queries, seen, `"${display}" site:instagram.com`);
  }

  if (domainHint) {
    addUniqueQuery(queries, seen, `${domainHint} site:instagram.com`);
    for (const place of places) {
      addUniqueQuery(
        queries,
        seen,
        `${domainHint} ${place} site:instagram.com`
      );
    }
  }

  if (websiteSlug && websiteSlug.length >= 4 && websiteSlug !== domainHint) {
    addUniqueQuery(queries, seen, `${websiteSlug} site:instagram.com`);
    for (const place of places) {
      addUniqueQuery(
        queries,
        seen,
        `${websiteSlug} ${place} site:instagram.com`
      );
    }
  }

  return queries.slice(0, MAX_SOCIAL_SEARCH_QUERIES);
}

/** @deprecated Bruk buildInstagramSearchQueries */
export function buildInstagramSearchQuery(company: {
  name: string;
  municipality_name?: string | null;
  email?: string | null;
}): string {
  return buildInstagramSearchQueries(company)[0]!;
}

export function demoInstagramUrl(
  company: { orgnr: string; name: string }
): string | null {
  const n = parseInt(company.orgnr.slice(-2), 10);
  if (Number.isNaN(n) || n % 4 !== 0) return null;
  const slug = company.name
    .toLowerCase()
    .replace(/\s+(as|asa|da|sa|enk)\s*$/i, "")
    .replace(/[^a-z0-9æøå]+/gi, "")
    .slice(0, 22);
  if (slug.length < 4) return null;
  return `https://www.instagram.com/${slug}/`;
}

/** Demo: tilfeldig men stabil «Facebook» for noen firma i demo-modus */
export function demoFacebookUrl(
  company: { orgnr: string; name: string }
): string | null {
  const n = parseInt(company.orgnr.slice(-2), 10);
  if (Number.isNaN(n) || n % 3 !== 0) return null;
  const slug = company.name
    .toLowerCase()
    .replace(/\s+(as|asa|da|sa|enk)\s*$/i, "")
    .replace(/[^a-z0-9æøå]+/gi, "")
    .slice(0, 24);
  if (slug.length < 4) return null;
  return `https://www.facebook.com/${slug}`;
}
