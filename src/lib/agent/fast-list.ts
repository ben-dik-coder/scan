import {
  AGENT_DEFAULT_LIST_LIMIT,
  AGENT_MAX_COMPANIES_PER_JOB,
  AGENT_MAX_FAST_LIST_LIMIT,
  AGENT_MAX_SCAN_PER_CALL,
  AGENT_MAX_SCAN_PER_JOB,
} from "@/lib/agent/constants";
import {
  extractPlaceMention,
  formatNearbyPlaceSuggestion,
  formatPlaceLabel,
  isUnknownGeoPlace,
  parseDefaultMunicipalityFromPrompt,
  parseMunicipalityFromMessage,
  resolveMunicipalityFromMessage,
} from "@/lib/agent/municipality";
import { isSimpleSearchIntent } from "@/lib/agent/prompt";
import { resolveIndustryKeyword } from "@/lib/agent/search-filters";
import {
  isWebsiteSalesLeadIntent,
  messageForIndustryResolution,
  parseDefaultIndustryFromPrompt,
  WEBSITE_SALES_COMPETITOR_GROUPS,
} from "@/lib/agent/website-sales-leads";
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

/** Bruker peker på forrige liste i samtalen — f.eks. «på disse», «den listen». */
export function refersToPreviousList(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  return (
    /\bpå\s+(disse|de)\b/.test(normalized) ||
    /\b(den|denne)\s+listen\b/.test(normalized) ||
    /\bforrige\s+(liste|resultat|sok)\b/.test(normalized) ||
    /\b(de|disse|forrige|siste)\s+(to|tre|fire|fem|\d+|forste|siste|resultat|neste)\b/.test(
      normalized
    ) ||
    /\bskann\s+(disse|de)\b/.test(normalized) ||
    /\b(finn|sjekk|skann)\s+.*\b(disse|de|listen)\b/.test(normalized)
  );
}

/** Bruker vil ha Facebook i skann — ikke «med facebook» i nytt søk. */
export function wantsFacebookInScan(message: string): boolean {
  return /\b(fb|facebook)\b/i.test(message);
}

/**
 * Oppfølging som ber om nettside/Facebook for firma i forrige liste —
 * f.eks. «finn fb og evt nettside på disse». Skal ikke tolkes som webdesign-søk.
 */
export function isListEnrichFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (!refersToPreviousList(message)) return false;

  const wantsEnrichment =
    wantsFacebookInScan(message) ||
    /\b(nettside|nettsider|hjemmeside|webside|website)\b/.test(normalized) ||
    /\b(skann|sjekk|scan)\b/.test(normalized);

  if (!wantsEnrichment) return false;

  // «finn 5 webdesign i Oslo» er nytt søk, ikke berikelse av forrige liste.
  if (
    /\b(finn|list|vis|hent|gi|sok|søk)\s+(meg\s+)?\d+\s+\w/.test(normalized) &&
    !/\bpå\s+(disse|de)\b/.test(normalized)
  ) {
    return false;
  }

  return true;
}

/** Oppfølging som trenger samtalekontekst — ikke fast-list. */
export function isContextualFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const combinedSearchScan =
    /\b(finn|list|vis|hent|gi|sok|søk)\b/.test(normalized) &&
    /\b(skann|sjekk)\b/.test(normalized);

  return (
    isContextualListFollowUp(message) ||
    isListEnrichFollowUp(message) ||
    /\b(de|disse|forrige|siste)\s+(to|tre|\d+|første|siste|resultat)\b/.test(
      normalized
    ) ||
    /\bhvilken av disse\b/.test(normalized) ||
    /\blagre\s+(som\s+)?liste\b/.test(normalized) ||
    (!combinedSearchScan && /\bskann\s+(nettside|de)\b/.test(normalized))
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

export function extractOrgnrsFromText(text: string): string[] {
  return [...text.matchAll(/orgnr[:\s]+(\d{9})/gi)].map((match) => match[1]);
}

function findLastAssistantListMessage(history: ChatTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;
    if (extractOrgnrsFromText(msg.content).length > 0) return msg.content;
  }
  return undefined;
}

/** Orgnr fra siste assistent-liste i samtalen. */
export function collectLastListOrgnrs(history: ChatTurn[]): string[] {
  const text = findLastAssistantListMessage(history);
  return text ? extractOrgnrsFromText(text) : [];
}

