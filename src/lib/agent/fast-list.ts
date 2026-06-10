import {
  AGENT_DEFAULT_LIST_LIMIT,
  AGENT_MAX_FAST_LIST_LIMIT,
} from "@/lib/agent/constants";
import {
  extractPlaceMention,
  isUnknownGeoPlace,
  parseDefaultMunicipalityFromPrompt,
  parseMunicipalityFromMessage,
  resolveMunicipalityFromMessage,
} from "@/lib/agent/municipality";
import { isSimpleSearchIntent } from "@/lib/agent/prompt";
import { resolveIndustryKeyword } from "@/lib/agent/search-filters";
import { formatCompanyName } from "@/lib/utils";

export type SimpleListCompany = {
  orgnr: string;
  name: string;
  phone?: string | null;
  municipality_name?: string | null;
  facebookUrl?: string | null;
};

export type ParsedSimpleListRequest = {
  limit: number;
  industryLabel: string;
  locationLabel: string;
  searchArgs: Record<string, unknown>;
  requirePhone?: boolean;
  unknownPlace?: boolean;
  excludeOrgnrs?: string[];
};

type ChatTurn = { role: string; content: string };

const REGION_ALIASES: Record<string, string> = {
  norge: "",
  "hele norge": "",
  nordland: "nordland",
  oslo: "oslo",
  trøndelag: "trondelag",
  trondelag: "trondelag",
  vestland: "vestland",
  rogaland: "rogaland",
};

function normalizeText(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

export function wantsPhoneInList(message: string): boolean {
  return /\b(med\s+telefon|med\s+tlf|med\s+mobil|telefonnummer)\b/i.test(message);
}

export function wantsFacebookInList(message: string): boolean {
  return /\bmed\s+facebook\b/i.test(message);
}

/** Oppfølging som trenger samtalekontekst — ikke fast-list. */
export function isContextualFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  return (
    isContextualListFollowUp(message) ||
    /\b(de|disse|forrige|siste)\s+(to|tre|\d+|første|siste|resultat)\b/.test(
      normalized
    ) ||
    /\bhvilken av disse\b/.test(normalized) ||
    /\blagre\s+(som\s+)?liste\b/.test(normalized) ||
    /\bskann\s+(nettside|de)\b/.test(normalized)
  );
}

/** Valgfritt «meg/oss/litt» mellom verb og antall — f.eks. «finn meg 3 til». */
const FOLLOW_UP_FILLER = "(?:\\s+(?:meg|oss|litt))?";

function matchMoreCompaniesRequest(normalized: string): RegExpMatchArray | null {
  return normalized.match(
    new RegExp(
      `\\b(finn|vis|gi|hent)${FOLLOW_UP_FILLER}\\s+(\\d{1,2})\\s+(til|flere|mer)\\b`
    )
  );
}

function isGenericMoreRequest(normalized: string): boolean {
  return new RegExp(
    `\\b(finn|vis)${FOLLOW_UP_FILLER}\\s+(flere|mer|noen til)\\b`
  ).test(normalized);
}

/** Oppfølging som kan løses med nytt liste-søk fra historikk. */
export function isContextualListFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  return (
    Boolean(matchMoreCompaniesRequest(normalized)) ||
    isGenericMoreRequest(normalized) ||
    /\bsamme\s+(by|sted|kommune|omrade|område)\b/.test(normalized) ||
    /\bi stedet\b/.test(normalized)
  );
}

function extractOrgnrsFromText(text: string): string[] {
  return [...text.matchAll(/orgnr[:\s]+(\d{9})/gi)].map((match) => match[1]);
}

function findLastSearchUserMessage(history: ChatTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user") continue;
    if (resolveIndustryKeyword(normalizeText(msg.content))) return msg.content;
  }
  return undefined;
}

function collectShownOrgnrs(history: ChatTurn[]): string[] {
  const orgnrs: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "user" && resolveIndustryKeyword(normalizeText(msg.content))) {
      break;
    }
    if (msg.role === "assistant") {
      orgnrs.push(...extractOrgnrsFromText(msg.content));
    }
  }
  return [...new Set(orgnrs)];
}

