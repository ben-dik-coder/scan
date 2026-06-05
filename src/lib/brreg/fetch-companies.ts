import { computeLeadScore } from "@/lib/sales/lead-score";
import { seededRank } from "@/lib/shuffle/seeded-shuffle";
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
  getBrregNaeringskodeForProfession,
  matchesProfessionSearch,
  resolveProfessionQuery,
} from "@/lib/constants/professions";
import {
  getBrregNaeringskodeParam,
  matchesIndustryGroup,
} from "@/lib/constants/industries";
import { expandRegionToKommuneCodes } from "@/lib/constants/regions";
import { isPersonalEmail, mapBrregEnhet, type CompanyInsert } from "./map-company";

let kommuneCodesCache: string[] | null = null;

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 100;

export function parsePaginationParams(page?: number, pageSize?: number) {
  const parsedPage = Math.max(1, Math.floor(page ?? 1));
  const parsedPageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE))
  );
  return { page: parsedPage, pageSize: parsedPageSize };
}

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
  /** Fritekst yrke, f.eks. «rørlegger» */
  professionSearch?: string;
  /** Maks antall sider à 100 firma (sikkerhetsgrense) */
  maxPages?: number;
  /** 1-basert side */
  page?: number;
  pageSize?: number;
  /** Deterministisk rekkefølge før paginering */
  sortSeed?: string;
};

export function isAllTimePeriod(days?: number): boolean {
  return days === 0;
}

function toCompany(row: CompanyInsert): Company {
  const now = new Date().toISOString();
  return {
    ...row,
    daglig_leder: null,
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
      queued_at: null,
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
  if (
    !matchesIndustryGroup(company.industry_code, filters.industryGroup ?? "", {
      name: company.name,
      industryDescription: company.industry_description,
    })
  ) {
    return false;
  }
  if (filters.professionSearch?.trim()) {
    const professionMatch = resolveProfessionQuery(filters.professionSearch);
    if (
      professionMatch &&
      !matchesProfessionSearch(company.industry_code, {
        name: company.name,
        industryDescription: company.industry_description,
      }, professionMatch)
    ) {
      return false;
    }
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

function sortCompanies(
  companies: CompanyWithLead[],
  sortSeed?: string
) {
  if (sortSeed) {
    companies.sort((a, b) => {
      const rankDiff = seededRank(a.orgnr, sortSeed) - seededRank(b.orgnr, sortSeed);
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
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}> {
  const { page, pageSize } = parsePaginationParams(filters.page, filters.pageSize);
  const neededCount = page * pageSize + 1;

  const allTime = isAllTimePeriod(filters.days);
  const days = filters.days ?? 30;
  const wantsFiltered = Boolean(filters.hasEmail || filters.genericEmailOnly);
  const industryBrregCodes = filters.industryGroup
    ? getBrregNaeringskodeParam(filters.industryGroup)
    : undefined;
  const professionMatch = filters.professionSearch?.trim()
    ? resolveProfessionQuery(filters.professionSearch)
    : null;
  const professionBrregCodes = professionMatch
    ? getBrregNaeringskodeForProfession(professionMatch)
    : undefined;
  const brregNaeringskode = [industryBrregCodes, professionBrregCodes]
    .filter(Boolean)
    .join(",") || undefined;
  const industryAtBrreg = Boolean(brregNaeringskode);

  /**
   * Med bransje henter vi alle i Brreg (f.eks. 81 frisører i Narvik).
   * Periode filtreres etterpå hos oss — ellers får Brreg ofte 0 treff på «siste 30 dager».
   */
  const useBrregDateFilter = !industryAtBrreg && !allTime;
  const fromDate = useBrregDateFilter ? daysAgoISO(days) : undefined;
  const toDate = useBrregDateFilter ? formatDateISO(new Date()) : undefined;

  const geo = await resolveMunicipalityCodes(filters);
  const hasGeoFilter = Boolean(geo.municipalityCode || geo.municipalityCodes?.length);

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

  const searchBase: Omit<SearchEnheterParams, "page"> = {
    ...geo,
    naeringskode: brregNaeringskode,
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

  const fetchAllPages = industryAtBrreg;
  const pageAwareMaxPages = fetchAllPages
    ? totalPagesFromApi
    : Math.min(
        totalPagesFromApi,
        Math.max(
          filters.maxPages ?? defaultMaxPages,
          Math.ceil(neededCount / 15) + 3
        )
      );

  const pagesToFetch: number[] = [];
  const lastPage = pageAwareMaxPages - 1;
  for (let p = 1; p <= lastPage; p++) {
    pagesToFetch.push(p);
  }

  const batchSize = 4;
  for (let i = 0; i < pagesToFetch.length; i += batchSize) {
    if (!fetchAllPages && companies.length >= neededCount) break;

    const batch = pagesToFetch.slice(i, i + batchSize);
    const results = await fetchPagesBatch(searchBase, batch);
    pagesFetched += batch.length;
    for (const data of results) {
      ingestEnheter(data._embedded?.enheter, filters, seen, companies);
      if (!fetchAllPages && companies.length >= neededCount) break;
    }
  }

  sortCompanies(companies, filters.sortSeed);

  const total = companies.length;
  const allBrregPagesFetched = pagesFetched >= totalPagesFromApi;
  const truncated = !allBrregPagesFetched;

  const start = (page - 1) * pageSize;
  const pageCompanies = companies.slice(start, start + pageSize);
  const hasNext = total > page * pageSize || truncated;
  const hasPrev = page > 1;
  const totalPages = allBrregPagesFetched
    ? Math.max(1, Math.ceil(total / pageSize))
    : Math.max(page, hasNext ? page + 1 : page);

  const withEmail = pageCompanies.filter((c) => c.has_email).length;

  return {
    companies: pageCompanies,
    total,
    withEmail,
    brregTotal,
    truncated,
    page,
    pageSize,
    totalPages,
    hasNext,
    hasPrev,
  };
}
