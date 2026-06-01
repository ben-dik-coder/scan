/** Fylke/område — matcher første 2 siffer i kommunenummer (SSB/Brønnøysund) */

export type Region = {
  id: string;
  label: string;
  /** Kommunenummer-prefiks, f.eks. "18" for Nordland */
  countyPrefixes: string[];
};

export const REGIONS: Region[] = [
  { id: "", label: "Alle områder", countyPrefixes: [] },
  { id: "oslo", label: "Oslo", countyPrefixes: ["03"] },
  { id: "akershus", label: "Akershus", countyPrefixes: ["32"] },
  { id: "ostfold", label: "Østfold", countyPrefixes: ["31"] },
  { id: "buskerud", label: "Buskerud", countyPrefixes: ["33"] },
  { id: "innlandet", label: "Innlandet", countyPrefixes: ["34"] },
  { id: "vestfold", label: "Vestfold", countyPrefixes: ["39"] },
  { id: "telemark", label: "Telemark", countyPrefixes: ["40"] },
  { id: "agder", label: "Agder", countyPrefixes: ["42"] },
  { id: "rogaland", label: "Rogaland", countyPrefixes: ["11"] },
  { id: "vestland", label: "Vestland", countyPrefixes: ["46"] },
  { id: "more-romsdal", label: "Møre og Romsdal", countyPrefixes: ["15"] },
  { id: "trondelag", label: "Trøndelag", countyPrefixes: ["50"] },
  { id: "nordland", label: "Nordland", countyPrefixes: ["18"] },
  { id: "troms", label: "Troms", countyPrefixes: ["55"] },
  { id: "finnmark", label: "Finnmark", countyPrefixes: ["56"] },
];

export function regionLabel(regionId: string): string {
  return REGIONS.find((r) => r.id === regionId)?.label ?? "Alle områder";
}

export function kommuneBelongsToRegion(
  kommuneCode: string | null | undefined,
  regionId: string
): boolean {
  if (!regionId || !kommuneCode?.trim()) return true;
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region?.countyPrefixes.length) return true;
  const prefix = kommuneCode.trim().slice(0, 2);
  return region.countyPrefixes.includes(prefix);
}

export function expandRegionToKommuneCodes(
  regionId: string,
  allKommuneCodes: string[]
): string[] {
  if (!regionId) return [];
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region?.countyPrefixes.length) return [];
  return allKommuneCodes.filter((code) =>
    region.countyPrefixes.some((p) => code.startsWith(p))
  );
}