/** «finn 2 til», «samme by», «advokater i stedet» — gjenbruk forrige søk fra historikk. */
export async function parseContextualListRequest(
  message: string,
  history: ChatTurn[],
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  if (!isContextualListFollowUp(message)) return null;

  const normalized = normalizeText(message);
  const lastSearch = findLastSearchUserMessage(history);
  const shownOrgnrs = collectShownOrgnrs(history);

  const moreMatch = matchMoreCompaniesRequest(normalized);
  if ((moreMatch || isGenericMoreRequest(normalized)) && lastSearch) {
    const base = await parseSimpleListRequest(lastSearch, options);
    if (!base || base.unknownPlace) return null;
    const limit = moreMatch
      ? Math.min(Number.parseInt(moreMatch[2], 10), AGENT_MAX_FAST_LIST_LIMIT)
      : base.limit;
    return {
      ...base,
      limit,
      searchArgs: {
        ...base.searchArgs,
        limit: Math.min(limit + shownOrgnrs.length + 4, AGENT_MAX_FAST_LIST_LIMIT),
        days: 0,
      },
      excludeOrgnrs: shownOrgnrs,
    };
  }

  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return null;

  const limit =
    parseLimit(normalized) ??
    (lastSearch ? parseLimit(lastSearch) : undefined) ??
    AGENT_DEFAULT_LIST_LIMIT;

  let municipality = await resolveMunicipalityFromMessage(normalized, options);
  if (
    !municipality.code &&
    lastSearch &&
    (/\bsamme\s+(by|sted|kommune|omrade|område)\b/.test(normalized) ||
      /\bi stedet\b/.test(normalized))
  ) {
    municipality = await resolveMunicipalityFromMessage(lastSearch, options);
  }

  if (!municipality.code && !parseRegion(normalized).id) {
    return null;
  }

  const searchArgs: Record<string, unknown> = {
    limit: Math.min(limit + 4, AGENT_MAX_FAST_LIST_LIMIT),
    days: 0,
    ...industry.filters,
  };
  if (municipality.code) {
    searchArgs.municipalityCode = municipality.code;
  } else {
    const region = parseRegion(normalized);
    if (region.id) searchArgs.regionId = region.id;
  }

  if (wantsPhoneInList(normalized) || (lastSearch && wantsPhoneInList(lastSearch))) {
    searchArgs.requirePhone = true;
  }

  const locationLabel =
    municipality.label ?? parseRegion(normalized).label ?? "valgt område";

  return {
    limit,
    industryLabel: industry.label,
    locationLabel,
    searchArgs,
    requirePhone: searchArgs.requirePhone === true,
    excludeOrgnrs: shownOrgnrs,
  };
}

function parseLimit(message: string): number | undefined {
  const match = message.match(/\b(\d{1,2})\b/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, AGENT_MAX_FAST_LIST_LIMIT);
}

function parseRegion(message: string): { id?: string; label?: string } {
  for (const [alias, id] of Object.entries(REGION_ALIASES)) {
    if (!id) continue;
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(message)) {
      return { id, label: alias };
    }
  }
  if (/\bi norge\b|\bhele landet\b/.test(message)) {
    return { id: "", label: "Norge" };
  }
  return {};
}

function hasListVerb(normalized: string): boolean {
  return (
    /^(finn|sok|søk|list|vis|hent|gi meg|gi)\b/.test(normalized) ||
    /\b(finn|list|vis|hent)\s+(meg\s+)?\d{1,2}\b/.test(normalized) ||
    /^\d{1,2}\s+\w+/.test(normalized)
  );
}

/** Bruker vil ha en kort liste med N firma — ikke skann/lagre. */
export function isSimpleListIntent(message: string): boolean {
  if (isContextualFollowUp(message)) return false;
  if (wantsFacebookInList(message)) return false;
  if (!isSimpleSearchIntent(message)) return false;

  const normalized = normalizeText(message);
  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return false;

  const hasPlace = Boolean(parseMunicipalityFromMessage(normalized).code);
  const shortIndustryPlace =
    !/uten nettside|skann|lagre/i.test(normalized) &&
    hasPlace &&
    normalized.split(/\s+/).length <= 4;

  return hasListVerb(normalized) || shortIndustryPlace;
}

export function isFacebookListIntent(message: string): boolean {
  if (!wantsFacebookInList(message)) return false;

  const normalized = normalizeText(message);
  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return false;

  return hasListVerb(normalized);
}

async function buildListRequest(
  message: string,
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  const normalized = normalizeText(message);
  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return null;

  const limit = parseLimit(normalized) ?? AGENT_DEFAULT_LIST_LIMIT;
  const municipality = await resolveMunicipalityFromMessage(normalized, {
    defaultCode: options?.defaultMunicipality?.code,
    defaultLabel: options?.defaultMunicipality?.label,
  });
  const region = parseRegion(normalized);

  if (municipality.unknown) {
    const placeLabel =
      municipality.label ?? extractPlaceMention(normalized) ?? "valgt sted";
    return {
      limit,
      industryLabel: industry.label,
      locationLabel: placeLabel,
      searchArgs: { limit, days: 0, ...industry.filters },
      unknownPlace: true,
    };
  }

  const searchArgs: Record<string, unknown> = {
    limit,
    days: 0,
    ...industry.filters,
  };

  if (municipality.code) {
    searchArgs.municipalityCode = municipality.code;
  } else if (region.id) {
    searchArgs.regionId = region.id;
  }

  if (wantsPhoneInList(normalized)) {
    searchArgs.requirePhone = true;
  }

  const locationLabel =
    municipality.label ??
    region.label ??
    (municipality.code || region.id ? "valgt område" : "Norge");

  return {
    limit,
    industryLabel: industry.label,
    locationLabel,
    searchArgs,
    requirePhone: wantsPhoneInList(normalized),
  };
}

