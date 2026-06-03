import { industryDivision } from "@/lib/constants/industries";

/** Norske søkeord fra NACE-divisjon — hjelper når merkenavn ≠ Brreg-navn */
const DIVISION_KEYWORDS: Record<string, string> = {
  "01": "gård landbruk",
  "02": "skog",
  "03": "fiske",
  "41": "bygg entreprenør",
  "42": "anlegg",
  "43": "håndverker snekker rørlegger elektriker",
  "47": "butikk handel",
  "49": "transport",
  "55": "hotell overnatting",
  "56": "restaurant café servering",
  "62": "IT konsulent",
  "63": "data",
  "68": "eiendom megler",
  "73": "reklame markedsføring",
  "86": "lege klinikk",
  "87": "omsorg",
  "88": "helse",
  "90": "kultur scene",
  "91": "museum",
  "93": "trening idrett",
  "96": "frisør skjønnhet spa",
};

export function industrySearchKeyword(
  industryCode: string | null | undefined
): string | null {
  const division = industryDivision(industryCode);
  if (!division) return null;
  return DIVISION_KEYWORDS[division] ?? null;
}
