import {
  industryDivision,
  matchesNaceCode,
  type IndustryMatchContext,
} from "@/lib/constants/industries";

export type ProfessionDef = {
  id: string;
  label: string;
  /** Søkeord og synonymer brukeren kan skrive */
  aliases: string[];
  /** NACE-divisjonsprefiks (f.eks. 43) */
  prefixes?: string[];
  /** Spesifikke NACE-koder */
  codes?: string[];
  /** Ekstra ord i firmanavn / næringsbeskrivelse */
  nameKeywords?: string[];
};

export type ProfessionMatch = {
  query: string;
  label: string | null;
  professionId: string | null;
  nacePrefixes: string[];
  naceCodes: string[];
  searchKeywords: string[];
};

/** Norske yrker → NACE/bransje — utvidbart statisk kart */
export const PROFESSIONS: ProfessionDef[] = [
  {
    id: "frisor",
    label: "Frisør",
    aliases: ["frisør", "frisor", "barber", "barbershop", "hår", "harstudio", "hårstudio"],
    codes: ["96.02"],
    prefixes: ["96"],
    nameKeywords: ["frisør", "frisor", "barber", "hår", "har"],
  },
  {
    id: "rorlegger",
    label: "Rørlegger / VVS",
    aliases: ["rørlegger", "rorlegger", "vvs", "rør", "ror", "vann", "avløp", "avloep"],
    codes: ["43.22"],
    prefixes: ["43"],
    nameKeywords: ["rørlegger", "rorlegger", "vvs", "rør", "ror"],
  },
  {
    id: "elektriker",
    label: "Elektriker",
    aliases: ["elektriker", "elektro", "el-installatør", "el installatør", "el-installator"],
    codes: ["43.21"],
    prefixes: ["43"],
    nameKeywords: ["elektriker", "elektro", "el-"],
  },
  {
    id: "snekker",
    label: "Snekker / tømrer",
    aliases: ["snekker", "tømrer", "tomrer", "byggmester", "tømrermester"],
    codes: ["43.32", "43.91"],
    prefixes: ["43"],
    nameKeywords: ["snekker", "tømrer", "tomrer", "byggmester"],
  },
  {
    id: "maler",
    label: "Maler",
    aliases: ["maler", "malermester", "malerfirma", "sparkel"],
    codes: ["43.34"],
    prefixes: ["43"],
    nameKeywords: ["maler", "sparkel"],
  },
  {
    id: "bilverksted",
    label: "Bilverksted",
    aliases: ["bilverksted", "bil", "verksted", "bilpleie", "dekk", "bilverksteder"],
    codes: ["45.20"],
    prefixes: ["45"],
    nameKeywords: ["bilverksted", "bil", "verksted", "dekk", "bilpleie"],
  },
  {
    id: "bilforhandler",
    label: "Bilforhandler",
    aliases: ["bilforhandler", "bilselger", "bilforretning", "bilbutikk"],
    codes: ["45.11", "45.19"],
    prefixes: ["45"],
    nameKeywords: ["bilforhandler", "bilforretning", "bilbutikk"],
  },
  {
    id: "restaurant",
    label: "Restaurant / servering",
    aliases: ["restaurant", "restauranter", "servering", "kafé", "kafe", "café", "cafe", "bar", "pub", "pizzeria", "pizza", "sushi", "mat"],
    codes: ["56.10", "56.30"],
    prefixes: ["56"],
    nameKeywords: ["restaurant", "kafé", "kafe", "café", "cafe", "bar", "pub", "pizzeria", "sushi"],
  },
  {
    id: "kokk",
    label: "Kokk / catering",
    aliases: ["kokk", "catering", "kjøkken", "kjokken", "matservering"],
    codes: ["56.21", "56.29"],
    prefixes: ["56"],
    nameKeywords: ["kokk", "catering", "kjøkken", "kjokken"],
  },
  {
    id: "baker",
    label: "Baker / konditor",
    aliases: ["baker", "bakeri", "konditor", "konditori", "bakst"],
    codes: ["10.71", "10.72"],
    prefixes: ["10"],
    nameKeywords: ["baker", "bakeri", "konditor", "konditori"],
  },
  {
    id: "butikk",
    label: "Butikk / handel",
    aliases: ["butikk", "handel", "forretning", "dagligvare", "klesbutikk", "butikker"],
    prefixes: ["47"],
    nameKeywords: ["butikk", "forretning", "handel"],
  },
  {
    id: "apotek",
    label: "Apotek",
    aliases: ["apotek", "farmasi"],
    codes: ["47.73"],
    prefixes: ["47"],
    nameKeywords: ["apotek"],
  },
  {
    id: "lege",
    label: "Lege / klinikk",
    aliases: ["lege", "leger", "klinikk", "allmennlege", "fastlege", "helse"],
    codes: ["86.21", "86.22"],
    prefixes: ["86"],
    nameKeywords: ["lege", "klinikk", "allmennlege", "fastlege"],
  },
  {
    id: "tannlege",
    label: "Tannlege",
    aliases: ["tannlege", "tannleger", "tannklinikk", "tann"],
    codes: ["86.23"],
    prefixes: ["86"],
    nameKeywords: ["tannlege", "tannklinikk", "tann"],
  },
  {
    id: "fysioterapeut",
    label: "Fysioterapeut",
    aliases: ["fysioterapeut", "fysio", "fysioterapi", "kiropraktor", "naprapat"],
    codes: ["86.90"],
    prefixes: ["86"],
    nameKeywords: ["fysioterapeut", "fysio", "kiropraktor", "naprapat"],
  },
  {
    id: "advokat",
    label: "Advokat",
    aliases: ["advokat", "advokatfirma", "juridisk", "jurist"],
    codes: ["69.10"],
    prefixes: ["69"],
    nameKeywords: ["advokat", "juridisk", "jurist"],
  },
  {
    id: "regnskap",
    label: "Regnskapsfører",
    aliases: ["regnskap", "regnskapsfører", "regnskapsforer", "revisor", "økonomi", "okonomi"],
    codes: ["69.20"],
    prefixes: ["69"],
    nameKeywords: ["regnskap", "revisor", "økonomi", "okonomi"],
  },
  {
    id: "megler",
    label: "Eiendomsmegler",
    aliases: ["megler", "eiendomsmegler", "eiendom", "boligmegler"],
    codes: ["68.31"],
    prefixes: ["68"],
    nameKeywords: ["megler", "eiendom"],
  },
  {
    id: "arkitekt",
    label: "Arkitekt",
    aliases: ["arkitekt", "arkitekter", "arkitektkontor"],
    codes: ["71.11"],
    prefixes: ["71"],
    nameKeywords: ["arkitekt"],
  },
  {
    id: "rengjoring",
    label: "Rengjøring",
    aliases: ["rengjøring", "rengjoring", "vaktmester", "renhold", "vaskehjelp"],
    codes: ["81.21", "81.22"],
    prefixes: ["81"],
    nameKeywords: ["rengjøring", "rengjoring", "vaktmester", "renhold"],
  },
  {
    id: "flyttebyra",
    label: "Flyttebyrå",
    aliases: ["flyttebyrå", "flyttebyra", "flytting", "flytte", "transport"],
    codes: ["49.42"],
    prefixes: ["49"],
    nameKeywords: ["flytte", "flytting"],
  },
  {
    id: "taxi",
    label: "Taxi / persontransport",
    aliases: ["taxi", "drosje", "persontransport", "minibuss"],
    codes: ["49.32", "49.39"],
    prefixes: ["49"],
    nameKeywords: ["taxi", "drosje"],
  },
  {
    id: "frisor_spa",
    label: "Skjønnhetssalong / spa",
    aliases: ["skjønnhet", "skjonnhet", "spa", "velvære", "velvaere", "negler", "manikyr", "pedikyr", "vipper"],
    codes: ["96.02", "96.04"],
    prefixes: ["96"],
    nameKeywords: ["skjønnhet", "skjonnhet", "spa", "velvære", "velvaere", "negler", "vipper"],
  },
  {
    id: "massasje",
    label: "Massasje",
    aliases: ["massasje", "massør", "massor", "massasjeterapeut"],
    codes: ["96.04"],
    prefixes: ["96"],
    nameKeywords: ["massasje", "massør", "massor"],
  },
  {
    id: "trening",
    label: "Trening / gym",
    aliases: ["trening", "gym", "fitness", "personlig trener", "pt", "idrett"],
    codes: ["93.13"],
    prefixes: ["93"],
    nameKeywords: ["trening", "gym", "fitness", "idrett"],
  },
  {
    id: "fotograf",
    label: "Fotograf",
    aliases: ["fotograf", "foto", "fotostudio", "fotografi"],
    codes: ["74.20"],
    prefixes: ["74"],
    nameKeywords: ["fotograf", "foto", "fotografi"],
  },
  {
    id: "webdesign",
    label: "Webdesign / nettsider",
    aliases: ["webdesign", "nettside", "nettsider", "hjemmeside", "webbyrå", "webbyra", "digitalbyrå"],
    codes: ["62.01", "73.11", "74.10"],
    nameKeywords: ["webdesign", "nettside", "hjemmeside", "webbyrå", "webbyra", "digitalbyrå"],
  },
  {
    id: "it",
    label: "IT / utvikler",
    aliases: ["it", "utvikler", "programmerer", "software", "app", "systemutvikling"],
    codes: ["62.01", "62.02"],
    prefixes: ["62"],
    nameKeywords: ["it", "utvikler", "programmerer", "software"],
  },
  {
    id: "barnehage",
    label: "Barnehage / barnepass",
    aliases: ["barnehage", "barnepass", "dagmamma", "dagmamma", "sfo", "barn"],
    codes: ["88.91"],
    prefixes: ["88"],
    nameKeywords: ["barnehage", "barnepass", "dagmamma"],
  },
  {
    id: "reklame",
    label: "Reklame / markedsføring",
    aliases: ["reklame", "markedsføring", "markedsforing", "byrå", "byra", "annonse"],
    codes: ["73.11", "73.12"],
    prefixes: ["73"],
    nameKeywords: ["reklame", "markedsføring", "markedsforing", "byrå", "byra"],
  },
  {
    id: "hotell",
    label: "Hotell / overnatting",
    aliases: ["hotell", "overnatting", "pensjonat", "camping", "hostel"],
    codes: ["55.10", "55.20", "55.30"],
    prefixes: ["55"],
    nameKeywords: ["hotell", "overnatting", "pensjonat", "camping"],
  },
  {
    id: "anlegg",
    label: "Anlegg / graving",
    aliases: ["anlegg", "graving", "grunnarbeid", "maskin", "gravemaskin"],
    codes: ["42.11", "42.12", "43.12"],
    prefixes: ["42", "43"],
    nameKeywords: ["anlegg", "graving", "grunnarbeid", "maskin"],
  },
  {
    id: "taktekker",
    label: "Taktekker",
    aliases: ["taktekker", "tak", "blikkenslager"],
    codes: ["43.91"],
    prefixes: ["43"],
    nameKeywords: ["taktekker", "tak", "blikkenslager"],
  },
  {
    id: "flislegger",
    label: "Flislegger",
    aliases: ["flislegger", "flis", "membran"],
    codes: ["43.33"],
    prefixes: ["43"],
    nameKeywords: ["flislegger", "flis"],
  },
  {
    id: "bilvask",
    label: "Bilvask",
    aliases: ["bilvask", "bilvaskeri", "vask"],
    codes: ["45.20"],
    prefixes: ["45"],
    nameKeywords: ["bilvask", "vask"],
  },
  {
    id: "tatovering",
    label: "Tatoveringsstudio",
    aliases: [
      "tatovering",
      "tatoveringsstudio",
      "tattoo",
      "tatoverer",
      "tattovering",
    ],
    codes: ["96.02", "96.09"],
    prefixes: ["96"],
    nameKeywords: ["tattoo", "tatover", "tatovering", "tatoveringsstudio"],
  },
];