export async function parseSimpleListRequest(
  message: string,
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  if (!isSimpleListIntent(message)) return null;
  return buildListRequest(message, options);
}

export async function parseFacebookListRequest(
  message: string,
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  if (!isFacebookListIntent(message)) return null;
  return buildListRequest(message, options);
}

export function formatUnknownPlaceReply(request: ParsedSimpleListRequest): string {
  return `Fant ingen ${request.industryLabel} i ${request.locationLabel}. Stedet finnes ikke som norsk kommune i Brønnøysund — prøv et annet sted.`;
}

export function formatFastListReply(
  companies: SimpleListCompany[],
  request: ParsedSimpleListRequest
): string {
  if (request.unknownPlace) {
    return formatUnknownPlaceReply(request);
  }

  if (companies.length === 0) {
    const phoneHint = request.requirePhone ? " med telefon" : "";
    return `Fant ingen ${request.industryLabel}${phoneHint} i ${request.locationLabel}. Prøv et annet sted eller en annen bransje.`;
  }

  const lines = companies.map((company, index) => {
    const phone = (company.phone ?? "").trim();
    const place = (company.municipality_name ?? "").trim();
    const parts = [
      `${index + 1}. **${formatCompanyName(company.name)}**`,
      `orgnr ${company.orgnr}`,
    ];
    if (phone) parts.push(`tlf ${phone}`);
    if (place) parts.push(place);
    return parts.join(" · ");
  });

  const phoneNote = request.requirePhone
    ? ` (alle med telefon)`
    : "";
  const header = `Her er ${companies.length} ${request.industryLabel} i ${request.locationLabel}${phoneNote}:`;
  const footer =
    companies.length < request.limit
      ? `\n\nFant bare ${companies.length} i databasen. Si fra om du vil skanne nettside eller lagre som liste.`
      : "\n\nVil du skanne nettside eller lagre som liste? Si fra.";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}

export function formatFacebookListReply(
  companies: SimpleListCompany[],
  request: ParsedSimpleListRequest,
  meta?: { scanned: number; serperLimited?: boolean }
): string {
  if (request.unknownPlace) {
    return formatUnknownPlaceReply(request);
  }

  const withFacebook = companies.filter((c) => (c.facebookUrl ?? "").trim());
  if (withFacebook.length === 0) {
    const scanNote = meta?.serperLimited
      ? " Serper-kvoten er lav, så jeg skannet ikke nettsider nå."
      : meta?.scanned
        ? ` Skannet ${meta.scanned} firma uten å finne Facebook.`
        : "";
    return `Fant ingen ${request.industryLabel} med Facebook i ${request.locationLabel}.${scanNote} Prøv et annet sted eller si fra om du vil skanne flere.`;
  }

  const lines = withFacebook.map((company, index) => {
    const place = (company.municipality_name ?? "").trim();
    const parts = [
      `${index + 1}. **${formatCompanyName(company.name)}**`,
      `orgnr ${company.orgnr}`,
      `Facebook: ${company.facebookUrl}`,
    ];
    if (place) parts.push(place);
    return parts.join(" · ");
  });

  const header = `Her er ${withFacebook.length} ${request.industryLabel} med Facebook i ${request.locationLabel}:`;
  const scanNote =
    meta?.scanned && meta.scanned > withFacebook.length
      ? `\n\nSkannet ${meta.scanned} firma — viste de med funnet Facebook-side.`
      : "";
  const footer =
    "\n\nVil du lagre som liste eller skanne flere? Si fra.";

  return `${header}\n\n${lines.join("\n")}${scanNote}${footer}`;
}

export function hasUnresolvedPlaceMention(message: string): boolean {
  const normalized = normalizeText(message);
  if (isUnknownGeoPlace(normalized)) return true;
  const place = extractPlaceMention(normalized);
  if (!place) return false;
  if (parseMunicipalityFromMessage(place).code) return false;
  if (parseRegion(place).id) return false;
  return true;
}

export function getDefaultMunicipalityFromPrompt(
  systemPromptExtra?: string
): { code?: string; label?: string } {
  return parseDefaultMunicipalityFromPrompt(systemPromptExtra);
}
