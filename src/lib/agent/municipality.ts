import { fetchKommuner } from "@/lib/brreg/client";

/** Offisielt visningsnavn per kommunekode (norske bokstaver). */
const MUNICIPALITY_CANONICAL_LABEL: Record<string, string> = {
  "0301": "Oslo",
  "1103": "Stavanger",
  "1804": "Bodø",
  "1806": "Narvik",
  "1820": "Alstahaug",
  "1824": "Vefsn",
  "1833": "Mo i Rana",
  "1841": "Fauske",
  "1860": "Vestvågøy",
  "1865": "Vågan",
  "1866": "Hadsel",
  "1870": "Sortland",
  "4601": "Bergen",
  "5001": "Trondheim",
  "5501": "Tromsø",
  "5503": "Harstad",
  "5601": "Alta",
  "5603": "Hammerfest",
  "5605": "Sør-Varanger",
};

/** Kommunenavn → Brønnøysund-kode (vanlige steder i målmarkedet). */
const MUNICIPALITY_ALIASES: Record<string, string> = {
  oslo: "0301",
  bergen: "4601",
  bergn: "4601",
  trondheim: "5001",
  stavanger: "1103",
  bodø: "1804",
  bodo: "1804",
  narvik: "1806",
  tromsø: "5501",
  tromso: "5501",
  harstad: "5503",
  "mo i rana": "1833",
  "mo-i-rana": "1833",
  rana: "1833",
  leknes: "1860",
  vestvagoy: "1860",
  vestvågøy: "1860",
  sortland: "1870",
  melbu: "1866",
  svolvær: "1865",
  svolvaer: "1865",
  alta: "5601",
  hammerfest: "5603",
  kirkenes: "5605",
  fauske: "1841",
  mosjøen: "1824",
  mosjoen: "1824",
  sandnessjøen: "1820",
  sandnessjoen: "1820",
};

const UNKNOWN_GEO_PLACES = new Set([
  "svalbard",
  "jan mayen",
  "antarktis",
  "nordpolen",
]);

