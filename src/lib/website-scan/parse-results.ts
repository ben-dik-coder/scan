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
  "beauty",
  "bygg",
  "care",
  "cleantech",
  "consult",
  "design",
  "digital",
  "energy",
  "group",
  "holding",
  "media",
  "partner",
  "process",
  "salong",
  "service",
  "solutions",
  "studio",
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

/** Bransjeord som ofte avslutter merkenavn før eiernavn i Brreg (tattoo, frisør …). */
const BRAND_OWNER_INDUSTRY_WORDS = new Set([
  "tattoo",
  "tattoos",
  "frisor",
  "frisør",
  "salon",
  "salong",
  "barber",
  "barbershop",
  "spa",
  "massasje",
  "studio",
  "beauty",
  "skjonnhet",
  "skjønnhet",
  "negler",
  "nails",
  "klinikk",
  "velvaere",
  "velvære",
  "cuts",
  "ink",
]);

const APOSTROPHE_CHARS = /[''`´]/g;

/** Brreg bruker ofte rette apostrofer — normaliser til ASCII. */
export function normalizeApostropheChars(text: string): string {
  return text.replace(APOSTROPHE_CHARS, "'");
}

/**
 * Brreg «SUNDBY 'S» / «ANGELL'S» → «SUNDBY'S» før søk og matching.
 * Beholder O'Brien-stil (bokstav + apostrof + navn).
 */
export function normalizePossessiveSpacing(name: string): string {
  let s = normalizeApostropheChars(name);
  s = s.replace(/(\S)\s+'s\b/gi, "$1's");
  return s;
}

function mergePossessiveTokens(words: string[]): string[] {
  const merged: string[] = [];
  for (const word of words) {
    if (/^'s$/i.test(word) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}s`;
      continue;
    }
    merged.push(word);
  }
  return merged;
}

function normalizeNameToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9æøå]/gi, "");
}

