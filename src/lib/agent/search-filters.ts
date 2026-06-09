import {
  INDUSTRY_GROUPS,
  industryGroupLabel,
} from "@/lib/constants/industries";
import { resolveProfessionQuery } from "@/lib/constants/professions";

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
  {
    pattern: /\b(kultur|underholdning|artist|teater|musikk|museum)\b/,
    match: { label: "kulturfirma", filters: { industryGroup: "kultur" } },
  },
  {
    pattern: /\b(negler|nails|manikyr|pedikyr|vipper)\b/,
    match: {
      label: "neglesalonger",
      filters: { industryGroup: "skjonnhet", nameQuery: "negler" },
    },
  },
  {
    pattern: /\b(spa|velvære|velvaere|skjønnhet|skjonnhet)\b/,
    match: {
      label: "spa og skjønnhet",
      filters: { industryGroup: "skjonnhet", nameQuery: "spa" },
    },
  },
  {
    pattern: /\b(industri|produksjon|fabrikk)\b/,
    match: { label: "industrifirma", filters: { industryGroup: "industri" } },
  },
  {
    pattern: /\b(landbruk|bonde|gård|gard|skog|fiske)\b/,
    match: { label: "landbruksfirma", filters: { industryGroup: "landbruk" } },
  },
];

const PROFESSION_NAME_QUERY_RULES: Array<{
  professionId: string;
  pattern: RegExp;
  nameQuery: string;
}> = [
  {
    professionId: "frisor_spa",
    pattern: /\b(negler|nails|manikyr|pedikyr|vipper)\b/,
    nameQuery: "negler",
  },
  {
    professionId: "frisor_spa",
    pattern: /\b(spa|velvære|velvaere)\b/,
    nameQuery: "spa",
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchIndustryGroupInMessage(message: string): (typeof INDUSTRY_GROUPS)[number] | null {
  for (const group of INDUSTRY_GROUPS) {
    if (!group.id) continue;
    const pattern = new RegExp(
      `\\b${escapeRegExp(group.id)}(?:firma|firmaer|bedrift|bedrifter|selskap|foretak|handlere?|handler)?\\b`,
      "i"
    );
    if (pattern.test(message)) return group;
  }
  return null;
}

function pickNameQueryForProfession(
  professionId: string,
  message: string
): string | undefined {
  for (const rule of PROFESSION_NAME_QUERY_RULES) {
    if (rule.professionId === professionId && rule.pattern.test(message)) {
      return rule.nameQuery;
    }
  }
  return undefined;
}

function resolveFromProfession(message: string): IndustryKeywordMatch | null {
  const profession = resolveProfessionQuery(message);
  if (!profession?.professionId) return null;

  const industryGroup = mapProfessionToIndustryGroup(profession.professionId);
  if (!industryGroup) return null;

  const nameQuery = pickNameQueryForProfession(profession.professionId, message);
  const label =
    profession.label?.toLowerCase() ?? industryGroupLabel(industryGroup).toLowerCase();

  return {
    label,
    filters: {
      industryGroup,
      ...(nameQuery ? { nameQuery } : {}),
    },
  };
}

export function resolveIndustryKeyword(message: string): IndustryKeywordMatch | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  for (const rule of INDUSTRY_KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.match;
    }
  }

  const fromProfession = resolveFromProfession(normalized);
  if (fromProfession) return fromProfession;

  const group = matchIndustryGroupInMessage(normalized);
  if (group) {
    return {
      label: group.label.toLowerCase(),
      filters: { industryGroup: group.id },
    };
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
