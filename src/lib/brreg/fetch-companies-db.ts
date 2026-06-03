import {
  getIndustryCodeOrFilters,
  getWebbyraNameOrFilters,
  matchesIndustryGroup,
} from "@/lib/constants/industries";
import { expandRegionToKommuneCodes } from "@/lib/constants/regions";
import { computeLeadScore } from "@/lib/sales/lead-score";
import { seededRank } from "@/lib/shuffle/seeded-shuffle";
import { createServiceClient } from "@/lib/supabase/service";
import type { Company, CompanyWithLead } from "@/types/database";
import { daysAgoISO, fetchKommuner } from "./client";
import {
  isAllTimePeriod,
  parsePaginationParams,
  type BrregCompanyFilters,
} from "./fetch-companies";

let kommuneCodesCache: string[] | null = null;

async function getAllKommuneCodes(): Promise<string[]> {
  if (!kommuneCodesCache) {
    const kommuner = await fetchKommuner();
    kommuneCodesCache = kommuner.map((k) => k.nummer).filter(Boolean);
  }
  return kommuneCodesCache;
}

function applyIndustryFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  industryGroup?: string
) {
  if (!industryGroup) return query;

  const codeFilters = getIndustryCodeOrFilters(industryGroup);
  if (!codeFilters?.length) return query;

  let next = query.or(codeFilters.join(","));

  if (industryGroup === "webbyra") {
    next = next.or(getWebbyraNameOrFilters().join(","));
  }

  return next;
}

function toCompanyWithLead(company: Company): CompanyWithLead {
  const score = computeLeadScore(company);
  return {
    ...company,
    user_lead: {
      user_id: "brreg-db",
      orgnr: company.orgnr,
      status: "ny",
      score,
      notes: null,
      last_contacted_at: null,
      next_follow_up_at: null,
      created_at: company.created_at,
      updated_at: company.updated_at,
    },
  };
}

function sortCompanies(companies: CompanyWithLead[], sortSeed?: string) {
  if (sortSeed) {
    companies.sort((a, b) => {
      const rankDiff =
        seededRank(a.orgnr, sortSeed) - seededRank(b.orgnr, sortSeed);
      if (rankDiff !== 0) return rankDiff;
      return (b.registered_at ?? "").localeCompare(a.registered_at ?? "");
    });
    return;
  }

  companies.sort((a, b) =>
    (b.registered_at ?? "").localeCompare(a.registered_at ?? "")
  );
}

/**
 * Henter firma fra Supabase `companies` (full register etter bulk-import).
 */
export async function fetchCompaniesFromDb(
  filters: BrregCompanyFilters = {}
): Promise<{
  companies: CompanyWithLead[];
  total: number;
  withEmail: number;
  brregTotal: number | null;
  truncated: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  dbCompanyCount: number;
}> {
  const { page, pageSize } = parsePaginationParams(filters.page, filters.pageSize);
  const supabase = createServiceClient();

  let query = supabase.from("companies").select("*", { count: "exact" });

  if (!isAllTimePeriod(filters.days)) {
    query = query.gte("registered_at", daysAgoISO(filters.days ?? 30));
  }

  if (filters.municipalityCode) {
    query = query.eq("municipality_code", filters.municipalityCode);
  } else if (filters.regionId) {
    const allCodes = await getAllKommuneCodes();
    const codes = expandRegionToKommuneCodes(filters.regionId, allCodes);
    if (codes.length > 0) {
      query = query.in("municipality_code", codes);
    }
  }

  if (filters.hasEmail) {
    query = query.eq("has_email", true);
  }
  if (filters.genericEmailOnly) {
    query = query.eq("email_is_generic", true);
  }

  query = applyIndustryFilter(query, filters.industryGroup);

  query = query.order("registered_at", { ascending: false, nullsFirst: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as Company[];
  if (filters.industryGroup === "webbyra") {
    rows = rows.filter((c) =>
      matchesIndustryGroup(c.industry_code, "webbyra", { name: c.name })
    );
  }
  const companies = rows.map(toCompanyWithLead);
  sortCompanies(companies, filters.sortSeed);

  const total = count ?? companies.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const withEmail = companies.filter((c) => c.has_email).length;

  const { count: dbTotal } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });

  return {
    companies,
    total,
    withEmail,
    brregTotal: dbTotal ?? total,
    truncated: false,
    page,
    pageSize,
    totalPages,
    hasNext,
    hasPrev,
    dbCompanyCount: dbTotal ?? 0,
  };
}