export function isSaveListFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  return /\blagre\s+(som\s+)?liste\b/.test(normalized);
}

export function isScanWebsitesFollowUp(message: string): boolean {
  const normalized = normalizeText(message);
  if (
    /\b(finn|list|vis|hent|gi|sok|søk)\b/.test(normalized) &&
    /\b(skann|sjekk)\b/.test(normalized)
  ) {
    return false;
  }
  if (isListEnrichFollowUp(message)) return true;
  return (
    /\bskann\s+(nettside|de|disse)\b/.test(normalized) ||
    /\bskann\s+(de|disse)\s+(to|tre|\d+|første|forste|neste)\b/.test(normalized) ||
    /\bskann\s+(de\s+)?neste\b/.test(normalized) ||
    /\bskan\s+(de\s+)?neste\b/.test(normalized) ||
    /\b(skann|sjekk)\s+(en|ett|to|tre|fire|fem|seks|syv|atte|ni|ti)\b/.test(
      normalized
    ) ||
    /\b(skann|sjekk)\s+\d{1,2}\b/.test(normalized)
  );
}

function wantsWebsiteScan(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    /\b(skann|sjekk|scan)\b/.test(normalized) &&
    /\b(nettside|nettsider|web|website|webside|hjemmeside)\b/.test(normalized)
  );
}

/** Søk + skann i samme melding — f.eks. «finn 10 frisører i Bodø og skann nettside». */
export function isSearchAndScanIntent(message: string): boolean {
  if (isScanWebsitesFollowUp(message)) return false;
  if (isContextualFollowUp(message)) return false;
  if (!wantsWebsiteScan(message)) return false;

  if (isWebsiteSalesLeadListIntent(message)) return true;
  if (resolveIndustryKeyword(normalizeText(message))) return true;
  return /\b(finn|list|vis|hent|gi)\b/.test(normalizeText(message));
}

export type ParsedSearchAndScanRequest = {
  listRequest: ParsedSimpleListRequest;
  scanLimit: number;
  websiteSales?: boolean;
};

function parseScanCount(message: string): number {
  const normalized = normalizeText(message);
  const wordCounts: Record<string, number> = {
    en: 1,
    ett: 1,
    to: 2,
    tre: 3,
    fire: 4,
    fem: 5,
    seks: 6,
    syv: 7,
    atte: 8,
    ni: 9,
    ti: 10,
  };

  const scanWordMatch = normalized.match(
    /\b(skann|sjekk)\s+(en|ett|to|tre|fire|fem|seks|syv|atte|ni|ti)\b/
  );
  if (scanWordMatch) {
    return Math.min(
      wordCounts[scanWordMatch[2]] ?? AGENT_MAX_SCAN_PER_CALL,
      AGENT_MAX_SCAN_PER_JOB
    );
  }

  const scanDigitMatch = normalized.match(/\b(skann|sjekk)\s+(\d{1,2})\b/);
  if (scanDigitMatch) {
    return Math.min(
      Number.parseInt(scanDigitMatch[2], 10),
      AGENT_MAX_SCAN_PER_JOB
    );
  }

  const nesteWordMatch = normalized.match(
    /\bneste\s+(en|ett|to|tre|fire|fem|seks|syv|atte|ni|ti)\b/
  );
  if (nesteWordMatch) {
    return Math.min(
      wordCounts[nesteWordMatch[1]] ?? AGENT_MAX_SCAN_PER_CALL,
      AGENT_MAX_SCAN_PER_JOB
    );
  }

  const nesteDigitMatch = normalized.match(/\bneste\s+(\d{1,2})\b/);
  if (nesteDigitMatch) {
    return Math.min(
      Number.parseInt(nesteDigitMatch[1], 10),
      AGENT_MAX_SCAN_PER_JOB
    );
  }

  if (/\bneste\b/.test(normalized)) {
    return AGENT_MAX_SCAN_PER_CALL;
  }

  for (const [word, count] of Object.entries(wordCounts)) {
    if (new RegExp(`\\b(de|disse)\\s+${word}\\b`).test(normalized)) {
      return count;
    }
  }
  const digitMatch = normalized.match(
    /\b(de|disse)\s+(\d{1,2})\s+(første|forste|siste|neste)\b/
  );
  if (digitMatch) {
    return Math.min(Number.parseInt(digitMatch[2], 10), AGENT_MAX_FAST_LIST_LIMIT);
  }
  const firstMatch = normalized.match(/\b(de|disse)\s+(første|forste)\b/);
  if (firstMatch) return 2;
  return AGENT_MAX_SCAN_PER_CALL;
}

