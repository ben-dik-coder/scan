import { INDUSTRY_GROUPS } from "@/lib/constants/industries";

const INDUSTRY_GROUP_IDS = new Set(
  INDUSTRY_GROUPS.map((g) => g.id).filter(Boolean)
);

/** Yrke-id som bør søkes som bransje for bedre dekning i DB. */
const PROFESSION_TO_INDUSTRY_GROUP: Record<string, string> = {
  frisor: "frisor",
  frisor_spa: "frisor",
  massasje: "skjonnhet",
  rorlegger: "bygg",
  elektriker: "bygg",
  snekker: "bygg",
  maler: "bygg",
  taktekker: "bygg",
  flislegger: "bygg",
  anlegg: "bygg",
  restaurant: "servering",
  kokk: "servering",
  baker: "servering",
  hotell: "servering",
  butikk: "handel",
  apotek: "handel",
  bilforhandler: "handel",
  bilverksted: "handel",
  reklame: "reklame",
  fotograf: "reklame",
  webdesign: "webbyra",
  it: "it",
  regnskap: "it",
  advokat: "it",
  arkitekt: "bygg",
  rengjoring: "handel",
  bilvask: "handel",
  megler: "eiendom",
  taxi: "transport",
  flyttebyra: "transport",
  lege: "helse",
  tannlege: "helse",
  fysioterapeut: "helse",
  barnehage: "helse",
  trening: "helse",
  tatovering: "kultur",
  negler: "skjonnhet",
  hudpleie: "skjonnhet",
};

export function mapProfessionToIndustryGroup(
  professionId: string | undefined
): string | undefined {
  const trimmed = professionId?.trim();
  if (!trimmed) return undefined;

  if (INDUSTRY_GROUP_IDS.has(trimmed)) {
    return trimmed;
  }

  const mapped = PROFESSION_TO_INDUSTRY_GROUP[trimmed];
  return mapped && INDUSTRY_GROUP_IDS.has(mapped) ? mapped : undefined;
}

export function resolveAgentSearchIndustryFilters(args: {
  industryGroup?: string;
  professionId?: string;
}): {
  industryGroup?: string;
  professionId?: string;
  mappedFromProfession?: string;
} {
  const industryGroup =
    typeof args.industryGroup === "string" && args.industryGroup.trim()
      ? args.industryGroup.trim()
      : undefined;
  const professionId =
    typeof args.professionId === "string" && args.professionId.trim()
      ? args.professionId.trim()
      : undefined;

  if (industryGroup || !professionId) {
    return { industryGroup, professionId };
  }

  const mapped = mapProfessionToIndustryGroup(professionId);
  if (!mapped) {
    return { industryGroup, professionId };
  }

  return {
    industryGroup: mapped,
    professionId: undefined,
    mappedFromProfession: professionId,
  };
}
