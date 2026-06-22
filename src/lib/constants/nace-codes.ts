import { matchesNaceCode } from "@/lib/constants/industries";

export type NaceCodeOption = {
  /** NACE-klasse (vises i UI) */
  code: string;
  label: string;
};

export type NaceCodeGroup = {
  id: string;
  label: string;
  codes: NaceCodeOption[];
};

/**
 * Brreg/SN2007 lagrer ofte 5-sifret kode (f.eks. 56.110, 96.210) — ikke 4-sifret (56.10).
 * Disse overstyrer automatisk generering for kjente avvik.
 */
const NACE_DB_PATTERN_OVERRIDES: Record<string, string[]> = {
  "96.02": ["96.210%", "96.220%"],
  "96.04": ["96.230%"],
  "62.01": ["62.010%", "62.01%"],
  "62.02": ["62.020%", "62.02%"],
  "63.11": ["63.111%", "63.11%", "63.1%"],
  "86.90": ["86.901%", "86.909%", "86.9%"],
  "52.29": ["52.290%", "52.29%"],
  "68.10": ["68.100%", "68.101%", "68.10%"],
  "70.22": ["70.220%", "70.22%"],
  "88.91": ["88.991%", "88.91%"],
  "47.81": ["47.810%", "47.81%"],
  "47.82": ["47.820%", "47.82%"],
  "47.83": ["47.830%", "47.83%"],
  "95.31": ["95.310%", "95.31%"],
};

/** Utvalgte Brreg NACE-koder brukeren kan velge i tillegg til bransje/yrke. */
export const NACE_CODE_GROUPS: NaceCodeGroup[] = [
  {
    id: "motor",
    label: "Motor og bil",
    codes: [
      { code: "47.81", label: "Detaljhandel med motorvogner (bil/bruktbil)" },
      { code: "47.82", label: "Detaljhandel med bildeler og -utstyr" },
      { code: "47.83", label: "Detaljhandel med motorsykler" },
      { code: "95.31", label: "Reparasjon og vedlikehold av motorvogner" },
    ],
  },
  {
    id: "handel",
    label: "Handel og butikk",
    codes: [
      { code: "47.11", label: "Butikkhandel med bredt vareutvalg" },
      { code: "47.73", label: "Apotek" },
      { code: "47.76", label: "Blomsterhandel" },
      { code: "47.78", label: "Annen spesialisert butikkhandel" },
    ],
  },
  {
    id: "servering",
    label: "Servering og overnatting",
    codes: [
      { code: "55.10", label: "Hoteller og lignende overnatting" },
      { code: "56.10", label: "Restaurant og kafé" },
      { code: "56.21", label: "Catering" },
      { code: "56.30", label: "Utsalg av drikkevarer" },
    ],
  },
  {
    id: "bygg",
    label: "Bygg og håndverk",
    codes: [
      { code: "43.21", label: "Elektrisk installasjonsarbeid" },
      { code: "43.22", label: "VVS-arbeid" },
      { code: "43.32", label: "Snekkerarbeid" },
      { code: "43.34", label: "Malerarbeid" },
      { code: "43.42", label: "Murerarbeid" },
      { code: "43.33", label: "Gulvlegging og tapetsering" },
    ],
  },
  {
    id: "helse",
    label: "Helse og omsorg",
    codes: [
      { code: "86.21", label: "Allmenn legetjeneste" },
      { code: "86.23", label: "Tannhelsetjenester" },
      { code: "86.90", label: "Andre helsetjenester" },
      { code: "88.10", label: "Pleie- og omsorgstjenester i institusjon" },
      { code: "88.91", label: "Barnehager" },
    ],
  },
  {
    id: "skjonnhet",
    label: "Frisør og skjønnhet",
    codes: [
      { code: "96.02", label: "Frisering og barbering" },
      { code: "96.04", label: "Kroppspleie" },
    ],
  },
  {
    id: "it",
    label: "IT og konsulenter",
    codes: [
      { code: "62.01", label: "Dataprogrammering" },
      { code: "62.02", label: "IT-konsulentvirksomhet" },
      { code: "63.11", label: "Databehandling, lagring og tilknyttet virksomhet" },
      { code: "73.11", label: "Reklamebyråer" },
      { code: "74.10", label: "Grafisk og kommunikasjonsdesign" },
    ],
  },
  {
    id: "transport",
    label: "Transport og logistikk",
    codes: [
      { code: "49.32", label: "Drosjebiltransport" },
      { code: "49.41", label: "Godstransport på vei" },
      { code: "52.29", label: "Speditør- og transportformidling" },
    ],
  },
  {
    id: "eiendom",
    label: "Eiendom og megling",
    codes: [
      { code: "68.10", label: "Kjøp og salg av egen fast eiendom" },
      { code: "68.31", label: "Eiendomsmegling" },
    ],
  },
  {
    id: "radgivning",
    label: "Rådgivning og regnskap",
    codes: [
      { code: "69.10", label: "Juridisk tjenesteyting" },
      { code: "69.20", label: "Regnskap og bokføring" },
      { code: "70.22", label: "Bedriftsrådgivning" },
    ],
  },
];

const NACE_CODE_MAP = new Map<string, string>(
  NACE_CODE_GROUPS.flatMap((group) =>
    group.codes.map((entry) => [entry.code, entry.label] as const)
  )
);

/** ILIKE-mønstre som treffer SN2007-koder i Supabase (f.eks. 56.10 → 56.110%). */
export function getNaceCodeDbIlikePatterns(naceCode: string): string[] {
  const trimmed = naceCode.trim();
  if (!trimmed) return [];

  const override = NACE_DB_PATTERN_OVERRIDES[trimmed];
  if (override?.length) return [...override];

  const patterns = new Set<string>();
  patterns.add(`${trimmed}%`);
  patterns.add(`${trimmed}0%`);

  const [division, rest] = trimmed.split(".");
  if (division && rest?.length === 2) {
    // SN2007: 56.10 lagres som 56.110
    patterns.add(`${division}.${rest[0]}${rest}%`);
  }
  if (division && rest) {
    patterns.add(`${division}.${rest[0]}%`);
  }

  return [...patterns];
}

/** PostgREST-filter for Supabase-spørring. */
export function getNaceCodeDbOrFilters(naceCode: string): string[] {
  return getNaceCodeDbIlikePatterns(naceCode).map((p) => `industry_code.ilike.${p}`);
}

/** Brreg `naeringskode`-parameter (uten %). */
export function getBrregNaeringskodeForNace(naceCode: string): string | undefined {
  const patterns = getNaceCodeDbIlikePatterns(naceCode);
  if (patterns.length === 0) return undefined;
  return patterns.map((p) => p.replace(/%$/, "")).join(",");
}

export function naceCodeLabel(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return NACE_CODE_MAP.get(trimmed) ?? null;
}

/** URL / lagret filter — kun kjente koder fra listen. */
export function parseNaceCodeFromParam(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return NACE_CODE_MAP.has(trimmed) ? trimmed : "";
}

export function matchesSpecificNaceCode(
  industryCode: string | null | undefined,
  naceCode: string
): boolean {
  const trimmed = naceCode.trim();
  if (!trimmed) return true;
  return matchesNaceCode(industryCode, [trimmed]);
}
