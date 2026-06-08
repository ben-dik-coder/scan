import { industrySearchKeyword } from "./industry-keywords";
import { companyGeoPlaces } from "@/lib/brreg/geo-place";

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
  "118.no",
  "180.no",
  "1850.no",
  "eniro.no",
  "180.no",
  "norske-bedrifter.no",
  "bizin.no",
  "kompass.com",
  "dnb.no",
  "1881.no",
  "hitta.se",
  "yellowpages.com",
  "tripadvisor.com",
  "tripadvisor.no",
  "trustpilot.com",
  "trustpilot.no",
  "glassdoor.com",
  "indeed.com",
  "finanstilsynet.no",
  "lex247.com",
  "unternehmensregister.de",
  "yelp.no",
  "eniro.se",
  "firmanett.no",
  "kart.gulesider.no",
  "kommune.no",
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
  "frisorportal.no",
  "timebestilling.no",
  "youbook.no",
  "webtimiser.no",
  "mitobooking.no",
  "nordicbooking.com",
  "noona.app",
  "noona.fi",
  "noona.is",
  "phorest.com",
  "phorest.me",
  "shortcut.no",
  "shortcuts.no",
  "acuityscheduling.com",
  "setmore.com",
  "appointedd.com",
  "bestilltime.no",
  "bestille.no",
  "easy-booking.no",
  "vagaro.com",
  "resengo.com",
  "g.page",
  "business.site",
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

/** For generiske enkeltord — «auto» i eidangerauto.no er ikke EF AUTO */
const GENERIC_DOMAIN_TOKENS = new Set([
  "auto",
  "bygg",
  "care",
  "cleantech",
  "consult",
  "energy",
  "group",
  "process",
  "holding",
  "partner",
  "service",
  "solutions",
  "system",
  "systems",
  "tech",
  "transport",
]);

/** Yrkes-/bransjeord i navn — «Ravine Sykler» kan ha domene bare «ravine» */
const DESCRIPTIVE_DOMAIN_TOKENS = new Set([
  "sykler",
  "sykkel",
  "frisor",
  "frisør",
  "bygg",
  "auto",
  "taxi",
  "transport",
  "renhold",
  "consulting",
  "holding",
]);

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

export function stripCompanySuffix(name: string): string {
  return name
    .trim()
    .replace(/\s+(as|asa|aps|da|sa|enk|ans|nuf|ba|sf)\s*$/i, "")
    .trim();
}

export function nameTokens(companyName: string): string[] {
  return stripCompanySuffix(companyName)
    .toLowerCase()
    .replace(/["']/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9æøå]/gi, ""))
    .filter((w) => w.length >= MIN_TOKEN_LEN && !COMPANY_SUFFIXES.has(w));
}

/** Første meningsfulle ord — for søk når merkenavn avviker fra Brreg-navn */
export function primarySearchTokens(companyName: string, max = 2): string[] {
  return nameTokens(companyName).slice(0, max);
}

export function compactAlnum(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]/gi, "");
}

/**
 * Sosial profil / sidetittel — alle navneord må finnes i selve profilnavnet,
 * ikke bare i URL eller «Headline Frisør Narvik» for «Narvik Frisør AS».
 */
export function companyMatchesProfileName(
  profileName: string,
  companyName: string
): boolean {
  const profileHay = compactAlnum(profileName);
  if (!profileHay) return false;

  const stripped = stripCompanySuffix(companyName);
  const strippedCompact = compactAlnum(stripped);
  if (strippedCompact.length >= 5 && profileHay.includes(strippedCompact)) {
    return true;
  }

  const tokens = nameTokens(companyName);
  if (tokens.length >= 2) {
    const [first, second] = [tokens[0]!, tokens[1]!];
    if (profileHay.includes(first + second)) return true;
    if (profileHay.startsWith(first) && tokens.every((t) => profileHay.includes(t))) {
      return true;
    }
    return false;
  }

  if (tokens.length === 1) {
    const t = tokens[0]!;
    return t.length >= 4 && profileHay.includes(t);
  }

  if (strippedCompact.length >= 5) {
    return profileHay.includes(strippedCompact);
  }

  return false;
}

/**
 * Treff må faktisk handle om dette firmaet — ikke bare «Bø» i «Bønes Spa».
 */
function linkMatchHaystack(link: string): string {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.replace(/^www\./i, "");
    const path = u.pathname.split("/").filter(Boolean).join("/");
    return compactAlnum(`${host}/${path}`);
  } catch {
    return compactAlnum(link);
  }
}