let kommunerCache: Array<{ nummer: string; navn: string }> | null = null;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCasePlace(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatPlaceLabel(label: string, code?: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (code && MUNICIPALITY_CANONICAL_LABEL[code]) {
    return MUNICIPALITY_CANONICAL_LABEL[code];
  }
  return titleCasePlace(trimmed);
}

export function normalizeMunicipalityText(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

export function isUnknownGeoPlace(message: string): boolean {
  const normalized = normalizeMunicipalityText(message);
  for (const place of UNKNOWN_GEO_PLACES) {
    if (new RegExp(`\\b${escapeRegExp(place)}\\b`, "i").test(normalized)) {
      return true;
    }
  }
  return false;
}

export function extractPlaceMention(message: string): string | null {
  const normalized = normalizeMunicipalityText(message);
  const match = normalized.match(
    /\bi\s+([a-z0-9][a-z0-9\s-]{1,38}?)(?:\s+(?:med|uten)\b|$)/
  );
  if (!match?.[1]) return null;
  return match[1].trim();
}

export function parseMunicipalityFromMessage(
  message: string
): { code?: string; label?: string } {
  const normalized = normalizeMunicipalityText(message);

  for (const [alias, code] of Object.entries(MUNICIPALITY_ALIASES)) {
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
    if (pattern.test(normalized)) {
      return {
        code,
        label: MUNICIPALITY_CANONICAL_LABEL[code] ?? formatPlaceLabel(alias),
      };
    }
  }

  return {};
}

export function municipalityCodeForName(name: string): string | undefined {
  const key = normalizeMunicipalityText(name);
  return MUNICIPALITY_ALIASES[key];
}

/** Nærliggende kommuner å foreslå når lokalt søk er tomt. */
const NEARBY_MUNICIPALITY_SUGGESTIONS: Record<string, string[]> = {
  "1804": ["Tromsø", "Narvik", "Mo i Rana"],
  "1806": ["Tromsø", "Harstad", "Bodø"],
  "1833": ["Bodø", "Narvik", "Mo i Rana"],
  "5501": ["Harstad", "Alta", "Bodø"],
  "5503": ["Tromsø", "Narvik", "Sortland"],
  "5601": ["Tromsø", "Hammerfest"],
  "5603": ["Alta", "Tromsø"],
  "4601": ["Stavanger", "Oslo"],
  "5001": ["Trondheim", "Oslo"],
  "0301": ["Bærum", "Asker"],
};

/** Alternative bransjer når én bransje er uttømt i liten kommune. */
const ALTERNATIVE_INDUSTRY_SUGGESTIONS: Record<string, string> = {
  elektriker: "rørleggere eller snekkere",
  rorlegger: "elektrikere eller malere",
  frisor: "neglesalonger eller spa",
  maler: "snekkere eller murere",
  advokat: "regnskapsførere",
  tannlege: "fysioterapeuter",
  restaurant: "kafeer eller bakerier",
  grillbar: "restauranter eller kafeer",
};

export function getNearbyMunicipalitySuggestions(
  municipalityCode?: string,
  max = 2
): string[] {
  if (!municipalityCode) return [];
  const suggestions = NEARBY_MUNICIPALITY_SUGGESTIONS[municipalityCode] ?? [];
  return suggestions.slice(0, max);
}

export function getAlternativeIndustrySuggestion(industryLabel: string): string | undefined {
  const normalized = normalizeMunicipalityText(industryLabel);
  for (const [alias, suggestion] of Object.entries(ALTERNATIVE_INDUSTRY_SUGGESTIONS)) {
    if (normalized.includes(alias)) return suggestion;
  }
  return undefined;
}

export function formatNearbyPlaceSuggestion(
  municipalityCode?: string,
  industryLabel?: string
): string {
  const nearby = getNearbyMunicipalitySuggestions(municipalityCode);
  const altIndustry = industryLabel
    ? getAlternativeIndustrySuggestion(industryLabel)
    : undefined;

  const parts: string[] = [];
  if (nearby.length > 0) {
    parts.push(
      nearby.length === 1
        ? `Vil du prøve ${nearby[0]}?`
        : `Vil du prøve ${nearby.slice(0, -1).join(", ")} eller ${nearby[nearby.length - 1]}?`
    );
  }
  if (altIndustry) {
    parts.push(`Eller si fra om du vil se ${altIndustry} i stedet.`);
  }
  if (parts.length === 0) {
    return "Prøv et større område eller en annen bransje.";
  }
  return parts.join(" ");
}

async function loadKommuner(): Promise<Array<{ nummer: string; navn: string }>> {
  if (!kommunerCache) {
    kommunerCache = await fetchKommuner();
  }
  return kommunerCache;
}

function lookupKommuneByName(
  placeName: string,
  kommuner: Array<{ nummer: string; navn: string }>
): { code?: string; label?: string } {
  const normalized = normalizeMunicipalityText(placeName);
  if (!normalized) return {};

  const fromAlias = MUNICIPALITY_ALIASES[normalized];
  if (fromAlias) {
    return {
      code: fromAlias,
      label: MUNICIPALITY_CANONICAL_LABEL[fromAlias] ?? formatPlaceLabel(placeName),
    };
  }

  const exact = kommuner.find(
    (k) => normalizeMunicipalityText(k.navn) === normalized
  );
  if (exact) {
    return { code: exact.nummer, label: exact.navn };
  }

  const startsWith = kommuner.find((k) =>
    normalizeMunicipalityText(k.navn).startsWith(normalized)
  );
  if (startsWith) {
    return { code: startsWith.nummer, label: startsWith.navn };
  }

  return {};
}

/** Prøv statisk alias, deretter Brreg-kommuner, til slutt default fra bruker-minne. */
export async function resolveMunicipalityFromMessage(
  message: string,
  options?: { defaultCode?: string; defaultLabel?: string }
): Promise<{ code?: string; label?: string; unknown?: boolean }> {
  if (isUnknownGeoPlace(message)) {
    return { unknown: true, label: extractPlaceMention(message) ?? "ukjent sted" };
  }

  const sync = parseMunicipalityFromMessage(message);
  if (sync.code) return sync;

  const placeMention = extractPlaceMention(message);
  if (placeMention) {
    try {
      const kommuner = await loadKommuner();
      const resolved = lookupKommuneByName(placeMention, kommuner);
      if (resolved.code) return resolved;
      return { unknown: true, label: placeMention };
    } catch {
      return { unknown: true, label: placeMention };
    }
  }

  if (options?.defaultCode) {
    return {
      code: options.defaultCode,
      label: options.defaultLabel ?? options.defaultCode,
    };
  }

  return {};
}

export function parseDefaultMunicipalityFromPrompt(
  systemPromptExtra?: string
): { code?: string; label?: string } {
  if (!systemPromptExtra?.trim()) return {};

  const match = systemPromptExtra.match(/default_municipality:\s*([^\n]+)/i);
  if (!match?.[1]) return {};

  const value = match[1].trim();
  if (/^\d{4}$/.test(value)) {
    return { code: value };
  }

  const code = municipalityCodeForName(value);
  return code ? { code, label: value } : {};
}
