import type { FacebookProfileSnippet } from "@/lib/website-scan/types";

/** Land/region som tydelig ikke er Norge (vanlige falske treff). */
const FOREIGN_LOCATION_RE =
  /\b(polen|poland|polska|polski|tyskland|germany|deutschland|frankrike|france|spania|spain|italia|italy|nederland|netherlands|belgia|belgium|østerrike|austria|tsjekkia|czech|ungarn|hungary|romania|bulgaria|ukraina|ukraine|litauen|lithuania|latvia|estonia|irland|ireland|storbritannia|united kingdom|england|skottland|scotland|usa|united states|mairie|ville de|town of|city of)\b/i;

/** Vanlige utenlandske Facebook-handles som matcher norske firmanavn tilfeldig. */
const FOREIGN_FB_HANDLE_RE =
  /^(mairie|ville|cityof|townof|hotel|restaur|magasin|shop|store|boutique)/i;

const FOREIGN_CITY_RE =
  /\b(warszawa|warsaw|kraków|krakow|wrocław|wroclaw|gdańsk|gdansk|poznań|poznan|łódź|lodz|szczecin|bydgoszcz|lublin|katowice|berlin|münchen|munich|hamburg|köln|cologne|frankfurt|paris|madrid|barcelona|roma|rome|milano|milan|amsterdam|rotterdam|brussel|brussels|wien|vienna|prague|praha|budapest|bucharest|kyiv|kiev|dublin|london|manchester|liverpool)\b/i;

const NORWAY_RE = /\b(norge|norway|norsk)\b/i;

const NORWEGIAN_POSTAL_RE = /\b\d{4}\b/;

function normalizeGeoText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function hasForeignLocationSignals(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return FOREIGN_LOCATION_RE.test(t) || FOREIGN_CITY_RE.test(t);
}

export function hasNorwayLocationSignals(
  text: string,
  municipalityName?: string | null
): boolean {
  const t = text.trim();
  if (!t) return false;
  if (NORWAY_RE.test(t)) return true;

  const place = municipalityName?.trim();
  if (place && t.toLowerCase().includes(place.toLowerCase())) return true;

  if (NORWEGIAN_POSTAL_RE.test(t) && !hasForeignLocationSignals(t)) {
    return true;
  }

  return false;
}

/** Facebook-URL med tydelig utenlandsk locale (f.eks. locale=pl_PL). */
export function facebookUrlHasForeignLocale(link: string): boolean {
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.toLowerCase();
    if (/^pl(-|\.)/.test(host) || host.startsWith("pl-pl.")) return true;

    for (const key of ["locale", "hl"]) {
      const v = u.searchParams.get(key)?.toLowerCase() ?? "";
      if (!v) continue;
      if (/^pl(_|$)/.test(v) || v === "pl") return true;
      if (/^(de|fr|es|it|nl|be|at|cz|hu|ro|bg|uk|lt|lv|ee|en-us|en-gb)(_|$)/.test(v)) {
        return true;
      }
    }

    const pathLocale = u.pathname.match(/^\/([a-z]{2})(?:-[a-z]{2})?\//i)?.[1];
    if (pathLocale && !/^(no|nb|nn|en)$/i.test(pathLocale)) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function facebookProfileLocationText(
  profile: Pick<FacebookProfileSnippet, "address" | "intro" | "category" | "name">
): string {
  return normalizeGeoText([
    profile.address,
    profile.intro,
    profile.category,
    profile.name,
  ]);
}

/**
 * Når vi kjenner kommune: avvis utenlandske adresser, foretrekk Norge/kommune.
 * Uten kommune: avvis bare tydelig feil land.
 */
export function facebookProfileMatchesRegion(
  profile: Pick<FacebookProfileSnippet, "address" | "intro" | "category" | "name">,
  municipalityName?: string | null
): boolean {
  const text = facebookProfileLocationText(profile);
  if (!text.trim()) return true;

  if (hasForeignLocationSignals(text)) return false;

  const municipality = municipalityName?.trim();
  if (!municipality) return true;

  const hasLocationFields = Boolean(
    profile.address?.trim() || profile.intro?.trim()
  );

  if (!hasLocationFields) return true;

  if (hasNorwayLocationSignals(text, municipality)) return true;

  // Adresse uten tydelig land — ikke kast bort treff fra Google (ofte mangler Norge i tekst)
  return true;
}

export function facebookSearchTextLooksValid(
  title: string,
  link: string,
  municipalityName?: string | null
): boolean {
  if (facebookUrlHasForeignLocale(link)) return false;

  const municipality = municipalityName?.trim();
  if (!municipality) {
    return !hasForeignLocationSignals(title);
  }

  const text = title;
  if (hasForeignLocationSignals(text)) return false;
  if (hasNorwayLocationSignals(text, municipality)) return true;

  return !hasForeignLocationSignals(text);
}

export function facebookHandleLooksForeign(handle: string): boolean {
  const h = handle.trim();
  if (!h || /^\d+$/.test(h)) return false;
  if (FOREIGN_FB_HANDLE_RE.test(h)) return true;
  return hasForeignLocationSignals(h);
}

export function scoreFacebookSearchHit(
  title: string,
  link: string,
  municipalityName?: string | null
): number {
  if (!facebookSearchTextLooksValid(title, link, municipalityName)) return -1;

  let score = 0;
  const municipality = municipalityName?.trim();
  if (!municipality) return score;

  if (title.toLowerCase().includes(municipality.toLowerCase())) score += 3;
  if (hasNorwayLocationSignals(title, municipality)) score += 2;

  return score;
}