/** Kun domenenavn (ikke URL-sti) — tryggere enn path for flerords-match. */
function domainMatchHaystack(link: string): string {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.replace(/^www\./i, "");
    const base = host.split(".")[0] ?? host;
    return compactAlnum(base);
  } catch {
    return "";
  }
}

function allTokensInHaystack(tokens: string[], hay: string): boolean {
  return (
    hay.length >= 5 &&
    tokens.every((t) => hay.includes(compactAlnum(t)))
  );
}

export function companyMatchesResult(
  title: string,
  link: string,
  companyName: string
): boolean {
  const tokens = nameTokens(companyName);
  const titleHay = compactAlnum(title);
  const linkHay = link ? linkMatchHaystack(link) : "";
  const domainHay = link ? domainMatchHaystack(link) : "";
  const fullDomain = link ? normalizeDomain(link) : "";

  if (fullDomain && domainSimilarToCompany(fullDomain, companyName)) {
    return true;
  }

  if (tokens.length >= 2) {
    const titleMatch =
      titleHay && tokens.every((t) => titleHay.includes(compactAlnum(t)));
    if (titleMatch) {
      if (!link) return true;
      return domainSimilarToCompany(fullDomain, companyName);
    }
    if (allTokensInHaystack(tokens, domainHay)) return true;
    return false;
  }

  if (tokens.length === 1) {
    const t = compactAlnum(tokens[0]!);
    if (t.length < 4) return false;
    if (GENERIC_DOMAIN_TOKENS.has(t)) {
      return Boolean(fullDomain && domainSimilarToCompany(fullDomain, companyName));
    }
    if (titleHay.includes(t)) {
      if (!link) return true;
      return domainSimilarToCompany(fullDomain, companyName);
    }
    if (t.length < 5) return false;
    if (!link) return linkHay.includes(t);
    return (
      domainSimilarToCompany(fullDomain, companyName) && linkHay.includes(t)
    );
  }

  const compact = compactAlnum(stripCompanySuffix(companyName));
  if (compact.length < 5) return false;
  if (titleHay.includes(compact)) return true;
  return linkHay.includes(compact);
}

