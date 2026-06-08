import { discoverWebsiteByDomainGuess } from "./domain-guess";
import { websiteFromBrreg } from "./brreg-website-hint";
import { websiteFromEmail } from "./email-hint";
import { fetchPublicHtml } from "./fetch-public-html";
import {
  extractEmailsFromHtml,
  extract1881PersonPhonesFromHtml,
  extractPhonesFromHtml,
} from "./parse-page-contact";
import {
  companyMatchesResult,
  compactAlnum,
  normalizeDomain,
  stripCompanySuffix,
} from "./parse-results";
import {
  emailPlausibleForCompany,
  isDirectoryOwnedEmail,
  normalizeEmail,
} from "./resolve-company-email";
import { pickPlausiblePhone } from "./phone-plausible";
import { discoverPhoneWithApi1881 } from "./api1881/phone";
import { hasApi1881 } from "./api1881/config";

export type DirectoryContactHit = {
  phone: string | null;
  email: string | null;
  url: string;
  source:
    | "1881"
    | "gulesider"
    | "website"
    | "rorkjop"
    | "1881-person"
    | "gulesider-person"
    | "api1881";
};

const CONTACT_PATHS = [
  "/kontakt",
  "/contact",
  "/kontakt-oss",
  "/om-oss",
  "/om",
  "/about",
];

function orgnrInHtml(html: string, orgnr: string): boolean {
  const digits = orgnr.replace(/\D/g, "");
  if (!digits) return false;
  const spaced = digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  return html.includes(digits) || html.includes(spaced);
}

function extract1881ListingLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(
    /href="(https:\/\/www\.1881\.no\/[^"]+_\d+S\d\/)/g
  )) {
    const url = match[1]!;
    if (url.includes("digitale-medier-1881")) continue;
    if (url.includes("/widget") || url.includes("/person")) continue;
    links.add(url);
  }
  return [...links];
}

function extract1881PersonLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(
    /href="(https:\/\/www\.1881\.no\/person\/[^"]+_\d+S\d\/?)/g
  )) {
    links.add(match[1]!.replace(/\/?$/, "/"));
  }
  for (const match of html.matchAll(/href="(\/person\/[^"]+_\d+S\d\/?)/g)) {
    links.add(`https://www.1881.no${match[1]!.replace(/\/?$/, "/")}`);
  }
  return [...links];
}

function personSlugFrom1881Url(url: string): string {
  const slug = url.split("/").filter(Boolean).pop() ?? "";
  return slug.replace(/_\d+S\d\/?$/i, "");
}

function surnameCloseEnough(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let diff = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) diff += 1;
  }
  diff += Math.abs(a.length - b.length);
  return diff <= 1;
}

/** 1881-slug bruker ofte aa/oe/ae i stedet for å/ø/æ. */
function namePartMatchesSlug(namePart: string, slugPart: string): boolean {
  if (namePart === slugPart) return true;
  if (slugPart.replace(/aa/g, "a") === namePart) return true;
  if (namePart.replace(/aa/g, "a") === slugPart) return true;
  if (slugPart.replace(/oe/g, "o") === namePart) return true;
  if (namePart.replace(/oe/g, "o") === slugPart) return true;
  if (slugPart.replace(/ae/g, "a") === namePart) return true;
  return surnameCloseEnough(namePart, slugPart);
}

function personMatches1881Link(url: string, personName: string): boolean {
  if (slugMatchesCompany(url, personName)) return true;

  const slugParts = personSlugFrom1881Url(url)
    .split("-")
    .map((part) => compactAlnum(part))
    .filter(Boolean);
  const nameParts = personName
    .trim()
    .split(/\s+/)
    .map((part) => compactAlnum(part))
    .filter(Boolean);
  if (slugParts.length < 2 || nameParts.length < 2) return false;
  if (!namePartMatchesSlug(nameParts[0]!, slugParts[0]!)) return false;

  const surname = nameParts[nameParts.length - 1]!;
  const middle = nameParts.slice(1, -1);
  for (const mid of middle) {
    if (
      !slugParts
        .slice(1)
        .some((part) => namePartMatchesSlug(mid, part) || part.includes(mid))
    ) {
      return false;
    }
  }

  return slugParts
    .slice(1)
    .some((part) => namePartMatchesSlug(part, surname));
}

function isNarvikAreaPersonUrl(url: string): boolean {
  return url.toLowerCase().includes("/person/narvik/");
}

function isNarvikRegionPlace(place?: string | null): boolean {
  const p = (place ?? "Narvik").trim().toLowerCase();
  return /narvik|ankenes|bjerkvik|ballangen|kjoepsvik|ofoten/i.test(p);
}

