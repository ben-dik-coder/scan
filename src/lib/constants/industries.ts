/** NACE-bransjer (første del av næringskode, f.eks. 62.100 → 62) */

export type IndustryMatchContext = {
  name?: string | null;
  industryDescription?: string | null;
};

export type IndustryGroup = {
  id: string;
  label: string;
  /** Divisjonsprefiks uten punktum (enkle grupper) */
  prefixes: string[];
  /** Spesifikke NACE-koder for Brreg-søk og presis matching (overstyrer prefixes) */
  codes?: string[];
  /** Minst ett må finnes i navn eller næringsbeskrivelse */
  nameKeywords?: string[];
  /** Ekskluder hvis tekst matcher og ingen nameKeywords treffer */
  excludeKeywords?: string[];
};

/** Nøkkelord som tyder på at firma selger/lager nettsider */
export const WEBBYRA_NAME_KEYWORDS = [
  "nettside",
  "nettsted",
  "website",
  "webdesign",
  "web design",
  "webdesigner",
  "hjemmeside",
  "hjemmesider",
  "www",
  "webbyr",
  "web byr",
  "webbyra",
  "webbyrå",
  "digitalbyr",
  "digital byr",
  "digitalbyra",
  "digitalbyrå",
  "wordpress",
  "woocommerce",
  "shopify",
  "ehandel",
  "e-handel",
  "nettbutikk",
  "cms",
  " nett ",
  " web ",
  "web-",
  "-web",
];

/** Ekskluder rene hosting/drift/IT uten web-fokus i navn */
export const WEBBYRA_EXCLUDE_KEYWORDS = [
  "hosting",
  "webhotell",
  "serverdrift",
  "datasenter",
  "domainregistrering",
  "it-konsulent",
  "it konsulent",
  "programvare",
  "software",
  "apputvikling",
  "app-utvikling",
  "systemutvikling",
  "skydrift",
  "cloud drift",
];

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  { id: "", label: "Alle bransjer", prefixes: [] },
  { id: "handel", label: "Handel og butikk", prefixes: ["47"] },
  { id: "servering", label: "Servering og overnatting", prefixes: ["55", "56"] },
  { id: "bygg", label: "Bygg og håndverk", prefixes: ["41", "42", "43"] },
  { id: "it", label: "IT og konsulenter", prefixes: ["62", "63"] },
  /**
   * Selger nettsider (Brreg NACE/SNI) — smalt filter, ikke alle IT/digitalbyrå:
   * - 62.01 dataprogrammering (kun med web-nøkkelord i navn/beskrivelse)
   * - 73.11 reklamebyrå (kun digital/web i navn — ikke ren reklame)
   * - 74.10 grafisk/kommunikasjonsdesign (webdesign-studio)
   * Ekskludert: 63.11 hosting, 62.02/62.09 IT-konsulent, hele divisjon 63/73/74 uten koder,
   * samt firma der navn tyder på hosting/drift/programvare uten web-fokus.
   */
  {
    id: "webbyra",
    label: "Selger nettsider (Brreg)",
    prefixes: [],
    codes: ["62.01", "73.11", "74.10"],
    nameKeywords: WEBBYRA_NAME_KEYWORDS,
    excludeKeywords: WEBBYRA_EXCLUDE_KEYWORDS,
  },
  { id: "marked", label: "Reklame og markedsføring", prefixes: ["73"] },
  { id: "helse", label: "Helse og omsorg", prefixes: ["86", "87", "88"] },
  { id: "skjonnhet", label: "Frisør og skjønnhet", prefixes: ["96"] },
  { id: "kultur", label: "Kultur og underholdning", prefixes: ["90", "91", "93"] },
  { id: "transport", label: "Transport og logistikk", prefixes: ["49", "50", "51", "52", "53"] },
  { id: "eiendom", label: "Eiendom", prefixes: ["68"] },
  { id: "industri", label: "Industri og produksjon", prefixes: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"] },
  { id: "landbruk", label: "Landbruk og natur", prefixes: ["01", "02", "03"] },
];