function isNextScanBatchRequest(message: string): boolean {
  return /\bneste\b/.test(normalizeText(message));
}

/** Orgnr som allerede er skannet i denne samtalen. */
export function collectAlreadyScannedOrgnrs(history: ChatTurn[]): string[] {
  const scanned = new Set<string>();
  for (const msg of history) {
    if (msg.role !== "assistant") continue;
    if (!/\bskann/i.test(msg.content)) continue;
    for (const orgnr of extractOrgnrsFromText(msg.content)) {
      scanned.add(orgnr);
    }
  }
  return [...scanned];
}

export type ParsedSaveListRequest = {
  orgnrs: string[];
  name: string;
  municipalityCode?: string;
  regionId?: string;
  industryGroup?: string;
  professionId?: string;
};

export type ParsedScanWebsitesRequest = {
  orgnrs: string[];
  count: number;
  includeFacebook?: boolean;
};

/** «lagre som liste» — bruk orgnr fra siste søkeresultat. */
export async function parseSaveListRequest(
  message: string,
  history: ChatTurn[],
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSaveListRequest | null> {
  if (!isSaveListFollowUp(message)) return null;

  const orgnrs = collectLastListOrgnrs(history);
  if (orgnrs.length === 0) return null;

  const lastSearch = findLastSearchUserMessage(history, message);
  const parsed = lastSearch
    ? await parseSimpleListRequest(lastSearch, options)
    : null;

  const industryLabel = parsed?.industryLabel ?? "firma";
  const locationLabel = parsed?.locationLabel ?? "";
  const name = locationLabel
    ? `${orgnrs.length} ${industryLabel} ${locationLabel}`.slice(0, 80)
    : `${orgnrs.length} ${industryLabel}`.slice(0, 80);

  return {
    orgnrs,
    name,
    municipalityCode:
      typeof parsed?.searchArgs.municipalityCode === "string"
        ? parsed.searchArgs.municipalityCode
        : undefined,
    regionId:
      typeof parsed?.searchArgs.regionId === "string"
        ? parsed.searchArgs.regionId
        : undefined,
    industryGroup:
      typeof parsed?.searchArgs.industryGroup === "string"
        ? parsed.searchArgs.industryGroup
        : undefined,
    professionId:
      typeof parsed?.searchArgs.professionId === "string"
        ? parsed.searchArgs.professionId
        : undefined,
  };
}

/** «skann de to første» / «skann de neste 5» — bruk orgnr fra siste liste. */
export function parseScanWebsitesRequest(
  message: string,
  history: ChatTurn[]
): ParsedScanWebsitesRequest | null {
  if (!isScanWebsitesFollowUp(message)) return null;

  const allOrgnrs = collectLastListOrgnrs(history);
  if (allOrgnrs.length === 0) return null;

  const count = Math.min(parseScanCount(message), allOrgnrs.length);
  const pool = isNextScanBatchRequest(message)
    ? allOrgnrs.filter((orgnr) => !collectAlreadyScannedOrgnrs(history).includes(orgnr))
    : allOrgnrs;

  if (pool.length === 0) return null;

  const batchCount = Math.min(count, pool.length, AGENT_MAX_SCAN_PER_JOB);
  return {
    orgnrs: pool.slice(0, batchCount),
    count: batchCount,
    includeFacebook: wantsFacebookInScan(message),
  };
}

function parseExplicitScanLimit(message: string): number | undefined {
  const normalized = normalizeText(message);
  const wordCounts: Record<string, number> = {
    en: 1,
    ett: 1,
    to: 2,
    tre: 3,
    fire: 4,
    fem: 5,
    seks: 6,
    syv: 7,
    atte: 8,
    ni: 9,
    ti: 10,
  };

  const scanWordMatch = normalized.match(
    /\b(skann|sjekk)\s+(en|ett|to|tre|fire|fem|seks|syv|atte|ni|ti)\b/
  );
  if (scanWordMatch) {
    return Math.min(wordCounts[scanWordMatch[1]] ?? AGENT_MAX_SCAN_PER_CALL, AGENT_MAX_SCAN_PER_JOB);
  }

  const scanDigitMatch = normalized.match(/\b(skann|sjekk)\s+(\d{1,2})\b/);
  if (scanDigitMatch) {
    return Math.min(Number.parseInt(scanDigitMatch[2], 10), AGENT_MAX_SCAN_PER_JOB);
  }

  return undefined;
}

/** «finn 10 frisører i Bodø og skann nettside» — søk + skann uten LLM-verktøykjede. */
export async function parseSearchAndScanRequest(
  message: string,
  options?: { defaultMunicipality?: { code?: string; label?: string }; systemPromptExtra?: string }
): Promise<ParsedSearchAndScanRequest | null> {
  if (!isSearchAndScanIntent(message)) return null;

  const cleaned = message
    .replace(/\s*(,|og)?\s*(skann|sjekk)\s+(nettside|nettsider|web|webside|hjemmeside).*/i, "")
    .trim();

  let listRequest: ParsedSimpleListRequest | null = null;
  let websiteSales = false;

  if (isWebsiteSalesLeadListIntent(message)) {
    const parsed = await parseWebsiteSalesLeadRequest(message, options);
    if (!parsed || parsed.unknownPlace || parsed.needsClarification) return null;
    listRequest = parsed;
    websiteSales = true;
  } else {
    listRequest =
      (await parseSimpleListRequest(cleaned || message, options)) ??
      (await buildListRequest(cleaned || message, options));
  }

  if (!listRequest || listRequest.unknownPlace) return null;

  const scanLimit = Math.min(
    parseExplicitScanLimit(message) ?? listRequest.limit,
    AGENT_MAX_SCAN_PER_JOB
  );

  return { listRequest, scanLimit, websiteSales };
}

type ScanSummary = {
  orgnr: string;
  displayName?: string | null;
  hasWebsite?: boolean;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  countsAsNoWebsite?: boolean;
};

export function formatScanWebsitesReply(
  scans: ScanSummary[],
  options?: { serperLimited?: boolean; remaining?: number }
): string {
  if (scans.length === 0) {
    return "Fant ingen firma å skanne — gjør et søk først.";
  }

  const lines = scans.map((scan, index) => {
    const name = scan.displayName?.trim() || scan.orgnr;
    let status = "ukjent nettside";
    if (scan.countsAsNoWebsite || scan.hasWebsite === false) {
      status = scan.facebookUrl ? "kun Facebook, ingen egen nettside" : "ingen egen nettside";
    } else if (scan.websiteUrl) {
      status = scan.websiteUrl;
    } else if (scan.hasWebsite) {
      status = "har nettside";
    }
    return `${index + 1}. **${formatCompanyName(name)}** · orgnr ${scan.orgnr} · ${status}`;
  });

  const withoutSite = scans.filter(
    (scan) => scan.countsAsNoWebsite || scan.hasWebsite === false
  ).length;

  let footer = `\n\n${withoutSite} av ${scans.length} mangler egen nettside.`;
  if (options?.serperLimited) {
    footer += " Serper-kvoten er lav — noen skann ble utelatt.";
  } else if (options?.remaining && options.remaining > 0) {
    footer += ` Si fra om du vil skanne ${options.remaining} til.`;
  }
  footer += " Vil du lagre som liste? Si fra.";

  return `Skannet ${scans.length} nettsider:\n\n${lines.join("\n")}${footer}`;
}

function findLastUserMessageIndex(history: ChatTurn[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return i;
  }
  return -1;
}

function shouldSkipLatestUserMessage(history: ChatTurn[], currentMessage: string): boolean {
  const idx = findLastUserMessageIndex(history);
  if (idx < 0) return false;
  return normalizeText(history[idx].content) === normalizeText(currentMessage);
}

const SEARCH_STOP_WORDS = new Set([
  "finn",
  "vis",
  "gi",
  "hent",
  "list",
  "sok",
  "søk",
  "meg",
  "oss",
  "litt",
  "i",
  "og",
  "med",
  "telefon",
  "norge",
  "hele",
  "landet",
  "fra",
  "til",
  "flere",
  "mer",
  "noen",
  "gode",
  "nyeste",
  "nye",
  "firma",
  "bedrift",
  "selskap",
  "selskaper",
  "foretak",
]);

/** Svar på «hele landet eller snevre inn?» etter «finn N til». */
export function isScopeClarificationReply(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const scopePhrase =
    /\b(fra\s+)?hele\s+landet\b/.test(normalized) ||
    /\bhele\s+norge\b/.test(normalized) ||
    /^(i\s+)?norge$/.test(normalized) ||
    /^fra\s+norge$/.test(normalized);

  if (!scopePhrase) return false;

  // «finn grillbar i norge» er et nytt søk, ikke et kort scope-svar.
  if (
    hasListVerb(normalized) &&
    normalized.split(/\s+/).filter(Boolean).length > 2
  ) {
    return false;
  }

  return true;
}

export function isNationwideScopeMessage(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    /\b(fra\s+)?hele\s+landet\b/.test(normalized) ||
    /\bhele\s+norge\b/.test(normalized) ||
    /\bi\s+norge\b/.test(normalized) ||
    parseRegion(normalized).label === "Norge"
  );
}

