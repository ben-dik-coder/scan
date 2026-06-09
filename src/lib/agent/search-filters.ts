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

type IndustryKeywordMatch = {
  label: string;
  filters: {
    industryGroup?: string;
    professionId?: string;
    nameQuery?: string;
  };
};

/** Vanlige brukerord → søkefilter (f.eks. byggevarehandler → bygg). */
const INDUSTRY_KEYWORD_RULES: Array<{
  pattern: RegExp;
  match: IndustryKeywordMatch;
}> = [
  {
    pattern: /\b(byggevarehandler|byggevarehandlere|byggevare|byggvare)\b/,
    match: { label: "byggevarehandlere", filters: { industryGroup: "bygg", nameQuery: "byggevare" } },
  },
  {
    pattern: /\b(byggfirma|byggfirmaer|byggmester|handverk|handverker|handverkere|håndverk|håndverker)\b/,
    match: { label: "bygg- og håndverksfirma", filters: { industryGroup: "bygg" } },
  },
  {
    pattern: /\b(frisor|frisør|frisører|frisor\s*salong|hårstudio|harstudio)\b/,
    match: { label: "frisører", filters: { industryGroup: "frisor" } },
  },
  {
    pattern: /\b(restaurant|restauranter|servering|kafe|café|cafe)\b/,
    match: { label: "serveringssteder", filters: { industryGroup: "servering" } },
  },
  {
    pattern: /\b(transport|transportfirma|taxi|flyttebyra|flyttebyrå)\b/,
    match: { label: "transportfirma", filters: { industryGroup: "transport" } },
  },
  {
    pattern: /\b(eiendom|eiendomsmegler|megler)\b/,
    match: { label: "eiendomsfirma", filters: { industryGroup: "eiendom" } },
  },
  {
    pattern: /\b(helse|lege|tannlege|fysioterapeut|barnehage)\b/,
    match: { label: "helsefirma", filters: { industryGroup: "helse" } },
  },
  {
    pattern: /\b(butikk|handel|handelsbedrift)\b/,
    match: { label: "handelsbedrifter", filters: { industryGroup: "handel" } },
  },
  {
    pattern: /\b(it[\s-]?firma|it[\s-]?selskap|webbyra|webbyrå|webdesign)\b/,
    match: { label: "IT-firma", filters: { industryGroup: "it" } },
  },
  {
    pattern: /\b(reklame|reklamebyra|reklamebyrå|markedsforing|markedsføring)\b/,
    match: { label: "reklamefirma", filters: { industryGroup: "reklame" } },
  },
];

export function resolveIndustryKeyword(message: string): IndustryKeywordMatch | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  for (const rule of INDUSTRY_KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.match;
    }
  }

  return null;
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