export function industryDivision(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const part = code.trim().split(".")[0];
  return part || null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().normalize("NFKD");
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  const hay = normalizeText(text);
  if (!hay) return false;
  return keywords.some((kw) => hay.includes(kw.toLowerCase()));
}

/** Sjekker om NACE-kode matcher ett av mønstrene (62.010 → 62.01) */
export function matchesNaceCode(
  industryCode: string | null | undefined,
  patterns: string[]
): boolean {
  if (!industryCode?.trim() || patterns.length === 0) return false;
  const code = industryCode.trim();
  return patterns.some((pattern) => {
    const p = pattern.trim();
    if (!p) return false;
    if (code.startsWith(p)) return true;
    const compact = code.replace(/\./g, "");
    const compactPattern = p.replace(/\./g, "");
    return compact.startsWith(compactPattern);
  });
}

function matchesWebSellerKeywords(context?: IndustryMatchContext): boolean {
  const text = [context?.name, context?.industryDescription].filter(Boolean).join(" ");
  return matchesAnyKeyword(text, WEBBYRA_NAME_KEYWORDS);
}

function isExcludedWebSeller(context?: IndustryMatchContext): boolean {
  const text = [context?.name, context?.industryDescription].filter(Boolean).join(" ");
  if (!matchesAnyKeyword(text, WEBBYRA_EXCLUDE_KEYWORDS)) return false;
  return !matchesWebSellerKeywords(context);
}

export function matchesIndustryGroup(
  industryCode: string | null | undefined,
  groupId: string,
  context?: IndustryMatchContext
): boolean {
  if (!groupId) return true;
  const group = INDUSTRY_GROUPS.find((g) => g.id === groupId);
  if (!group) return true;

  if (group.codes?.length) {
    if (!matchesNaceCode(industryCode, group.codes)) return false;
    if (group.nameKeywords?.length && !matchesWebSellerKeywords(context)) {
      return false;
    }
    if (group.excludeKeywords?.length && isExcludedWebSeller(context)) {
      return false;
    }
    return true;
  }

  if (group.prefixes.length === 0) return true;

  const division = industryDivision(industryCode);
  if (!division) return false;

  return group.prefixes.includes(division);
}

export function industryGroupLabel(groupId: string): string {
  return INDUSTRY_GROUPS.find((g) => g.id === groupId)?.label ?? "Alle bransjer";
}

/** Brreg `naeringskode`-parameter (kommaseparert, f.eks. 62.01,73.11,74.10) */
export function getBrregNaeringskodeParam(groupId: string): string | undefined {
  if (!groupId) return undefined;
  const group = INDUSTRY_GROUPS.find((g) => g.id === groupId);
  if (!group) return undefined;
  if (group.codes?.length) return group.codes.join(",");
  if (!group.prefixes.length) return undefined;
  return group.prefixes.join(",");
}

/** Supabase/PostgREST: næringskode-mønstre for bransjegruppe */
export function getIndustryCodeOrFilters(groupId: string): string[] | undefined {
  if (!groupId) return undefined;
  const group = INDUSTRY_GROUPS.find((g) => g.id === groupId);
  if (!group) return undefined;

  if (group.codes?.length) {
    return group.codes.map((c) => `industry_code.ilike.${c}%`);
  }
  if (!group.prefixes.length) return undefined;
  return group.prefixes.map((p) => `industry_code.ilike.${p}%`);
}

/** Supabase: navn/beskrivelse-mønstre for webbyrå (minst ett treff) */
export function getWebbyraNameOrFilters(): string[] {
  const patterns = [
    "%nettside%",
    "%nettsted%",
    "%website%",
    "%webdesign%",
    "%hjemmeside%",
    "%webbyr%",
    "%webbyra%",
    "%webbyrå%",
    "%digitalbyr%",
    "%digitalbyra%",
    "%wordpress%",
    "%woocommerce%",
    "%shopify%",
    "%ehandel%",
    "%e-handel%",
    "%nettbutikk%",
    "%cms%",
    "%web-%",
    "%-web%",
  ];
  return patterns.map((p) => `name.ilike.${p}`);
}
