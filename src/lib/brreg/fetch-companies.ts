import { computeLeadScore } from "@/lib/sales/lead-score";
import type { Company, CompanyWithLead } from "@/types/database";
import {
  daysAgoISO,
  fetchKommuner,
  formatDateISO,
  searchEnheter,
  type BrregEnhet,
  type SearchEnheterParams,
} from "./client";
import {
  getBrregNaeringskodeParam,
  matchesIndustryGroup,
} from "@/lib/constants/industries";
import { expandRegionToKommuneCodes } from "@/lib/constants/regions";
import { isPersonalEmail, mapBrregEnhet, type CompanyInsert } from "./map-company";

let kommuneCodesCache: string[] | null = null;

async function getAllKommuneCodes(): Promise<string[]> {
  if (!kommuneCodesCache) {
    const kommuner = await fetchKommuner();
    kommuneCodesCache = kommuner.map((k) => k.nummer).filter(Boolean);
  }
  return kommuneCodesCache;
}

async function resolveMunicipalityCodes(
  filters: BrregCompanyFilters
): Promise<{ municipalityCode?: string; municipalityCodes?: string[] }> {
  if (filters.municipalityCode) {
    return { municipalityCode: filters.municipalityCode };
  }
  if (!filters.regionId) return {};

  const allCodes = await getAllKommuneCodes();
  const codes = expandRegionToKommuneCodes(filters.regionId, allCodes);
  if (codes.length === 0) return {};
  if (codes.length === 1) return { municipalityCode: codes[0] };
  return { municipalityCodes: codes };
}

export type BrregCompanyFilters = {
  municipalityCode?: string;
  /** Fylke/område (tom = hele landet uten kommune-filter) */
  regionId?: string;
  /** 0 = alle registrerte (ingen datogrense) */
  days?: number;
  hasEmail?: boolean;
  genericEmailOnly?: boolean;
  industryGroup?: string;
  /** Maks antall sider à 100 firma */
  maxPages?: number;
};

export function isAllTimePeriod(days?: number): boolean {
  return days === 0;
}

function toCompany(row: CompanyInsert): Company {
  const now = new Date().toISOString();
  return {
    ...row,
    created_at: now,
    updated_at: now,
  };
}

