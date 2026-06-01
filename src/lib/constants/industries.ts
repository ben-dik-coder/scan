/** NACE-bransjer (første del av næringskode, f.eks. 62.100 → 62) */

export type IndustryGroup = {
  id: string;
  label: string;
  /** Divisjonsprefiks uten punktum */
  prefixes: string[];
};

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  { id: "", label: "Alle bransjer", prefixes: [] },
  { id: "handel", label: "Handel og butikk", prefixes: ["47"] },
  { id: "servering", label: "Servering og overnatting", prefixes: ["55", "56"] },
  { id: "bygg", label: "Bygg og håndverk", prefixes: ["41", "42", "43"] },
  { id: "it", label: "IT og konsulenter", prefixes: ["62", "63"] },
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

export function matchesIndustryGroup(
  industryCode: string | null | undefined,
  groupId: string
): boolean {
  if (!groupId) return true;
  const group = INDUSTRY_GROUPS.find((g) => g.id === groupId);
  if (!group || group.prefixes.length === 0) return true;

  const division = industryDivision(industryCode);
  if (!division) return false;

  return group.prefixes.includes(division);
}

export function industryGroupLabel(groupId: string): string {
  return INDUSTRY_GROUPS.find((g) => g.id === groupId)?.label ?? "Alle bransjer";
}

/** Brreg `naeringskode`-parameter (kommaseparert, f.eks. 96 eller 49,50,51) */
export function getBrregNaeringskodeParam(groupId: string): string | undefined {
  if (!groupId) return undefined;
  const group = INDUSTRY_GROUPS.find((g) => g.id === groupId);
  if (!group?.prefixes.length) return undefined;
  return group.prefixes.join(",");
}