function order1881PersonLinks(
  links: string[],
  personName: string,
  place?: string | null
): string[] {
  const matching = links.filter((url) => personMatches1881Link(url, personName));
  if (!matching.length) return [];

  if (isNarvikRegionPlace(place)) {
    const narvikArea = matching.filter((url) => isNarvikAreaPersonUrl(url));
    if (!narvikArea.length) return [];
    const placeKey = place?.trim() ? compactAlnum(place) : "";
    if (!placeKey) return narvikArea;
    const local = narvikArea.filter((url) => compactAlnum(url).includes(placeKey));
    return [...local, ...narvikArea.filter((url) => !local.includes(url))];
  }

  const placeKey = place?.trim() ? compactAlnum(place) : "";
  if (!placeKey) return matching;
  const local = matching.filter((url) => compactAlnum(url).includes(placeKey));
  return [...local, ...matching.filter((url) => !local.includes(url))];
}

function extractGulesiderListingLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(
    /href="(https:\/\/(?:www\.)?gulesider\.no\/[^"]+\/bedrifter[^"]*)"/gi
  )) {
    const url = match[1]!.split("#")[0]!;
    if (url.includes("/widget")) continue;
    links.add(url);
  }
  for (const match of html.matchAll(
    /href="(\/(?:[^"]+\/)?bedrifter\/[^"]+)"/gi
  )) {
    const url = `https://www.gulesider.no${match[1]!.split("#")[0]!}`;
    links.add(url);
  }
  return [...links];
}

function extractGulesiderPersonLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(
    /href="(https:\/\/(?:www\.)?gulesider\.no\/[^"]+\/personer[^"]*)"/gi
  )) {
    links.add(match[1]!.split("#")[0]!);
  }
  return [...links];
}

function buildGulesiderSlugUrls(companyName: string): string[] {
  const stripped = stripCompanySuffix(companyName).trim();
  const names = new Set([companyName.trim(), stripped]);
  const urls = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const slug = encodeURIComponent(name);
    urls.add(`https://www.gulesider.no/${slug}/bedrifter`);
    urls.add(`https://www.gulesider.no/${slug}/bedrifter/1`);
  }
  return [...urls];
}

function mergeHits(
  ...hits: Array<DirectoryContactHit | null | undefined>
): DirectoryContactHit | null {
  let phone: string | null = null;
  let email: string | null = null;
  let url = "";
  let source: DirectoryContactHit["source"] = "1881";

  for (const hit of hits) {
    if (!hit) continue;
    if (!phone && hit.phone) {
      phone = hit.phone;
      url = hit.url;
      source = hit.source;
    }
    if (!email && hit.email) {
      email = hit.email;
      if (!url) {
        url = hit.url;
        source = hit.source;
      }
    }
  }
  if (!phone && !email) return null;
  return { phone, email, url, source };
}

function build1881Queries(company: {
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): string[] {
  const places = new Set<string>();
  for (const p of [company.city, company.municipality_name, "Narvik", "Ankenes", "Bjerkvik", "Ballangen", "Kjøpsvik"]) {
    if (p?.trim()) places.add(p.trim());
  }

  const stripped = stripCompanySuffix(company.name).trim();
  const names = new Set([company.name.trim(), stripped]);
  if (stripped !== company.name.trim()) {
    names.add(stripped.replace(/\s+v\/.*$/i, "").trim());
  }

  const queries = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    for (const place of places) {
      queries.add(`${name} ${place}`);
    }
    queries.add(name);
  }
  return [...queries];
}

function is1881BlockedOrEmpty(html: string): boolean {
  const title = html.match(/<title>([^<]+)/i)?.[1]?.trim() ?? "";
  return /^(Blokkert|Ingen treff)$/i.test(title);
}

function is1881PersonPage(html: string): boolean {
  return (
    /details--person|ad:section" content="person-details"/i.test(html) &&
    !is1881BlockedOrEmpty(html)
  );
}

function normalize1881PersonUrl(url: string): string {
  const absolute = url.startsWith("http")
    ? url
    : `https://www.1881.no${url.startsWith("/") ? url : `/${url}`}`;
  return absolute.replace(/\/?$/, "/");
}

function extract1881PersonPageUrl(html: string): string | null {
  const canonical = html.match(
    /<link rel="canonical" href="((?:https:\/\/www\.1881\.no)?\/person\/[^"]+)"/i
  )?.[1];
  if (canonical) return normalize1881PersonUrl(canonical);
  return extract1881PersonLinks(html)[0] ?? null;
}