export function domainSimilarToCompany(
  domain: string,
  companyName: string
): boolean {
  const rawBase = (domain.split(".")[0] ?? "").toLowerCase();
  const base = rawBase.replace(/[^a-z0-9æøå]/gi, "");
  const baseWithHyphen = rawBase.replace(/[^a-z0-9æøå-]/gi, "");
  if (base.length < 4 && baseWithHyphen.length < 4) return false;

  const stripped = stripCompanySuffix(companyName);
  const companyCompact = compactAlnum(stripped);
  const strippedSlug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9æøå-]+/gi, "-")
    .replace(/^-|-$/g, "");

  if (strippedSlug.includes("-") && baseWithHyphen === strippedSlug) return true;

  if (/\bIT\s*$/i.test(stripped) && nameTokens(companyName).length === 1) {
    if (base !== companyCompact) return false;
  }
  if (base === companyCompact) return true;
  if (
    companyCompact.length >= 5 &&
    Math.abs(base.length - companyCompact.length) <= 2 &&
    (base.includes(companyCompact) || companyCompact.includes(base))
  ) {
    return true;
  }
  if (companyCompact.startsWith(base)) {
    if (base.length >= 8 && base.length >= companyCompact.length * 0.5) {
      return true;
    }
    if (base.length >= 10 && base.length >= companyCompact.length * 0.4) {
      return true;
    }
  }

  const tokens = nameTokens(companyName);
  const significant = tokens.filter(
    (t) => !GENERIC_DOMAIN_TOKENS.has(compactAlnum(t))
  );
  if (significant.length === 1) {
    const sig = compactAlnum(significant[0]!);
    if (sig.length >= 6 && base === sig) return true;
    if (base === companyCompact) return true;
  }

  const first = compactAlnum(tokens[0] ?? "");
  if (first.length >= 6 && base === first) {
    const suffix = companyCompact.slice(first.length);
    if (!suffix || suffix.length <= 4) return true;
  }

  const matchTokens = tokens.length > 3 ? primarySearchTokens(companyName, 2) : tokens;
  const matchSignificant = matchTokens.filter(
    (t) => !GENERIC_DOMAIN_TOKENS.has(compactAlnum(t))
  );
  if (matchSignificant.length >= 2) {
    if (matchSignificant.every((t) => base.includes(compactAlnum(t)))) {
      return true;
    }
  }
  if (matchTokens.length >= 2) {
    if (matchTokens.every((t) => base.includes(compactAlnum(t)))) return true;

    const first = compactAlnum(matchTokens[0]!);
    if (
      first.length >= 5 &&
      base === first &&
      companyCompact.startsWith(first) &&
      companyCompact.length > first.length
    ) {
      const suffix = companyCompact.slice(first.length);
      const suffixTokens = nameTokens(suffix);
      if (
        suffixTokens.length > 0 &&
        suffixTokens.every(
          (t) =>
            DESCRIPTIVE_DOMAIN_TOKENS.has(t) ||
            GENERIC_DOMAIN_TOKENS.has(compactAlnum(t))
        ) &&
        suffixTokens.some((t) => DESCRIPTIVE_DOMAIN_TOKENS.has(t))
      ) {
        return true;
      }
    }

    return false;
  }
  if (tokens.length === 1) {
    const t = compactAlnum(tokens[0]!);
    if (t.length < 5) return false;
    if (GENERIC_DOMAIN_TOKENS.has(t)) {
      return base === t || (base.startsWith(t) && base.length <= t.length + 2);
    }
    if (base === t) return true;
    if (
      Math.abs(base.length - t.length) <= 2 &&
      (base.includes(t) || t.includes(base))
    ) {
      return true;
    }
    return false;
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

function municipalityInText(text: string, municipalityName?: string | null): boolean {
  if (!municipalityName?.trim()) return false;
  const place = compactAlnum(municipalityName);
  if (place.length < 4) return false;
  return compactAlnum(text).includes(place);
}

function domainOnlyMatchesMunicipality(
  domain: string,
  municipalityName?: string | null
): boolean {
  const base = compactAlnum((domain.split(".")[0] ?? ""));
  const place = municipalityName ? compactAlnum(municipalityName) : "";
  return place.length >= 4 && base === place;
}

function scoreHit(
  domain: string,
  title: string,
  link: string,
  companyName: string,
  context?: { municipalityName?: string | null }
): ScoredHit | null {
  if (!domain || isNonOwnWebsiteDomain(domain)) return null;
  if (isListingPage(link)) return null;

  const strippedName = stripCompanySuffix(companyName);
  const matchesLegal = companyMatchesResult(title, link, companyName);
  const matchesStripped =
    strippedName !== companyName &&
    companyMatchesResult(title, link, strippedName);
  const domainMatchLegal = domainSimilarToCompany(domain, companyName);
  const domainMatchStripped =
    strippedName !== companyName &&
    domainSimilarToCompany(domain, strippedName);
  const domainMatch = domainMatchLegal || domainMatchStripped;
  const placeMatch = municipalityInText(`${title} ${link}`, context?.municipalityName);

  if (domainMatch && domainOnlyMatchesMunicipality(domain, context?.municipalityName)) {
    return null;
  }

  if (!matchesLegal && !matchesStripped && !domainMatch) return null;

  const tokens = nameTokens(companyName);
  const domainBase = (domain.split(".")[0] ?? "").replace(/[^a-z0-9æøå]/gi, "");
  let score = 0;
  let nameInDomain = false;

  if (domainMatch) {
    nameInDomain = true;
    score += 10;
  }

  for (const token of tokens) {
    const tc = compactAlnum(token);
    if (tc && domainBase.includes(tc)) {
      nameInDomain = true;
      score += 4;
    }
  }

  if (matchesLegal || matchesStripped) score += 4;
  else if (strongTitleMatch(title, strippedName)) score += 3;

  if (placeMatch) score += 3;
  if (looksLikeHomepage(link)) score += 2;
  if (domain.endsWith(".no")) score += 2;
  else if (domain.endsWith(".com")) score += 1;

  const primaryTokens = primarySearchTokens(companyName, 3);
  const titleHit = matchesLegal || matchesStripped;
  const allTokensInDomain =
    primaryTokens.length >= 2 &&
    allTokensInHaystack(primaryTokens, compactAlnum(domainBase));
  const acceptAsOwn =
    (titleHit && looksLikeHomepage(link)) ||
    (nameInDomain && titleHit) ||
    (allTokensInDomain && looksLikeHomepage(link)) ||
    (domainMatch && looksLikeHomepage(link));

  const minScore = domainMatch ? 8 : 10;
  if (!acceptAsOwn || score < minScore) return null;

  return { title, link, domain, score, nameInDomain };
}

function findBookingOnlyHit(
  hits: SearchHit[],
  companyName: string
): { link: string; domain: string; confidence: "high" | "medium" } | null {
  for (const h of hits) {
    const domain = normalizeDomain(h.link);
    if (!isBookingPlatformDomain(domain)) continue;
    // Booking-URL har ofte ikke firmanavn i domenet — stol på tittel når den matcher.
    if (
      !strongTitleMatch(h.title, companyName) &&
      !companyMatchesResult(h.title, h.link, companyName)
    ) {
      continue;
    }

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
  companyName: string,
  context?: { municipalityName?: string | null }
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
      return scoreHit(domain, h.title, h.link, companyName, context);
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
  city?: string | null;
  industry_code?: string | null;
}): string[] {
  const name = company.name.trim();
  const places = companyGeoPlaces(company);
  const stripped = stripCompanySuffix(name);
  const tokens = primarySearchTokens(name);
  const industryKw = industrySearchKeyword(company.industry_code) ?? undefined;

  const queries: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const key = q.toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };

  if (places.length > 0) {
    for (const place of places) {
      const brandTokens = nameTokens(name).filter((t) => t.length >= 5);
      for (const token of brandTokens.slice(0, 2)) {
        add(`${token} ${place}`);
        add(`${token} ${place} nettside`);
      }
      add(`${stripped} ${place}`);
      add(`${stripped} ${place} nettside`);
      const brandCompact = compactAlnum(stripped);
      if (brandCompact.length >= 5) {
        add(`${brandCompact} ${place}`);
      }
      add(`"${name}" ${place}`);
      add(`${name} ${place} nettside`);
      if (stripped !== name) {
        add(`"${stripped}" ${place}`);
      }
      if (tokens.length > 0) {
        add(`${tokens.join(" ")} ${place}${industryKw ? ` ${industryKw}` : ""}`);
      }
      if (industryKw) {
        add(`"${stripped}" ${place} ${industryKw}`);
      }
    }
  } else {
    add(`"${name}"`);
    add(`${name} nettside`);
    if (stripped !== name) {
      add(`"${stripped}"`);
      add(`${stripped} nettside`);
    }
    if (tokens.length > 0 && industryKw) {
      add(`${tokens.join(" ")} ${industryKw}`);
    }
  }

  return queries.slice(0, 8);
}

