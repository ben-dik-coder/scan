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
  reklame: "reklame",
  fotograf: "reklame",
  webdesign: "webbyra",
  it: "it",
  arkitekt: "bygg",
  bilvask: "handel",
  megler: "eiendom",
  taxi: "transport",
  flyttebyra: "transport",
  lege: "helse",
  tannlege: "helse",
  fysioterapeut: "helse",
  barnehage: "helse",
  trening: "helse",
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

/** Yrker med egne NACE-koder — ikke mapp til bred bransje. */
const KEEP_AS_PROFESSION = new Set([
  "advokat",
  "regnskap",
  "bilverksted",
  "rengjoring",
  "tatovering",
  "frisor",
]);

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
    match: { label: "frisører", filters: { professionId: "frisor" } },
  },
  {
    pattern: /\b(elektriker|elektrikere|el-installatør|el installatør|el-installator)\b/,
    match: { label: "elektrikere", filters: { industryGroup: "bygg", nameQuery: "elektro" } },
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
    pattern: /\b(advokat|advokater|advokatfirma|advokatfirmaer|jurist|juridisk)\b/,
    match: {
      label: "advokater",
      filters: { professionId: "advokat", nameQuery: "advokat" },
    },
  },
  {
    pattern:
      /\b(regnskapsfører|regnskapsforer|regnskapsførere|regnskapsforere|regnskap|revisor|revisjon)\b/,
    match: {
      label: "regnskapsførere",
      filters: { professionId: "regnskap", nameQuery: "regnskap" },
    },
  },
  {
    pattern: /\b(bilverksted|bilverksteder|bilverksted)\b/,
    match: { label: "bilverksteder", filters: { professionId: "bilverksted" } },
  },
  {
    pattern: /\b(rengjøring|rengjoring|renhold|vaktmester|vaskehjelp)\b/,
    match: { label: "rengjøringsfirma", filters: { professionId: "rengjoring" } },
  },
  {
    pattern: /\b(neglesalong|neglesalonger|negler|nails|manikyr|pedikyr|vipper)\b/,
    match: {
      label: "neglesalonger",
      filters: { industryGroup: "skjonnhet", nameQuery: "negler" },
    },
  },
  {
    pattern: /\b(tatoveringsstudio|tatovering|tattovering|tattoo|tatoverer)\b/,
    match: {
      label: "tatoveringsstudio",
      filters: { professionId: "tatovering", nameQuery: "tattoo" },
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

function defaultNameQueryForProfession(professionId: string): string | undefined {
  if (professionId === "advokat") return "advokat";
  if (professionId === "regnskap") return "regnskap";
  if (professionId === "tatovering") return "tattoo";
  return undefined;
}

function resolveFromProfession(message: string): IndustryKeywordMatch | null {
  const profession = resolveProfessionQuery(message);
  if (!profession?.professionId) return null;

  const professionId = profession.professionId;
  const nameQuery =
    pickNameQueryForProfession(professionId, message) ??
    defaultNameQueryForProfession(professionId);
  const label = profession.label?.toLowerCase() ?? professionId;

  if (KEEP_AS_PROFESSION.has(professionId)) {
    return {
      label,
      filters: {
        professionId,
        ...(nameQuery ? { nameQuery } : {}),
      },
    };
  }

  const industryGroup = mapProfessionToIndustryGroup(professionId);
  if (!industryGroup) return null;

  return {
    label: label || industryGroupLabel(industryGroup).toLowerCase(),
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

  if (KEEP_AS_PROFESSION.has(professionId)) {
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