function toCompanyWithLead(company: Company): CompanyWithLead {
  const score = computeLeadScore(company);
  return {
    ...company,
    user_lead: {
      user_id: "brreg-live",
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

function matchesFilters(
  company: Company,
  filters: BrregCompanyFilters
): boolean {
  if (!isAllTimePeriod(filters.days)) {
    const since = daysAgoISO(filters.days ?? 30);
    const reg = company.registered_at?.slice(0, 10);
    if (reg && reg < since) return false;
  }
  if (filters.hasEmail && !company.has_email) return false;
  if (filters.genericEmailOnly) {
    if (!company.email_is_generic) return false;
    if (company.email && isPersonalEmail(company.email)) return false;
  }
  if (!matchesIndustryGroup(company.industry_code, filters.industryGroup ?? "")) {
    return false;
  }
  return true;
}

function ingestEnheter(
  enheter: BrregEnhet[] | undefined,
  filters: BrregCompanyFilters,
  seen: Set<string>,
  companies: CompanyWithLead[]
) {
  for (const enhet of enheter ?? []) {
    const orgnr = enhet?.organisasjonsnummer;
    if (!orgnr || seen.has(orgnr)) continue;
    seen.add(orgnr);

    const company = toCompany(mapBrregEnhet(enhet));
    if (!matchesFilters(company, filters)) continue;

    companies.push(toCompanyWithLead(company));
  }
}

async function fetchPagesBatch(
  base: Omit<SearchEnheterParams, "page">,
  pages: number[]
) {
  return Promise.all(
    pages.map((page) => searchEnheter({ ...base, page, size: 100 }))
  );
}

/**
 * Henter firma direkte fra Brønnøysundregistrene (ingen database).
 */
export async function fetchCompaniesFromBrreg(
  filters: BrregCompanyFilters = {}
): Promise<{
  companies: CompanyWithLead[];
  total: number;
  withEmail: number;
  brregTotal: number | null;
  truncated: boolean;
}> {
  const allTime = isAllTimePeriod(filters.days);
  const days = filters.days ?? 30;
  const wantsFiltered = Boolean(filters.hasEmail || filters.genericEmailOnly);
  const industryBrregCodes = filters.industryGroup
    ? getBrregNaeringskodeParam(filters.industryGroup)
    : undefined;
  const industryAtBrreg = Boolean(industryBrregCodes);

  /**
   * Med bransje henter vi alle i Brreg (f.eks. 81 frisører i Narvik).
   * Periode filtreres etterpå hos oss — ellers får Brreg ofte 0 treff på «siste 30 dager».
   */
  const useBrregDateFilter = !industryAtBrreg && !allTime;
  const fromDate = useBrregDateFilter ? daysAgoISO(days) : undefined;
  const toDate = useBrregDateFilter ? formatDateISO(new Date()) : undefined;

  const geo = await resolveMunicipalityCodes(filters);
  const hasGeoFilter = Boolean(geo.municipalityCode || geo.municipalityCodes?.length);

  /**
   * Uten bransje i Brreg-søket: stopp tidlig (få sider med alle næringer).
   * Med bransje/område: hent alle sider Brreg returnerer.
   */
  const targetResults = industryAtBrreg ? 50_000 : wantsFiltered ? 250 : 400;

  const defaultMaxPages = allTime
    ? hasGeoFilter
      ? wantsFiltered
        ? 25
        : 12
      : wantsFiltered
        ? 15
        : 8
    : hasGeoFilter
      ? wantsFiltered
        ? 12
        : 6
      : wantsFiltered
        ? 10
        : 6;

  const maxPages =
    filters.maxPages ?? (industryAtBrreg ? 50 : defaultMaxPages);

  const searchBase: Omit<SearchEnheterParams, "page"> = {
    ...geo,
    naeringskode: industryBrregCodes,
    fromDate,
    toDate,
  };

  const companies: CompanyWithLead[] = [];
  const seen = new Set<string>();
  let brregTotal: number | null = null;
  let totalPagesFromApi = 1;
  let pagesFetched = 0;

  const first = await searchEnheter({ ...searchBase, page: 0, size: 100 });
  brregTotal = first.page?.totalElements ?? null;
  totalPagesFromApi = first.page?.totalPages ?? 1;
  pagesFetched = 1;
  ingestEnheter(first._embedded?.enheter, filters, seen, companies);

  const pagesToFetch: number[] = [];
  const fetchAllPages = industryAtBrreg;
  const pageLimit = fetchAllPages
    ? totalPagesFromApi
    : Math.min(maxPages, totalPagesFromApi);
  const lastPage = pageLimit - 1;
  for (let p = 1; p <= lastPage; p++) {
    pagesToFetch.push(p);
  }

  const batchSize = 4;
  for (let i = 0; i < pagesToFetch.length; i += batchSize) {
    if (!fetchAllPages && companies.length >= targetResults) break;

    const batch = pagesToFetch.slice(i, i + batchSize);
    const results = await fetchPagesBatch(searchBase, batch);
    pagesFetched += batch.length;
    for (const data of results) {
      ingestEnheter(data._embedded?.enheter, filters, seen, companies);
      if (!fetchAllPages && companies.length >= targetResults) break;
    }
  }

  companies.sort((a, b) =>
    (b.registered_at ?? "").localeCompare(a.registered_at ?? "")
  );

  const withEmail = companies.filter((c) => c.has_email).length;
  const truncated = pagesFetched < totalPagesFromApi;

  return {
    companies,
    total: companies.length,
    withEmail,
    brregTotal,
    truncated,
  };
}