function looksLikeCompanySearchMessage(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (isContextualListFollowUp(message)) return false;
  if (isScopeClarificationReply(message)) return false;
  if (isSaveListFollowUp(message)) return false;
  if (isScanWebsitesFollowUp(message)) return false;
  if (resolveIndustryKeyword(normalized)) return true;
  if (extractNameQueryFromMessage(message)) return true;
  return hasListVerb(normalized);
}

function extractNameQueryFromMessage(message: string): string | undefined {
  const quoted = message.match(/[«"']([^»"']{2,})[»"']/);
  if (quoted?.[1]) {
    return quoted[1].trim().slice(0, 40);
  }

  const normalized = normalizeText(message);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token));
  return tokens[0];
}

function buildPaginationSearchArgs(
  baseArgs: Record<string, unknown>,
  limit: number,
  shownOrgnrs: string[]
): Record<string, unknown> {
  return {
    ...baseArgs,
    limit: Math.min(
      limit + shownOrgnrs.length + 4,
      AGENT_MAX_COMPANIES_PER_JOB
    ),
    displayLimit: limit,
    days: 0,
  };
}

function findPendingMoreLimit(
  history: ChatTurn[],
  currentMessage: string
): number | null {
  const skipLatest = shouldSkipLatestUserMessage(history, currentMessage);
  let skippedLatest = false;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user") continue;
    if (skipLatest && !skippedLatest) {
      skippedLatest = true;
      continue;
    }

    const normalized = normalizeText(msg.content);
    const moreMatch = matchMoreCompaniesRequest(normalized);
    if (moreMatch) {
      return Math.min(Number.parseInt(moreMatch[2], 10), AGENT_MAX_FAST_LIST_LIMIT);
    }
    if (isGenericMoreRequest(normalized)) {
      return AGENT_DEFAULT_LIST_LIMIT;
    }
    if (looksLikeCompanySearchMessage(msg.content)) {
      break;
    }
  }

  return null;
}