function rawNameTokens(name: string): string[] {
  const words = normalizePossessiveSpacing(stripCompanySuffix(name))
    .split(/\s+/)
    .map((w) => w.replace(/"/g, ""))
    .filter(Boolean);
  return mergePossessiveTokens(words).map((w) => w.replace(/'/g, ""));
}

function titleCaseWord(word: string): string {
  if (word.includes("'")) {
    return word
      .split("'")
      .map((part, i) => {
        if (!part) return part;
        if (i > 0 && /^s$/i.test(part)) return "s";
        if (part.length === 1) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("'");
  }
  if (/^(og|i|o|og|av|by|the|and)$/i.test(word)) {
    return word.toLowerCase();
  }
  if (word.length <= 2 && /^[a-zæøå]+$/i.test(word)) {
    return word.toUpperCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Brreg-navn som «SHIP O HOI TATTOO REMY ANDRE …» → merkenavn «SHIP O HOI TATTOO». */
export function extractBrandPortion(companyName: string): string | null {
  const tokens = rawNameTokens(companyName);
  if (tokens.length < 3) return null;

  const normalized = tokens.map(normalizeNameToken);

  let industryIdx = -1;
  for (let i = 0; i < normalized.length; i++) {
    if (BRAND_OWNER_INDUSTRY_WORDS.has(normalized[i]!)) {
      industryIdx = i;
    }
  }
  // Ett ord etter bransje/studio (f.eks. «NØYA NAILS STUDIO VOROTYNTSEVA») er ofte eiernavn.
  if (industryIdx >= 0 && industryIdx < tokens.length - 1) {
    return tokens.slice(0, industryIdx + 1).join(" ");
  }

  const byIdx = normalized.indexOf("by");
  if (byIdx >= 1 && byIdx < tokens.length - 1) {
    return tokens.slice(0, byIdx).join(" ");
  }

  if (tokens.length >= 6) {
    const tailLen = Math.min(4, Math.floor(tokens.length / 2));
    const headLen = tokens.length - tailLen;
    const headHasIndustry = normalized
      .slice(0, headLen)
      .some((t) => BRAND_OWNER_INDUSTRY_WORDS.has(t));
    const tailIsPlain = normalized
      .slice(headLen)
      .every((t) => t.length >= 2 && !BRAND_OWNER_INDUSTRY_WORDS.has(t));
    if (headHasIndustry && tailIsPlain && headLen >= 2) {
      return tokens.slice(0, headLen).join(" ");
    }
  }

  return null;
}

export function toTitleCaseName(name: string): string {
  return normalizePossessiveSpacing(name)
    .trim()
    .split(/\s+/)
    .map((word) => titleCaseWord(word))
    .join(" ");
}

/** Søkevarianter for sosiale profiler — merkenavn, uten AS, title case. */
export function companySearchNameVariants(companyName: string): string[] {
  const trimmed = normalizePossessiveSpacing(companyName.trim());
  const stripped = stripCompanySuffix(trimmed);
  const strippedTitle = toTitleCaseName(stripped);
  const brand = extractBrandPortion(trimmed);
  const brandTitle = brand ? toTitleCaseName(brand) : null;
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (v: string) => {
    const key = v.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    variants.push(v.trim());
  };

  if (brand) add(brand);
  if (brandTitle && brandTitle !== brand) add(brandTitle);
  if (strippedTitle !== stripped) add(strippedTitle);
  add(stripped);
  if (stripped !== trimmed) add(trimmed);

  const tokens = nameTokens(companyName);
  if (tokens.length >= 4) {
    add(tokens.slice(0, 3).join(" "));
    add(tokens.slice(0, 4).join(" "));
  }

  return variants;
}

export function nameTokens(companyName: string): string[] {
  const words = normalizePossessiveSpacing(stripCompanySuffix(companyName))
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/"/g, ""))
    .filter(Boolean);
  return mergePossessiveTokens(words)
    .map((w) => w.replace(/'/g, "").replace(/[^a-z0-9æøå]/gi, ""))
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

  const brand = extractBrandPortion(companyName);
  if (brand) {
    const brandCompact = compactAlnum(brand);
    if (brandCompact.length >= 5 && profileHay.includes(brandCompact)) {
      return true;
    }
    const brandTokens = nameTokens(brand);
    if (
      brandTokens.length >= 2 &&
      brandTokens.every((t) => profileHay.includes(compactAlnum(t)))
    ) {
      return true;
    }
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
  const brand = extractBrandPortion(companyName);
  const matchName = brand ?? companyName;
  const tokens = nameTokens(matchName);
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
      // Katalog/Facebook i tittel-treff — brukes bl.a. Google Maps der «nettside» ofte er Facebook.
      if (fullDomain && isNonOwnWebsiteDomain(fullDomain)) return true;
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
    if (GENERIC_DOMAIN_TOKENS.has(t)) return false;
    if (base === t) {
      return companyCompact === t || companyCompact.length <= t.length + 2;
    }
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
  const brand = extractBrandPortion(name);
  const brandTitle = brand ? toTitleCaseName(brand) : null;
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
      if (brandTitle) add(`"${brandTitle}" ${place}`);
      if (brand) add(`${brand} ${place}`);
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

/** Ettordsdomener som ofte tilhører helt andre firma (studio.no, design.no …). */
export function isGenericDomainBase(domain: string): boolean {
  const base = compactAlnum((domain.split(".")[0] ?? ""));
  return base.length >= 4 && GENERIC_DOMAIN_TOKENS.has(base);
}

/** Sterk match — alle navneord (inkl. bransje) finnes i domenet, eller hele navnet. */
export function isStrongDomainMatch(
  domain: string,
  companyName: string
): boolean {
  const base = compactAlnum((domain.split(".")[0] ?? ""));
  if (base.length < 4) return false;

  const companyCompact = compactAlnum(stripCompanySuffix(companyName));
  if (base === companyCompact) return true;

  const tokens = nameTokens(companyName);
  if (tokens.length >= 2) {
    return tokens.every((t) => base.includes(compactAlnum(t)));
  }

  const brandTokens = tokens.filter(
    (t) =>
      !DESCRIPTIVE_DOMAIN_TOKENS.has(t) &&
      !GENERIC_DOMAIN_TOKENS.has(compactAlnum(t))
  );
  if (brandTokens.length === 1) {
    const t = compactAlnum(brandTokens[0]!);
    return t.length >= 6 && base === t && companyCompact === t;
  }

  return false;
}

/** Merkenavn (uten bransjeord) må finnes helt i domenet — «martinsen» ≠ «martins». */
export function domainCoversBrandTokens(
  domain: string,
  companyName: string
): boolean {
  const base = compactAlnum((domain.split(".")[0] ?? ""));
  const brandTokens = nameTokens(companyName).filter(
    (t) => !BRAND_OWNER_INDUSTRY_WORDS.has(normalizeNameToken(t))
  );
  if (brandTokens.length === 0) return true;
  return brandTokens.every((t) => {
    const tc = compactAlnum(t);
    return tc.length < 4 || base.includes(tc);
  });
}

const GENERIC_PAGE_TITLES = new Set([
  "forside",
  "hjem",
  "home",
  "index",
  "start",
  "welcome",
]);

function isGenericPageTitle(title: string): boolean {
  return GENERIC_PAGE_TITLES.has(title.trim().toLowerCase());
}

/** Domene er bare første ord + bransjeord som mangler (harstra ≠ hårstrå+frisør). */
function isFirstTokenOnlyDomainMatch(
  domain: string,
  companyName: string
): boolean {
  const base = compactAlnum((domain.split(".")[0] ?? ""));
  const tokens = nameTokens(companyName);
  if (tokens.length < 2) return false;

  const first = compactAlnum(tokens[0]!);
  if (base !== first && !base.startsWith(first)) return false;

  const rest = tokens.slice(1);
  const industryRest = rest.some((t) =>
    BRAND_OWNER_INDUSTRY_WORDS.has(normalizeNameToken(t))
  );
  if (!industryRest) return false;

  return !rest.every((t) => base.includes(compactAlnum(t)));
}

/** Sjekker om URL faktisk hører til firmaet (domene eller sidetittel). */
export function websiteUrlPlausibleForCompany(
  websiteUrl: string,
  companyName: string,
  pageTitle?: string | null
): boolean {
  const domain = normalizeDomain(websiteUrl);
  if (!domain || isNonOwnWebsiteDomain(domain)) return false;

  const strongDomain = isStrongDomainMatch(domain, companyName);
  const domainMatch = domainSimilarToCompany(domain, companyName);
  const title = pageTitle?.trim() ?? "";

  if (isGenericDomainBase(domain) && !strongDomain) return false;

  if (
    title &&
    !isGenericPageTitle(title) &&
    !companyMatchesProfileName(title, companyName) &&
    !strongDomain
  ) {
    return false;
  }

  if (strongDomain) return true;

  if (!domainMatch || !domainCoversBrandTokens(domain, companyName)) {
    if (title && companyMatchesResult(title, websiteUrl, companyName)) return true;
    return companyMatchesResult("", websiteUrl, companyName);
  }

  if (
    !title &&
    !strongDomain &&
    isFirstTokenOnlyDomainMatch(domain, companyName)
  ) {
    return false;
  }

  return true;
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