function extract1881PersonPhones(html: string): string[] {
  const found = new Set<string>();
  for (const phone of extract1881PersonPhonesFromHtml(html)) found.add(phone);
  for (const phone of extractPhonesFromHtml(html, { trustTextRegex: false })) {
    found.add(phone);
  }
  for (const phone of extractPhonesFromHtml(html, { trustTextRegex: true })) {
    found.add(phone);
  }
  return [...found];
}

async function extractFrom1881PersonHtml(
  html: string,
  url: string,
  orgnr: string,
  personName: string
): Promise<DirectoryContactHit | null> {
  const phone = pickPlausiblePhone(extract1881PersonPhones(html), orgnr);
  const emails = extractEmailsFromHtml(html).filter((email) => {
    if (isDirectoryOwnedEmail(email)) return false;
    if (/bruker@domene\.no|example\.com|your@email/i.test(email)) return false;
    return emailPlausibleForCompany(email, personName);
  });
  const email = emails[0] ? normalizeEmail(emails[0]) : null;
  if (!phone && !email) return null;
  return { phone, email, url, source: "1881-person" };
}

async function extractFromPage(
  url: string,
  orgnr: string,
  companyName: string,
  source: DirectoryContactHit["source"],
  options?: { requireOrgnr?: boolean; trustTextRegex?: boolean }
): Promise<DirectoryContactHit | null> {
  const html = await fetchPublicHtml(url);
  if (!html) return null;
  if (options?.requireOrgnr && !orgnrInHtml(html, orgnr)) return null;

  if (source === "1881-person" && is1881PersonPage(html)) {
    return extractFrom1881PersonHtml(html, url, orgnr, companyName);
  }

  const phones = extractPhonesFromHtml(html, {
    trustTextRegex: options?.trustTextRegex ?? false,
  });
  const phone = pickPlausiblePhone(phones, orgnr);
  const emails = extractEmailsFromHtml(html).filter((email) => {
    if (isDirectoryOwnedEmail(email)) return false;
    if (/bruker@domene\.no|example\.com|your@email/i.test(email)) return false;
    return emailPlausibleForCompany(email, companyName);
  });
  const email = emails[0] ? normalizeEmail(emails[0]) : null;

  if (!phone && !email) return null;
  return { phone, email, url, source };
}

function slugMatchesCompany(url: string, companyName: string): boolean {
  const slug = url.split("/").filter(Boolean).pop() ?? "";
  return companyMatchesResult(slug, url, companyName);
}