function findLastSearchUserMessage(
  history: ChatTurn[],
  currentMessage: string
): string | undefined {
  const skipLatest = shouldSkipLatestUserMessage(history, currentMessage);
  let skippedLatest = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user") continue;
    if (skipLatest && !skippedLatest) {
      skippedLatest = true;
      continue;
    }
    if (looksLikeCompanySearchMessage(msg.content)) return msg.content;
  }
  return undefined;
}

function collectShownOrgnrs(history: ChatTurn[], currentMessage: string): string[] {
  const orgnrs: string[] = [];
  const skipLatest = shouldSkipLatestUserMessage(history, currentMessage);
  let skippedLatest = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "user") {
      if (skipLatest && !skippedLatest) {
        skippedLatest = true;
        continue;
      }
      if (looksLikeCompanySearchMessage(msg.content)) {
        break;
      }
    }
    if (msg.role === "assistant") {
      orgnrs.push(...extractOrgnrsFromText(msg.content));
    }
  }
  return [...new Set(orgnrs)];
}

/** «finn 2 til», «samme by», «advokater i stedet» — gjenbruk forrige søk fra historikk. */
async function buildListRequestFromSearchMessage(
  message: string,
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  const fromSimple = await parseSimpleListRequest(message, options);
  if (fromSimple && !fromSimple.unknownPlace) return fromSimple;

  const normalized = normalizeText(message);
  const nameQuery = extractNameQueryFromMessage(message);
  if (!nameQuery) return null;

  const limit = parseLimit(normalized) ?? AGENT_DEFAULT_LIST_LIMIT;
  const municipality = await resolveMunicipalityFromMessage(normalized, {
    defaultCode: options?.defaultMunicipality?.code,
    defaultLabel: options?.defaultMunicipality?.label,
  });
  const region = parseRegion(normalized);
  const nationwide =
    isNationwideScopeMessage(message) ||
    (!municipality.code && !region.id && /\bnorge\b/.test(normalized));

  if (municipality.unknown && !nationwide) {
    const placeLabel =
      municipality.label ?? extractPlaceMention(normalized) ?? "valgt sted";
    return {
      limit,
      industryLabel: nameQuery,
      locationLabel: placeLabel,
      searchArgs: { limit, days: 0, nameQuery },
      unknownPlace: true,
    };
  }

  const searchArgs: Record<string, unknown> = {
    limit,
    days: 0,
    nameQuery,
    fastList: true,
  };
  if (municipality.code) {
    searchArgs.municipalityCode = municipality.code;
  } else if (region.id) {
    searchArgs.regionId = region.id;
  }

  if (wantsPhoneInList(normalized)) {
    searchArgs.requirePhone = true;
  }

  const locationLabel = nationwide
    ? "Norge"
    : formatPlaceLabel(
        municipality.label ??
          region.label ??
          (municipality.code || region.id ? "valgt område" : "Norge"),
        municipality.code
      );

  return {
    limit,
    industryLabel: nameQuery,
    locationLabel,
    searchArgs,
    requirePhone: searchArgs.requirePhone === true,
  };
}

