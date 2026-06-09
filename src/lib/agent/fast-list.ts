import {
  AGENT_DEFAULT_LIST_LIMIT,
  AGENT_MAX_FAST_LIST_LIMIT,
} from "@/lib/agent/constants";
import { isSimpleSearchIntent } from "@/lib/agent/prompt";
import { resolveIndustryKeyword } from "@/lib/agent/search-filters";

export type SimpleListCompany = {
  orgnr: string;
  name: string;
  phone?: string | null;
  municipality_name?: string | null;
};

export type ParsedSimpleListRequest = {
  limit: number;
  industryLabel: string;
  locationLabel: string;
  searchArgs: Record<string, unknown>;
};

const MUNICIPALITY_ALIASES: Record<string, string> = {
  oslo: "0301",
  bergen: "4601",
  trondheim: "5001",
  stavanger: "1103",
  bodø: "1804",
  bodo: "1804",
  narvik: "1806",
  tromsø: "5501",
  tromso: "5501",
  harstad: "5503",
  "mo i rana": "1833",
  "mo-i-rana": "1833",
  alta: "5601",
  hammerfest: "5603",
};

const REGION_ALIASES: Record<string, string> = {
  norge: "",
  "hele norge": "",
  nordland: "nordland",
  oslo: "oslo",
  trøndelag: "trondelag",
  trondelag: "trondelag",
  vestland: "vestland",
  rogaland: "rogaland",
};

function normalizeText(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

function parseLimit(message: string): number | undefined {
  const match = message.match(/\b(\d{1,2})\b/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, AGENT_MAX_FAST_LIST_LIMIT);
}

function parseMunicipality(message: string): { code?: string; label?: string } {
  for (const [alias, code] of Object.entries(MUNICIPALITY_ALIASES)) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(message)) {
      return { code, label: alias };
    }
  }
  return {};
}

function parseRegion(message: string): { id?: string; label?: string } {
  for (const [alias, id] of Object.entries(REGION_ALIASES)) {
    if (!id) continue;
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(message)) {
      return { id, label: alias };
    }
  }
  if (/\bi norge\b|\bhele landet\b/.test(message)) {
    return { id: "", label: "Norge" };
  }
  return {};
}

/** Bruker vil ha en kort liste med N firma — ikke skann/lagre. */
export function isSimpleListIntent(message: string): boolean {
  if (!isSimpleSearchIntent(message)) return false;

  const normalized = normalizeText(message);
  const hasListVerb =
    /^(finn|sok|søk|list|vis|hent|gi meg|gi)\b/.test(normalized) ||
    /\b(finn|list|vis|hent)\s+(meg\s+)?\d{1,2}\b/.test(normalized);
  const hasCount = /\b\d{1,2}\b/.test(normalized);
  const hasCompanyHint =
    /\b(byggevare|bygg|handverk|handverker|frisor|frisør|servering|transport|eiendom|helse|handl|firma|bedrift|butikk|handler|handlere)\b/.test(
      normalized
    );

  return hasListVerb && (hasCount || hasCompanyHint);
}

export function parseSimpleListRequest(
  message: string
): ParsedSimpleListRequest | null {
  if (!isSimpleListIntent(message)) return null;

  const normalized = normalizeText(message);
  const industry = resolveIndustryKeyword(normalized);
  if (!industry) return null;

  const limit = parseLimit(normalized) ?? AGENT_DEFAULT_LIST_LIMIT;
  const municipality = parseMunicipality(normalized);
  const region = parseRegion(normalized);

  const searchArgs: Record<string, unknown> = {
    limit,
    days: 0,
    ...industry.filters,
  };

  if (municipality.code) {
    searchArgs.municipalityCode = municipality.code;
  } else if (region.id) {
    searchArgs.regionId = region.id;
  }

  const locationLabel =
    municipality.label ??
    region.label ??
    (municipality.code || region.id ? "valgt område" : "Norge");

  return {
    limit,
    industryLabel: industry.label,
    locationLabel,
    searchArgs,
  };
}

export function formatFastListReply(
  companies: SimpleListCompany[],
  request: ParsedSimpleListRequest
): string {
  if (companies.length === 0) {
    return `Fant ingen ${request.industryLabel} i ${request.locationLabel}. Prøv et annet sted eller en annen bransje.`;
  }

  const lines = companies.map((company, index) => {
    const phone = (company.phone ?? "").trim();
    const place = (company.municipality_name ?? "").trim();
    const parts = [`${index + 1}. **${company.name}**`, `orgnr ${company.orgnr}`];
    if (phone) parts.push(`tlf ${phone}`);
    if (place) parts.push(place);
    return parts.join(" · ");
  });

  const header = `Her er ${companies.length} ${request.industryLabel} i ${request.locationLabel}:`;
  const footer =
    companies.length < request.limit
      ? `\n\nFant bare ${companies.length} i databasen. Si fra om du vil skanne nettside eller lagre som liste.`
      : "\n\nVil du skanne nettside eller lagre som liste? Si fra.";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}