export const PROFESSION_OPTIONS = [...PROFESSIONS].sort((a, b) =>
  a.label.localeCompare(b.label, "nb")
);

export function getProfessionById(id: string): ProfessionDef | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}

export function professionLabel(id: string): string | null {
  return getProfessionById(id)?.label ?? null;
}

function buildProfessionMatch(profession: ProfessionDef): ProfessionMatch {
  const keywords = new Set<string>();
  keywords.add(normalizeText(profession.label));
  for (const alias of profession.aliases) keywords.add(normalizeText(alias));
  for (const kw of profession.nameKeywords ?? []) keywords.add(normalizeText(kw));

  return {
    query: profession.label,
    label: profession.label,
    professionId: profession.id,
    nacePrefixes: profession.prefixes ?? [],
    naceCodes: profession.codes ?? [],
    searchKeywords: [...keywords].filter(Boolean),
  };
}

/** Konkret yrke-valg fra dropdown (id) */
export function resolveProfessionFilter(professionId: string): ProfessionMatch | null {
  const profession = getProfessionById(professionId.trim());
  if (!profession) return null;
  return buildProfessionMatch(profession);
}

/** URL `yrke` — id eller gammel fritekst */
export function parseProfessionIdFromParam(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (getProfessionById(trimmed)) return trimmed;
  const legacy = resolveProfessionQuery(trimmed);
  return legacy?.professionId ?? "";
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

function scoreAliasMatch(query: string, alias: string): number {
  const q = normalizeText(query);
  const a = normalizeText(alias);
  if (!q || !a) return 0;
  if (q === a) return 100;
  if (a.startsWith(q) || q.startsWith(a)) return 85;
  if (a.includes(q) || q.includes(a)) return 70;

  const qTokens = q.split(/\s+/).filter((t) => t.length >= 3);
  const aTokens = a.split(/\s+/).filter(Boolean);
  for (const qt of qTokens) {
    for (const at of aTokens) {
      if (at.startsWith(qt) || qt.startsWith(at)) return 55;
    }
  }

  if (q.length >= 4 && similarity(q, a) >= 0.78) return 45;
  return 0;
}

function findBestProfession(query: string): { profession: ProfessionDef; score: number } | null {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  let best: { profession: ProfessionDef; score: number } | null = null;

  for (const profession of PROFESSIONS) {
    let score = scoreAliasMatch(trimmed, profession.label);
    for (const alias of profession.aliases) {
      score = Math.max(score, scoreAliasMatch(trimmed, alias));
    }
    if (!best || score > best.score) {
      best = { profession, score };
    }
  }

  return best && best.score >= 45 ? best : null;
}

/** Tolker fritekst-yrke til NACE-koder og søkeord */
export function resolveProfessionQuery(raw: string): ProfessionMatch | null {
  const query = raw.trim();
  if (!query) return null;

  const best = findBestProfession(query);

  if (best) {
    return { ...buildProfessionMatch(best.profession), query };
  }

  /** Ukjent yrke — søk i navn/beskrivelse med det brukeren skrev */
  return {
    query,
    label: null,
    professionId: null,
    nacePrefixes: [],
    naceCodes: [],
    searchKeywords: [normalizeText(query)],
  };
}

function normalizeMatchContext(context?: IndustryMatchContext): string {
  return normalizeText(
    [context?.name, context?.industryDescription].filter(Boolean).join(" ")
  );
}

function textMatchesKeywords(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;
  return keywords.some((kw) => kw.length >= 2 && text.includes(kw));
}

function matchesNaceForProfession(
  industryCode: string | null | undefined,
  match: ProfessionMatch
): boolean {
  if (match.naceCodes.length > 0 && matchesNaceCode(industryCode, match.naceCodes)) {
    return true;
  }
  if (match.nacePrefixes.length > 0) {
    const division = industryDivision(industryCode);
    return division ? match.nacePrefixes.includes(division) : false;
  }
  return false;
}

/** Sjekker om firma matcher yrke-søk (NACE + navn/beskrivelse) */
export function matchesProfessionSearch(
  industryCode: string | null | undefined,
  context: IndustryMatchContext | undefined,
  match: ProfessionMatch
): boolean {
  const text = normalizeMatchContext(context);
  const hasNace = match.naceCodes.length > 0 || match.nacePrefixes.length > 0;
  const nameHit = textMatchesKeywords(text, match.searchKeywords);

  if (hasNace) {
    const naceHit = matchesNaceForProfession(industryCode, match);
    const knownProfession = Boolean(match.professionId);
    const broadPrefixOnly =
      match.nacePrefixes.some((p) => ["43", "47", "49", "56", "62"].includes(p)) &&
      match.naceCodes.length === 0;

    if (naceHit) {
      if (knownProfession || broadPrefixOnly) {
        return nameHit;
      }
      return true;
    }
    return nameHit;
  }

  return nameHit;
}

/** Brreg `naeringskode`-parameter for yrke-søk */
export function getBrregNaeringskodeForProfession(
  match: ProfessionMatch
): string | undefined {
  const parts = [...match.naceCodes, ...match.nacePrefixes].filter(Boolean);
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(",");
}

/** Supabase/PostgREST: næringskode-mønstre for yrke */
export function getProfessionCodeOrFilters(match: ProfessionMatch): string[] | undefined {
  const filters: string[] = [];
  for (const code of match.naceCodes) {
    filters.push(`industry_code.ilike.${code}%`);
  }
  for (const prefix of match.nacePrefixes) {
    filters.push(`industry_code.ilike.${prefix}%`);
  }
  if (filters.length === 0) return undefined;
  return filters;
}

/** Supabase: navn-mønstre for yrke uten NACE-treff */
export function getProfessionNameOrFilters(match: ProfessionMatch): string[] {
  const patterns = match.searchKeywords
    .filter((kw) => kw.length >= 3)
    .slice(0, 8)
    .map((kw) => `%${kw}%`);
  return patterns.map((p) => `name.ilike.${p}`);
}

export function professionSearchLabel(raw: string): string | null {
  const byId = professionLabel(raw);
  if (byId) return byId;
  const match = resolveProfessionQuery(raw);
  return match?.label ?? null;
}