export async function parseContextualListRequest(
  message: string,
  history: ChatTurn[],
  options?: { defaultMunicipality?: { code?: string; label?: string } }
): Promise<ParsedSimpleListRequest | null> {
  if (!isContextualListFollowUp(message) && !isScopeClarificationReply(message)) {
    return null;
  }

  const normalized = normalizeText(message);
  const lastSearch = findLastSearchUserMessage(history, message);
  const shownOrgnrs = collectShownOrgnrs(history, message);

  if (isScopeClarificationReply(message)) {
    const pendingLimit = findPendingMoreLimit(history, message);
    if (!pendingLimit || !lastSearch) return null;

    const base = await buildListRequestFromSearchMessage(lastSearch, options);
    if (!base || base.unknownPlace) return null;

    const searchArgs = { ...base.searchArgs };
    delete searchArgs.municipalityCode;
    delete searchArgs.regionId;

    return {
      ...base,
      limit: pendingLimit,
      locationLabel: "Norge",
      searchArgs: buildPaginationSearchArgs(searchArgs, pendingLimit, shownOrgnrs),
      excludeOrgnrs: shownOrgnrs,
    };
  }

  const moreMatch = matchMoreCompaniesRequest(normalized);
  if ((moreMatch || isGenericMoreRequest(normalized)) && lastSearch) {
    let base = await parseSimpleListRequest(lastSearch, options);
    if (!base || base.unknownPlace) {
      base = await buildListRequestFromSearchMessage(lastSearch, options);
    }
    if (!base || base.unknownPlace) return null;
    const limit = moreMatch
      ? Math.min(Number.parseInt(moreMatch[2], 10), AGENT_MAX_FAST_LIST_LIMIT)
      : base.limit;
    return {
      ...base,
      limit,
      searchArgs: buildPaginationSearchArgs(base.searchArgs, limit, shownOrgnrs),
      excludeOrgnrs: shownOrgnrs,
    };
  }

  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return null;

  const limit =
    parseLimit(normalized) ??
    (lastSearch ? parseLimit(lastSearch) : undefined) ??
    AGENT_DEFAULT_LIST_LIMIT;

  const municipalityOptions = {
    defaultCode: options?.defaultMunicipality?.code,
    defaultLabel: options?.defaultMunicipality?.label,
  };
  let municipality = await resolveMunicipalityFromMessage(
    normalized,
    municipalityOptions
  );
  if (
    !municipality.code &&
    lastSearch &&
    (/\bsamme\s+(by|sted|kommune|omrade|område)\b/.test(normalized) ||
      /\bi stedet\b/.test(normalized))
  ) {
    municipality = await resolveMunicipalityFromMessage(
      lastSearch,
      municipalityOptions
    );
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

  const locationLabel = formatPlaceLabel(
    municipality.label ?? parseRegion(normalized).label ?? "valgt område",
    municipality.code
  );

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

function hasIndustryInPlacePattern(normalized: string): boolean {
  if (/uten nettside|skann|lagre/i.test(normalized)) return false;
  return (
    /\b(finn|vis|list|hent|sok|søk)\s+.+\s+i\s+\S+/i.test(normalized) ||
    (Boolean(resolveIndustryKeyword(normalized)) && /\bi\s+\S+/i.test(normalized))
  );
}

function hasListVerb(normalized: string): boolean {
  return (
    /^(finn|sok|søk|list|vis|hent|gi meg|gi)\b/.test(normalized) ||
    /\b(finn|list|vis|hent)\s+(meg\s+)?\d{1,2}\b/.test(normalized) ||
    /^\d{1,2}\s+\w+/.test(normalized)
  );
}

export type ParsedWebsiteSalesLeadRequest = ParsedSimpleListRequest & {
  needsClarification?: boolean;
  clarificationMessage?: string;
};

/** Bruker vil selge nettsider — finn SMB-leads uten nettside, ikke webbyrå. */
export function isWebsiteSalesLeadListIntent(message: string): boolean {
  if (isContextualFollowUp(message)) return false;
  return isWebsiteSalesLeadIntent(message);
}

export async function parseWebsiteSalesLeadRequest(
  message: string,
  options?: {
    defaultMunicipality?: { code?: string; label?: string };
    systemPromptExtra?: string;
  }
): Promise<ParsedWebsiteSalesLeadRequest | null> {
  if (!isWebsiteSalesLeadListIntent(message)) return null;

  const industryMessage = messageForIndustryResolution(message);
  const industry = resolveIndustryKeyword(industryMessage);
  const defaultIndustry = parseDefaultIndustryFromPrompt(options?.systemPromptExtra);
  const limit = parseLimit(message) ?? 10;

  const municipality = await resolveMunicipalityFromMessage(industryMessage, {
    defaultCode: options?.defaultMunicipality?.code,
    defaultLabel: options?.defaultMunicipality?.label,
  });
  const region = parseRegion(industryMessage);
  const nationwide =
    isNationwideScopeMessage(message) ||
    (!municipality.code && !region.id && /\bnorge\b/.test(normalizeText(industryMessage)));

  if (municipality.unknown && !nationwide) {
    const placeLabel =
      municipality.label ?? extractPlaceMention(industryMessage) ?? "valgt sted";
    return {
      limit,
      industryLabel: industry?.label ?? defaultIndustry?.label ?? "lokale firma",
      locationLabel: placeLabel,
      searchArgs: {
        limit,
        days: 0,
        withoutWebsite: true,
        excludeIndustryGroups: [...WEBSITE_SALES_COMPETITOR_GROUPS],
      },
      unknownPlace: true,
    };
  }

  const municipalityCode = municipality.code ?? options?.defaultMunicipality?.code;
  const regionId = region.id;
  if (!municipalityCode && !regionId && !nationwide) {
    return {
      limit,
      industryLabel: industry?.label ?? defaultIndustry?.label ?? "lokale firma",
      locationLabel: "",
      searchArgs: {},
      needsClarification: true,
      clarificationMessage:
        "Hvilket område vil du søke i? Si for eksempel «i Bodø» eller «i Narvik».",
    };
  }

  const industryLabel =
    industry?.label ?? defaultIndustry?.label ?? "firma";
  const searchArgs: Record<string, unknown> = {
    limit,
    days: 0,
    withoutWebsite: true,
    excludeIndustryGroups: [...WEBSITE_SALES_COMPETITOR_GROUPS],
    ...(industry?.filters ??
      (defaultIndustry?.industryGroup
        ? { industryGroup: defaultIndustry.industryGroup }
        : {})),
  };

  if (municipalityCode) {
    searchArgs.municipalityCode = municipalityCode;
  } else if (regionId) {
    searchArgs.regionId = regionId;
  }

  searchArgs.requirePhone = true;

  const locationLabel = nationwide
    ? "Norge"
    : formatPlaceLabel(
        municipality.label ??
          options?.defaultMunicipality?.label ??
          region.label ??
          "valgt område",
        municipalityCode
      );

  return {
    limit,
    industryLabel,
    locationLabel,
    searchArgs,
    requirePhone: true,
  };
}

export function formatWebsiteSalesLeadReply(
  companies: SimpleListCompany[],
  request: ParsedWebsiteSalesLeadRequest
): string {
  if (request.needsClarification && request.clarificationMessage) {
    return request.clarificationMessage;
  }

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

  const phoneNote = request.requirePhone ? " (alle med telefon)" : "";
  const header = `Her er ${companies.length} ${request.industryLabel} i ${request.locationLabel}${phoneNote} du kan ta kontakt med:`;
  const municipalityCode =
    typeof request.searchArgs.municipalityCode === "string"
      ? request.searchArgs.municipalityCode
      : undefined;
  const footer =
    companies.length < request.limit
      ? `\n\nFant bare ${companies.length} i databasen. ${formatNearbyPlaceSuggestion(municipalityCode, request.industryLabel)} Si fra om du vil prøve en annen bransje.`
      : "\n\nVil du lagre som liste? Si fra.";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}

/** Bruker vil ha en kort liste med N firma — ikke skann/lagre. */
export function isSimpleListIntent(message: string): boolean {
  if (isWebsiteSalesLeadListIntent(message)) return false;
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

  return hasListVerb(normalized) || shortIndustryPlace || hasIndustryInPlacePattern(normalized);
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
  const nationwide =
    isNationwideScopeMessage(message) ||
    (!municipality.code && !region.id && /\bnorge\b/.test(normalized));

  if (municipality.unknown && !nationwide) {
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
    fastList: true,
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

  const locationLabel = nationwide
    ? "Norge"
    : formatPlaceLabel(
        municipality.label ??
          region.label ??
          (municipality.code || region.id ? "valgt område" : "Norge"),
        municipality.code
      );

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
  const fromIndustry = await buildListRequest(message, options);
  if (fromIndustry) return fromIndustry;
  return buildListRequestFromSearchMessage(message, options);
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

export function formatPoolExhaustedReply(options: {
  industryLabel: string;
  locationLabel: string;
  seenCount: number;
  municipalityCode?: string;
}): string {
  const suggestion = formatNearbyPlaceSuggestion(
    options.municipalityCode,
    options.industryLabel
  );
  return `Fant ingen flere ${options.industryLabel} i ${options.locationLabel}. Du har sett ${options.seenCount} fra før — ${suggestion} Si fra om du vil skanne eller lagre.`;
}

function partialResultFooter(
  request: ParsedSimpleListRequest,
  found: number
): string {
  const municipalityCode =
    typeof request.searchArgs.municipalityCode === "string"
      ? request.searchArgs.municipalityCode
      : undefined;
  const suggestion = formatNearbyPlaceSuggestion(
    municipalityCode,
    request.industryLabel
  );
  return `\n\nFant bare ${found} i databasen. ${suggestion} Si fra om du vil skanne nettside eller lagre som liste.`;
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
  const isMoreBatch = (request.excludeOrgnrs?.length ?? 0) > 0;
  const header = isMoreBatch
    ? `Her er ${companies.length} til (${request.industryLabel} i ${request.locationLabel}${phoneNote}):`
    : `Her er ${companies.length} ${request.industryLabel} i ${request.locationLabel}${phoneNote}:`;
  const footer =
    companies.length < request.limit
      ? partialResultFooter(request, companies.length)
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
      ? " Søkekvoten er lav akkurat nå."
      : meta?.scanned
        ? " Ingen av de jeg sjekket hadde Facebook-side."
        : "";
    return `Fant ingen ${request.industryLabel} med Facebook i ${request.locationLabel}.${scanNote} Prøv et annet sted eller si fra om du vil sjekke flere.`;
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
      ? `\n\nViste de med funnet Facebook-side.`
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