export function displayNameDiffersFromLegal(
  displayName: string | null | undefined,
  legalName: string
): boolean {
  if (!displayName?.trim()) return false;
  const display = compactAlnum(displayName);
  const legal = compactAlnum(stripCompanySuffix(legalName));
  if (display.length < 3 || legal.length < 3) return false;
  if (display === legal) return false;
  if (display.includes(legal) || legal.includes(display)) return false;
  return true;
}

export function buildSearchQuery(company: {
  name: string;
  municipality_name?: string | null;
}): string {
  return buildSearchQueries(company)[0]!;
}

/** Nettside-spørringer for Serper — enkle «Firmanavn Kommune»-søk først (som manuelt Google). */
export function buildWebsiteSearchQueries(company: {
  name: string;
  municipality_name?: string | null;
  city?: string | null;
  industry_code?: string | null;
}): string[] {
  const name = company.name.trim();
  const stripped = stripCompanySuffix(name);
  const places = companyGeoPlaces(company);
  const all = buildSearchQueries(company);
  const withNettside = all.filter((q) => /\bnettside\b/i.test(q));
  const withoutNettside = all.filter((q) => !/\bnettside\b/i.test(q));

  const queries: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const key = q.toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };

  if (places.length > 0) {
    for (const place of places) {
      add(`${stripped} ${place}`);
      if (name !== stripped) add(`${name} ${place}`);
    }
  } else {
    add(stripped);
    if (name !== stripped) add(name);
  }

  for (const q of withoutNettside) add(q);
  for (const q of withNettside) add(q);

  return queries;
}

/** Sjekker om URL faktisk hører til firmaet (domene eller sidetittel). */
export function websiteUrlPlausibleForCompany(
  websiteUrl: string,
  companyName: string,
  pageTitle?: string | null
): boolean {
  const domain = normalizeDomain(websiteUrl);
  if (!domain || isNonOwnWebsiteDomain(domain)) return false;
  if (domainSimilarToCompany(domain, companyName)) return true;
  if (pageTitle?.trim() && companyMatchesResult(pageTitle, websiteUrl, companyName)) {
    return true;
  }
  return companyMatchesResult("", websiteUrl, companyName);
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