/** 1881-søk uten SerpAPI — flere søkeord + org.nr-validering. */
export async function lookup1881Contact(company: {
  orgnr: string;
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<DirectoryContactHit | null> {
  const hits: DirectoryContactHit[] = [];
  const seenUrls = new Set<string>();

  for (const query of build1881Queries(company)) {
    const searchHtml = await fetchPublicHtml(
      `https://www.1881.no/?query=${encodeURIComponent(query)}`
    );
    if (!searchHtml) continue;

    const links = extract1881ListingLinks(searchHtml);
    const ordered = [
      ...links.filter((url) => slugMatchesCompany(url, company.name)),
      ...links.filter(() => orgnrInHtml(searchHtml, company.orgnr)),
      ...links,
    ];

    for (const url of ordered) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const strict = await extractFromPage(
        url,
        company.orgnr,
        company.name,
        "1881",
        { requireOrgnr: true }
      );
      if (strict) hits.push(strict);

      if (slugMatchesCompany(url, company.name)) {
        const loose = await extractFromPage(
          url,
          company.orgnr,
          company.name,
          "1881",
          { requireOrgnr: false }
        );
        if (loose) hits.push(loose);
      }
    }
  }

  return mergeHits(...hits);
}

/** Gulesider-søk uten SerpAPI — direkte søk og slug-URL-er + org.nr-validering. */
export async function lookupGulesiderContact(company: {
  orgnr: string;
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<DirectoryContactHit | null> {
  const hits: DirectoryContactHit[] = [];
  const seenUrls = new Set<string>();

  const tryListing = async (url: string, requireOrgnr: boolean) => {
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    const hit = await extractFromPage(url, company.orgnr, company.name, "gulesider", {
      requireOrgnr,
    });
    if (hit) hits.push(hit);
  };

  for (const query of build1881Queries(company)) {
    const searchHtml = await fetchPublicHtml(
      `https://www.gulesider.no/?query=${encodeURIComponent(query)}`
    );
    if (!searchHtml) continue;

    const links = extractGulesiderListingLinks(searchHtml);
    const ordered = [
      ...links.filter((url) => slugMatchesCompany(url, company.name)),
      ...links.filter(() => orgnrInHtml(searchHtml, company.orgnr)),
      ...links,
    ];

    for (const url of ordered) {
      await tryListing(url, true);
      if (slugMatchesCompany(url, company.name)) {
        await tryListing(url, false);
      }
    }
  }

  for (const url of buildGulesiderSlugUrls(company.name)) {
    if (slugMatchesCompany(url, company.name)) {
      await tryListing(url, false);
    }
  }

  return mergeHits(...hits);
}

export async function lookupGulesiderPersonContact(
  personName: string,
  orgnr: string,
  place?: string | null
): Promise<DirectoryContactHit | null> {
  const queries = [`${personName} ${place ?? "Narvik"}`, personName];
  for (const query of queries) {
    const searchHtml = await fetchPublicHtml(
      `https://www.gulesider.no/?query=${encodeURIComponent(query)}`
    );
    if (!searchHtml) continue;
    for (const url of extractGulesiderPersonLinks(searchHtml)) {
      const hit = await extractFromPage(url, orgnr, personName, "gulesider-person", {
        requireOrgnr: false,
      });
      if (hit?.phone || hit?.email) return hit;
    }
  }
  return null;
}

function build1881PersonQueries(
  personName: string,
  place?: string | null
): string[] {
  const places = new Set<string>();
  for (const p of [
    place,
    "Narvik",
    "Ankenes",
    "Bjerkvik",
    "Ballangen",
    "Kjøpsvik",
  ]) {
    if (p?.trim()) places.add(p.trim());
  }
  const queries = new Set<string>();
  for (const p of places) queries.add(`${personName} ${p}`);
  queries.add(personName);
  return [...queries];
}

export async function lookup1881PersonContact(
  personName: string,
  orgnr: string,
  place?: string | null
): Promise<DirectoryContactHit | null> {
  for (const query of build1881PersonQueries(personName, place)) {
    const searchUrl = `https://www.1881.no/?query=${encodeURIComponent(query)}`;
    const searchHtml = await fetchPublicHtml(searchUrl);
    if (!searchHtml || is1881BlockedOrEmpty(searchHtml)) continue;

    if (is1881PersonPage(searchHtml)) {
      const pageUrl = extract1881PersonPageUrl(searchHtml) ?? searchUrl;
      const inRegion =
        !isNarvikRegionPlace(place) || isNarvikAreaPersonUrl(pageUrl);
      if (
        inRegion &&
        personMatches1881Link(pageUrl, personName)
      ) {
        const direct = await extractFrom1881PersonHtml(
          searchHtml,
          pageUrl,
          orgnr,
          personName
        );
        if (direct?.phone || direct?.email) return direct;
      }
    }

    for (const url of order1881PersonLinks(
      extract1881PersonLinks(searchHtml),
      personName,
      place
    )) {
      const hit = await extractFromPage(url, orgnr, personName, "1881-person", {
        requireOrgnr: false,
      });
      if (hit?.phone || hit?.email) return hit;
    }
  }
  return null;
}

async function fetchWebsiteContacts(
  websiteUrl: string,
  orgnr: string,
  companyName: string
): Promise<DirectoryContactHit | null> {
  const base = websiteUrl.replace(/\/$/, "");
  const urls = [base, ...CONTACT_PATHS.map((p) => `${base}${p}`)];
  const hits: DirectoryContactHit[] = [];

  for (const url of urls) {
    const strict = await extractFromPage(url, orgnr, companyName, "website", {
      trustTextRegex: false,
    });
    if (strict) hits.push(strict);

    const loose = await extractFromPage(url, orgnr, companyName, "website", {
      trustTextRegex: true,
    });
    if (loose) hits.push(loose);
  }

  return mergeHits(...hits);
}

/** Nettside via Brreg/e-post/domene-gjetning — uten Google/SerpAPI. */
export async function lookupWebsiteContact(company: {
  orgnr: string;
  name: string;
  email?: string | null;
  website?: string | null;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<DirectoryContactHit | null> {
  const candidates: string[] = [];
  const brreg = websiteFromBrreg(company.website, company.name);
  if (brreg?.websiteUrl) candidates.push(brreg.websiteUrl);

  const emailHint = websiteFromEmail(company.email, company.name);
  if (emailHint?.websiteUrl) candidates.push(emailHint.websiteUrl);

  const guessed = await discoverWebsiteByDomainGuess(company.name);
  if (guessed?.websiteUrl) candidates.push(guessed.websiteUrl);

  const seen = new Set<string>();
  const hits: DirectoryContactHit[] = [];
  for (const url of candidates) {
    const key = normalizeDomain(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = await fetchWebsiteContacts(url, company.orgnr, company.name);
    if (hit) hits.push(hit);
  }

  return mergeHits(...hits);
}

type RorCacheRow = { phone: string | null; email: string | null };
let rorleggerCache: Map<string, RorCacheRow> | null = null;

function parseRorkjopList(html: string): Map<string, RorCacheRow> {
  const map = new Map<string, RorCacheRow>();
  for (const block of html.split(/<h2\b/i).slice(1)) {
    const nameMatch = block.match(/^[^>]*>([^<]+)</i);
    const name = nameMatch?.[1]?.trim();
    if (!name) continue;
    const phoneMatch = block.match(
      /contact-item phone[\s\S]*?<div class="text">(\d{8})<\/div>/i
    );
    const emailMatch = block.match(
      /contact-item email[\s\S]*?<div class="text">([^<]+@[^<]+)<\/div>/i
    );
    if (!phoneMatch && !emailMatch) continue;
    map.set(name.toUpperCase(), {
      phone: phoneMatch?.[1] ?? null,
      email: emailMatch ? normalizeEmail(emailMatch[1]!) : null,
    });
  }
  return map;
}

/** Rørkjøp-listen for Narvik — én fetch, mange firma. */
export async function lookupRorkjopContact(
  companyName: string,
  orgnr: string
): Promise<DirectoryContactHit | null> {
  if (!rorleggerCache) {
    const html = await fetchPublicHtml(
      "https://www.rorkjop.no/finn-rorlegger/nordland/narvik"
    );
    rorleggerCache = html ? parseRorkjopList(html) : new Map();
  }

  const row = rorleggerCache.get(companyName.toUpperCase());
  if (!row) return null;
  const phone = row.phone ? pickPlausiblePhone([row.phone], orgnr) : null;
  const email =
    row.email && emailPlausibleForCompany(row.email, companyName)
      ? row.email
      : null;
  if (!phone && !email) return null;
  return {
    phone,
    email,
    url: "https://www.rorkjop.no/finn-rorlegger/nordland/narvik",
    source: "rorkjop",
  };
}

export type BrregRolePerson = {
  role: string;
  name: string;
};

export async function fetchBrregRolePersons(
  orgnr: string
): Promise<BrregRolePerson[]> {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}/roller`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const out: BrregRolePerson[] = [];
  for (const group of data.rollegrupper ?? []) {
    for (const role of group.roller ?? []) {
      const person = role.person;
      if (!person?.navn) continue;
      const name = [person.navn.fornavn, person.navn.etternavn]
        .filter(Boolean)
        .join(" ");
      if (!name) continue;
      out.push({
        role: role.type?.beskrivelse ?? role.type?.kode ?? "Rolle",
        name,
      });
    }
  }
  return out;
}

/** 1881 API-oppslag — org.nr-validering, tom heller enn feil. */
async function lookupApi1881Contact(company: {
  orgnr: string;
  name: string;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<DirectoryContactHit | null> {
  if (!hasApi1881()) return null;

  const phone = await discoverPhoneWithApi1881(company).catch(() => null);
  if (!phone) return null;

  return {
    phone,
    email: null,
    url: "https://services.api1881.no/",
    source: "api1881",
  };
}

export async function lookupFreeContact(company: {
  orgnr: string;
  name: string;
  email?: string | null;
  website?: string | null;
  municipality_name?: string | null;
  city?: string | null;
  industry_code?: string | null;
}): Promise<DirectoryContactHit | null> {
  const from1881 = await lookup1881Contact(company).catch(() => null);
  const fromGulesider = await lookupGulesiderContact(company).catch(() => null);
  const fromWeb = await lookupWebsiteContact(company).catch(() => null);
  const fromRor =
    (company.industry_code ?? "").startsWith("43.22")
      ? await lookupRorkjopContact(company.name, company.orgnr).catch(() => null)
      : null;

  let merged = mergeHits(from1881, fromGulesider, fromWeb, fromRor);

  if (!merged?.phone) {
    const roles = await fetchBrregRolePersons(company.orgnr);
    const owner = roles.find((r) =>
      /innehaver|daglig leder|styrets leder/i.test(r.role)
    );
    if (owner) {
      const place = company.city ?? company.municipality_name;
      const personHit = mergeHits(
        await lookup1881PersonContact(owner.name, company.orgnr, place).catch(
          () => null
        ),
        await lookupGulesiderPersonContact(owner.name, company.orgnr, place).catch(
          () => null
        )
      );
      merged = mergeHits(merged, personHit);
    }
  }

  if (!merged?.phone) {
    merged = mergeHits(
      merged,
      await lookupApi1881Contact(company).catch(() => null)
    );
  }

  return merged;
}
