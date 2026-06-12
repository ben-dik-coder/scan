import { getEntitlements } from "@/lib/billing/entitlements";
import {
  getSerperUsage,
  SerperLimitReachedError,
} from "@/lib/billing/serper-usage";
import {
  applyCompanyContactLimit,
  hasContactInfo,
} from "@/lib/billing/usage";
import {
  AGENT_MAX_COMPANIES_PER_JOB,
  AGENT_MAX_FAST_LIST_LIMIT,
  AGENT_MAX_SCAN_PER_CALL,
  AGENT_MAX_SEARCH_PHONE_LOOKUPS,
  AGENT_PHONE_LOOKUP_TIMEOUT_MS,
  AGENT_SCAN_CONCURRENCY,
  AGENT_SCAN_DELAY_MS,
  AGENT_SCAN_ONE_TIMEOUT_MS,
  AGENT_SCAN_PROGRESS_BATCH,
  AGENT_SEARCH_OVERFETCH_MIN,
  AGENT_TOOL_SCAN_TIMEOUT_MS,
  AGENT_TOOL_SEARCH_TIMEOUT_MS,
} from "@/lib/agent/constants";
import { AGENT_LIST_PERIOD_DAYS } from "@/lib/agent/saved-list-filters";
import { resolveAgentSearchIndustryFilters } from "@/lib/agent/search-filters";
import {
  hasStoredWebsite,
  isCompetitorLeadCompany,
  WEBSITE_SALES_COMPETITOR_GROUPS,
} from "@/lib/agent/website-sales-leads";
import { buildAgentScanUrl } from "@/lib/agent/build-scan-url";
import {
  isBookingOnlyScan,
  isLeadWithoutOwnSite,
} from "@/lib/agent/website-presence";
import {
  loadContactOverrides,
  loadDbContactPatches,
  mergeContactOverride,
} from "@/lib/company-contact-overrides";
import { MAX_WEBSITE_SCAN_BATCH } from "@/lib/constants/market";
import { fetchEnhet } from "@/lib/brreg/client";
import { shouldUseBrregDb } from "@/lib/brreg/db-source";
import { fetchCompaniesFromDb } from "@/lib/brreg/fetch-companies-db";
import { fetchCompaniesFromBrreg } from "@/lib/brreg/fetch-companies";
import {
  isFrisorRelevantCompany,
  isFrisorSearchFilter,
} from "@/lib/brreg/frisor-search";
import {
  isProfessionRelevantCompany,
  isProfessionSearchFilter,
} from "@/lib/brreg/profession-relevance";
import {
  companyHasKnownWebsite,
  filterAgentLeadCompanies,
  filterWebsiteSalesLeadCompanies,
  getPlausibleCompanyPhone,
  hasCompanyPhone,
  rankAgentLeadCompanies,
  rankWebsiteSalesLeadCompanies,
} from "@/lib/brreg/lead-quality";
import { mapBrregEnhet } from "@/lib/brreg/map-company";
import { lookupFreeContact } from "@/lib/website-scan/lookup-directory-contact";
import {
  enrichScanContacts,
  scanCompanyWebsite,
} from "@/lib/website-scan/scan-company";
import { isWebsiteScanCacheComplete } from "@/lib/website-scan/scan-cache";
import {
  DEFAULT_SCAN_SOCIAL_OPTIONS,
  isSocialScanComplete,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import {
  loadCachedWebsiteScans,
  persistCachedWebsiteScans,
} from "@/lib/website-scan/saved-scans-server";
import { phoneCoreDigits } from "@/lib/website-scan/phone-plausible";
import { upsertUserMemory } from "@/lib/agent/user-memory";
import { formatCompanyExamples } from "@/lib/agent/format-summary";
import type { WebsiteScanCompanyInput, WebsiteScanResult } from "@/lib/website-scan/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Company } from "@/types/database";

export type AgentToolContext = {
  userId: string;
  runId: string;
  onProgress?: (progress: {
    tool: string;
    scanned: number;
    total: number;
  }) => void | Promise<void>;
};

export type ToolExecutionResult = {
  summary: string;
  data: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error(
                `${label} tok for lang tid (over ${Math.round(ms / 1000)} sek)`
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function uniqueOrgnrs(orgnrs: string[]): string[] {
  return Array.from(new Set(orgnrs.map((o) => o.trim()).filter(Boolean)));
}

function capOrgnrs(orgnrs: string[]): string[] {
  return uniqueOrgnrs(orgnrs).slice(0, AGENT_MAX_COMPANIES_PER_JOB);
}

function capScanOrgnrs(orgnrs: string[]): {
  orgnrs: string[];
  remainingOrgnrs: string[];
  capped: boolean;
} {
  const unique = capOrgnrs(orgnrs);
  const capped = unique.slice(0, AGENT_MAX_SCAN_PER_CALL);
  const remainingOrgnrs = unique.slice(AGENT_MAX_SCAN_PER_CALL);
  return {
    orgnrs: capped,
    remainingOrgnrs,
    capped: remainingOrgnrs.length > 0,
  };
}

function storePhone(value: string): { mobile?: string; phone?: string } {
  const core = phoneCoreDigits(value);
  if (!core || core.length !== 8) return {};
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  if (core.startsWith("7") || core.startsWith("2") || core.startsWith("3")) {
    return { phone: core };
  }
  return { mobile: core };
}

async function loadCompaniesByOrgnr(orgnrs: string[]): Promise<Company[]> {
  if (orgnrs.length === 0) return [];
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .in("orgnr", orgnrs);
  if (error) throw new Error(error.message);
  const byOrgnr = new Map((data ?? []).map((c) => [(c as Company).orgnr, c as Company]));
  return orgnrs.map((o) => byOrgnr.get(o)).filter(Boolean) as Company[];
}

function toScanInput(company: Company): WebsiteScanCompanyInput {
  return {
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    municipality_name: company.municipality_name,
    city: company.city,
    website: company.website,
    industry_code: company.industry_code,
  };
}

async function updateRunProgress(
  runId: string,
  patch: Record<string, unknown>
) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_runs")
    .select("progress")
    .eq("id", runId)
    .single();
  const current = (data?.progress as Record<string, unknown> | null) ?? {};
  await supabase
    .from("agent_runs")
    .update({ progress: { ...current, ...patch } })
    .eq("id", runId);
}

export async function executeAgentTool(
  ctx: AgentToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (name) {
    case "get_entitlements":
      return executeGetEntitlements(ctx);
    case "get_usage":
      return executeGetUsage(ctx);
    case "list_saved_lists":
      return executeListSavedLists(ctx);
    case "load_saved_list":
      return executeLoadSavedList(ctx, args);
    case "filter_leads":
      return executeFilterLeads(ctx, args);
    case "remember_preference":
      return executeRememberPreference(ctx, args);
    case "search_companies":
      return executeSearchCompanies(ctx, args);
    case "scan_websites":
      return executeScanWebsites(ctx, args);
    case "enrich_contacts":
      return executeEnrichContacts(ctx, args);
    case "filter_no_website":
      return executeFilterNoWebsite(ctx, args);
    case "save_list":
      return executeSaveList(ctx, args);
    default:
      return {
        summary: `Ukjent verktøy: ${name}`,
        data: { error: "unknown_tool" },
      };
  }
}

async function executeGetEntitlements(
  ctx: AgentToolContext
): Promise<ToolExecutionResult> {
  return executeGetUsage(ctx);
}

async function executeGetUsage(
  ctx: AgentToolContext
): Promise<ToolExecutionResult> {
  const [entitlements, serper] = await Promise.all([
    getEntitlements(ctx.userId),
    getSerperUsage(ctx.userId),
  ]);

  return {
    summary: `Serper ${serper.used}/${serper.limit} (${serper.remaining} igjen). Kontakt ${entitlements.companiesWithContactRemaining}/${entitlements.maxCompaniesWithContactPerMonth} igjen.`,
    data: {
      hasAccess: entitlements.hasAccess,
      serperUsed: serper.used,
      serperLimit: serper.limit,
      serperRemaining: serper.remaining,
      serperLimitReached: serper.limitReached,
      companiesWithContactUsed: entitlements.companiesWithContactUsed,
      companiesWithContactRemaining: entitlements.companiesWithContactRemaining,
      maxCompaniesWithContactPerMonth:
        entitlements.maxCompaniesWithContactPerMonth,
      estimatedSerperPerCompany: 4,
    },
  };
}

function mapScanForAgent(scan: WebsiteScanResult) {
  return {
    orgnr: scan.orgnr,
    hasWebsite: scan.hasWebsite,
    websiteKind: scan.websiteKind,
    websiteUrl: scan.websiteUrl,
    bookingPlatform: scan.bookingPlatform,
    countsAsNoWebsite: isLeadWithoutOwnSite(scan),
    confidence: scan.confidence,
    websiteDiscoverySource: scan.websiteDiscoverySource ?? null,
    displayName: scan.displayName ?? null,
    gulesiderListed: scan.gulesiderListed ?? false,
    gulesiderUrl: scan.gulesiderUrl ?? null,
    enrichedPhone: scan.enrichedPhone ?? null,
    enrichedPhoneSource: scan.enrichedPhoneSource ?? null,
    enrichedEmail: scan.enrichedEmail ?? null,
    enrichedEmailSource: scan.enrichedEmailSource ?? null,
    facebookUrl: scan.facebookUrl ?? null,
    linkedinUrl: scan.linkedinUrl ?? null,
    instagramUrl: scan.instagramUrl ?? null,
    error: scan.error ?? null,
  };
}

async function executeListSavedLists(
  ctx: AgentToolContext
): Promise<ToolExecutionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .select("id, name, filters, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return { summary: `Kunne ikke hente lister: ${error.message}`, data: { error: error.message } };
  }

  const lists = (data ?? []).map((row) => {
    const filters = (row.filters as Record<string, unknown> | null) ?? {};
    const agentOrgnrs = Array.isArray(filters.agentOrgnrs)
      ? (filters.agentOrgnrs as string[])
      : [];
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
      createdBy: typeof filters.createdBy === "string" ? filters.createdBy : null,
      orgnrCount: agentOrgnrs.length,
      municipalityCode:
        typeof filters.municipalityCode === "string" ? filters.municipalityCode : "",
      industryGroup:
        typeof filters.industryGroup === "string" ? filters.industryGroup : "",
    };
  });

  return {
    summary: `Fant ${lists.length} lagrede lister${lists[0] ? ` — sist: «${lists[0].name}» (${lists[0].orgnrCount} firma)` : ""}`,
    data: { lists },
  };
}

async function executeLoadSavedList(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = typeof args.listId === "string" ? args.listId.trim() : "";
  const listName = typeof args.name === "string" ? args.name.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("saved_lists")
    .select("id, name, filters")
    .eq("user_id", ctx.userId);

  if (listId) {
    query = query.eq("id", listId);
  } else if (listName) {
    query = query.ilike("name", listName);
  } else {
    return { summary: "Oppgi listId eller name", data: { error: "missing_list_ref" } };
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    return { summary: `Kunne ikke hente liste: ${error.message}`, data: { error: error.message } };
  }
  if (!data) {
    return { summary: "Listen finnes ikke", data: { error: "not_found" } };
  }

  const filters = (data.filters as Record<string, unknown> | null) ?? {};
  const orgnrs = capOrgnrs(
    Array.isArray(filters.agentOrgnrs) ? (filters.agentOrgnrs as string[]) : []
  );

  await updateRunProgress(ctx.runId, {
    phase: "list_loaded",
    searchFilters: filters,
    orgnrs,
    remainingOrgnrs: orgnrs,
  });

  return {
    summary: `Lastet liste «${data.name}» med ${orgnrs.length} firma`,
    data: {
      listId: data.id,
      listName: data.name,
      orgnrs,
      filters,
    },
  };
}

async function executeFilterLeads(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnrs = capOrgnrs(
    Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : []
  );
  if (orgnrs.length === 0) {
    return { summary: "Ingen firma å filtrere", data: { orgnrs: [] } };
  }

  const facebookOnly = args.facebookOnly === true;
  const hasPhone = args.hasPhone === true;
  const minConfidence =
    typeof args.minConfidence === "string" ? args.minConfidence : undefined;

  const [scans, companies] = await Promise.all([
    loadCachedWebsiteScans(orgnrs),
    loadCompaniesByOrgnr(orgnrs),
  ]);
  const scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));
  const companyByOrgnr = new Map(companies.map((c) => [c.orgnr, c]));

  const matched = orgnrs.filter((orgnr) => {
    const scan = scanByOrgnr.get(orgnr);
    const company = companyByOrgnr.get(orgnr);
    if (facebookOnly) {
      if (scan?.facebookUrl) return true;
      return false;
    }
    if (hasPhone) {
      if (scan?.enrichedPhone) return true;
      if (company && hasCompanyPhone(company)) return true;
      return false;
    }
    if (!scan) return false;
    if (minConfidence === "high" && scan.confidence !== "high") return false;
    if (minConfidence === "medium" && scan.confidence === "low") return false;
    return true;
  });

  const matchedCompanies = await loadCompaniesByOrgnr(matched);

  return {
    summary: `Fant ${matched.length} firma${formatCompanyExamples(matchedCompanies.map((c) => c.name))}`,
    data: {
      orgnrs: matched,
      count: matched.length,
      filters: { facebookOnly, hasPhone, minConfidence },
      companies: matchedCompanies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
        facebookUrl: scanByOrgnr.get(c.orgnr)?.facebookUrl ?? null,
      })),
    },
  };
}

async function executeRememberPreference(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const key = typeof args.key === "string" ? args.key.trim() : "";
  const value = typeof args.value === "string" ? args.value.trim() : "";
  if (!key || !value) {
    return { summary: "Trenger key og value", data: { error: "missing_fields" } };
  }

  await upsertUserMemory(ctx.userId, key, value);
  return {
    summary: `Husket ${key}: ${value}`,
    data: { key, value },
  };
}

type CompanySearchFilters = {
  municipalityCode?: string;
  regionId?: string;
  industryGroup?: string;
  professionId?: string;
  nameQuery?: string;
  days: number;
  hasEmail: boolean;
  page: number;
  pageSize: number;
  withoutWebsite?: boolean;
  excludeIndustryGroups?: string[];
};

async function runCompanySearch(
  searchArgs: CompanySearchFilters,
  useDb: boolean
) {
  return withTimeout(
    useDb
      ? fetchCompaniesFromDb(searchArgs)
      : fetchCompaniesFromBrreg(searchArgs),
    AGENT_TOOL_SEARCH_TIMEOUT_MS,
    "Søk"
  );
}

function isWebsiteSalesSearch(
  withoutWebsite: boolean,
  excludeIndustryGroups?: string[]
): boolean {
  return withoutWebsite && (excludeIndustryGroups?.length ?? 0) > 0;
}

const NAME_QUERY_ALTERNATES: Record<string, string[]> = {
  negler: ["negler", "nail", "manikyr"],
  tatover: ["tatover", "tattoo", "tattover", "tatoveringsstudio"],
  tattoo: ["tattoo", "tatover", "tatoveringsstudio"],
  byggevare: ["byggevare", "byggmakker", "trelast"],
  grill: ["grill", "grillbar", "bbq", "kebab"],
  grillbar: ["grillbar", "grill", "bbq", "kebab"],
};

async function executeSearchCompanies(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const municipalityCode =
    typeof args.municipalityCode === "string" ? args.municipalityCode : undefined;
  const regionId = typeof args.regionId === "string" ? args.regionId : undefined;
  const {
    industryGroup,
    professionId,
    mappedFromProfession,
  } = resolveAgentSearchIndustryFilters({
    industryGroup:
      typeof args.industryGroup === "string" ? args.industryGroup : undefined,
    professionId:
      typeof args.professionId === "string" ? args.professionId : undefined,
  });
  const nameQuery =
    typeof args.nameQuery === "string" && args.nameQuery.trim().length >= 2
      ? args.nameQuery.trim()
      : undefined;
  const defaultDays = industryGroup || professionId || nameQuery ? 0 : 30;
  const days =
    typeof args.days === "number" && Number.isFinite(args.days)
      ? args.days
      : defaultDays;
  const requirePhone = args.requirePhone === true;
  const withoutWebsite = args.withoutWebsite === true;
  const excludeOrgnrs = Array.isArray(args.excludeOrgnrs)
    ? uniqueOrgnrs(
        (args.excludeOrgnrs as string[]).filter(
          (value) => typeof value === "string" && /^\d{9}$/.test(value.trim())
        )
      )
    : [];
  const excludeIndustryGroups = Array.isArray(args.excludeIndustryGroups)
    ? (args.excludeIndustryGroups as string[]).filter(
        (value) => typeof value === "string" && value.trim()
      )
    : withoutWebsite
      ? [...WEBSITE_SALES_COMPETITOR_GROUPS]
      : undefined;
  const requestedLimit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.floor(args.limit)
      : undefined;
  const displayLimit =
    typeof args.displayLimit === "number" && Number.isFinite(args.displayLimit)
      ? Math.min(Math.floor(args.displayLimit), AGENT_MAX_FAST_LIST_LIMIT)
      : undefined;
  const resultLimit =
    displayLimit ??
    (requestedLimit && requestedLimit > 0
      ? Math.min(requestedLimit, AGENT_MAX_FAST_LIST_LIMIT)
      : AGENT_MAX_COMPANIES_PER_JOB);
  const fetchLimit =
    requestedLimit && requestedLimit > 0
      ? requestedLimit
      : AGENT_MAX_COMPANIES_PER_JOB;
  const frisorSearch = isFrisorSearchFilter({
    professionId,
    industryGroup,
    mappedFromProfession,
  });
  const professionSearch = isProfessionSearchFilter({
    professionId,
    mappedFromProfession,
  });
  const websiteSalesMode = isWebsiteSalesSearch(
    withoutWebsite,
    excludeIndustryGroups
  );
  const implicitFastList =
    !websiteSalesMode &&
    !withoutWebsite &&
    !(excludeIndustryGroups?.length ?? 0) &&
    requestedLimit !== undefined &&
    requestedLimit > 0 &&
    requestedLimit <= AGENT_MAX_FAST_LIST_LIMIT &&
    !requirePhone;
  const fastList =
    (args.fastList === true || implicitFastList) &&
    !websiteSalesMode &&
    !withoutWebsite &&
    !(excludeIndustryGroups?.length ?? 0);
  const nationwideWebsiteSales =
    websiteSalesMode && !municipalityCode && !regionId;
  const overfetchMultiplier = nationwideWebsiteSales
    ? 48
    : websiteSalesMode
    ? 32
    : withoutWebsite || excludeIndustryGroups?.length
      ? 24
      : frisorSearch || professionSearch
        ? 16
        : 8;
  const simpleListFetchLimit =
    requestedLimit && requestedLimit > 0 ? requestedLimit : resultLimit;
  const pageSize = fastList
    ? Math.min(simpleListFetchLimit + 5, AGENT_MAX_COMPANIES_PER_JOB)
    : fetchLimit && fetchLimit > 0
      ? Math.min(
          Math.max(fetchLimit * overfetchMultiplier, AGENT_SEARCH_OVERFETCH_MIN),
          AGENT_MAX_COMPANIES_PER_JOB
        )
      : AGENT_MAX_COMPANIES_PER_JOB;

  const searchArgs: CompanySearchFilters = {
    municipalityCode,
    regionId,
    industryGroup,
    professionId,
    nameQuery,
    days,
    hasEmail: false,
    page: 1,
    pageSize,
    withoutWebsite: withoutWebsite || undefined,
    excludeIndustryGroups,
  };

  const useDb = await shouldUseBrregDb();
  let result;
  let retriedBroader = false;
  let dataSource: "database" | "live_brreg" = useDb ? "database" : "live_brreg";
  try {
    result = await runCompanySearch(searchArgs, useDb);

    if (result.companies.length === 0 && useDb) {
      const live = await runCompanySearch(searchArgs, false);
      if (live.companies.length > 0) {
        result = live;
        dataSource = "live_brreg";
      }
    }

    if (result.companies.length === 0) {
      if (nameQuery && industryGroup) {
        const broader = { ...searchArgs, nameQuery: undefined };
        const retry = await runCompanySearch(broader, useDb);
        if (retry.companies.length > 0) {
          result = retry;
          searchArgs.nameQuery = undefined;
          retriedBroader = true;
        }
      } else if (nameQuery) {
        const alternates = NAME_QUERY_ALTERNATES[nameQuery] ?? [nameQuery];
        for (const alt of alternates) {
          if (alt === nameQuery) continue;
          const retry = await runCompanySearch({ ...searchArgs, nameQuery: alt }, useDb);
          if (retry.companies.length > 0) {
            result = retry;
            searchArgs.nameQuery = alt;
            retriedBroader = true;
            break;
          }
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Søket feilet";
    return {
      summary: message,
      data: { error: "search_timeout", message },
    };
  }

  const orgnrs = result.companies.map((c) => c.orgnr);
  const [overrideMap, dbPatchMap] = await Promise.all([
    loadContactOverrides(orgnrs),
    loadDbContactPatches(orgnrs),
  ]);

  let companies = result.companies.map((company) => {
    const brregMissingContact =
      !(company.mobile ?? "").trim() && !(company.phone ?? "").trim();
    const override =
      overrideMap.get(company.orgnr) ??
      (brregMissingContact ? dbPatchMap.get(company.orgnr) : undefined);
    const merged = mergeContactOverride(company, override);
    const plausiblePhone = getPlausibleCompanyPhone(merged);
    return {
      ...merged,
      phone: plausiblePhone,
      mobile: plausiblePhone ? null : merged.mobile,
    };
  });

  const filteredCount = companies.length;
  companies = filterAgentLeadCompanies(companies);
  let removedBadLeads = filteredCount - companies.length;

  if (frisorSearch) {
    const beforeFrisor = companies.length;
    companies = companies.filter((company) => isFrisorRelevantCompany(company));
    removedBadLeads += beforeFrisor - companies.length;
  }

  const activeProfessionId = professionId ?? mappedFromProfession;
  if (professionSearch && activeProfessionId) {
    const beforeProfession = companies.length;
    companies = companies.filter((company) =>
      isProfessionRelevantCompany(activeProfessionId, company)
    );
    removedBadLeads += beforeProfession - companies.length;
  }

  if (withoutWebsite) {
    const beforeWebsite = companies.length;
    companies = companies.filter((company) => !hasStoredWebsite(company.website));
    removedBadLeads += beforeWebsite - companies.length;
  }

  if (excludeIndustryGroups?.length) {
    const beforeCompetitors = companies.length;
    companies = companies.filter((company) => !isCompetitorLeadCompany(company));
    removedBadLeads += beforeCompetitors - companies.length;
  }

  if (websiteSalesMode) {
    const beforeWeak = companies.length;
    companies = filterWebsiteSalesLeadCompanies(companies);
    removedBadLeads += beforeWeak - companies.length;
  }

  if (excludeOrgnrs.length > 0) {
    const excludeSet = new Set(excludeOrgnrs);
    const beforeExclude = companies.length;
    companies = companies.filter((company) => !excludeSet.has(company.orgnr));
    removedBadLeads += beforeExclude - companies.length;
  }

  let scanByOrgnr = new Map<string, WebsiteScanResult>();
  if (withoutWebsite && companies.length > 0) {
    const scans = await loadCachedWebsiteScans(companies.map((company) => company.orgnr));
    scanByOrgnr = new Map(scans.map((scan) => [scan.orgnr, scan]));
    const beforeScan = companies.length;
    companies = companies.filter(
      (company) => !companyHasKnownWebsite(company, scanByOrgnr.get(company.orgnr))
    );
    removedBadLeads += beforeScan - companies.length;
  }

  if (requestedLimit && requestedLimit > 0) {
    companies = websiteSalesMode
      ? rankWebsiteSalesLeadCompanies(companies, scanByOrgnr)
      : rankAgentLeadCompanies(companies);
    const missingPhone = companies.filter((company) => !hasCompanyPhone(company));
    if (requirePhone && missingPhone.length > 0) {
      const maxLookups = Math.min(resultLimit, AGENT_MAX_SEARCH_PHONE_LOOKUPS);
      const lookupTargets = missingPhone.slice(0, maxLookups);
      await Promise.all(
        lookupTargets.map(async (company) => {
          const hit = await withTimeout(
            lookupFreeContact({
              orgnr: company.orgnr,
              name: company.name,
              email: company.email,
              website: company.website,
              municipality_name: company.municipality_name,
              city: company.city,
              industry_code: company.industry_code,
            }),
            AGENT_PHONE_LOOKUP_TIMEOUT_MS,
            `Telefon ${company.name}`
          ).catch(() => null);
          if (!hit?.phone) return;
          Object.assign(company, storePhone(hit.phone));
        })
      );
      companies = websiteSalesMode
        ? rankWebsiteSalesLeadCompanies(companies, scanByOrgnr)
        : rankAgentLeadCompanies(companies);
    }
    if (requirePhone) {
      companies = companies.filter((company) => hasCompanyPhone(company));
    }
    companies = companies.slice(0, resultLimit);
  } else {
    companies = websiteSalesMode
      ? rankWebsiteSalesLeadCompanies(companies, scanByOrgnr)
      : rankAgentLeadCompanies(companies);
    if (requirePhone) {
      companies = companies.filter((company) => hasCompanyPhone(company));
    }
    companies = companies.slice(0, resultLimit);
  }

  const truncated = result.total > AGENT_MAX_COMPANIES_PER_JOB;
  const truncatedHint = truncated
    ? "Snevr inn med municipalityCode, regionId eller industryGroup, eller kjør nytt søk med days: 0."
    : null;
  const searchFilters = {
    municipalityCode,
    regionId,
    industryGroup,
    professionId,
    nameQuery,
    mappedFromProfession,
    days,
    withoutWebsite: withoutWebsite || undefined,
    excludeIndustryGroups,
  };

  await updateRunProgress(ctx.runId, {
    phase: "search_done",
    searchFilters,
    orgnrs,
    remainingOrgnrs: orgnrs,
    scanned: 0,
    total: orgnrs.length,
  });

  const withPhoneCount = companies.filter((c) => hasCompanyPhone(c)).length;
  const phonePart =
    withPhoneCount > 0 ? ` (${withPhoneCount} med telefon)` : "";
  const truncatedPart = truncated
    ? ` — viste ${AGENT_MAX_COMPANIES_PER_JOB} av ${result.total}`
    : "";

  return {
    summary: `Fant ${companies.length} firma${phonePart}${truncatedPart}${formatCompanyExamples(companies.map((c) => c.name))}`,
    data: {
      retriedBroader,
      removedBadLeads,
      withPhoneCount,
      companies: companies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
        website: c.website,
        municipality_name: c.municipality_name,
        registered_at: c.registered_at,
        industry_code: c.industry_code,
        leadScore:
          "user_lead" in c && c.user_lead && typeof c.user_lead.score === "number"
            ? c.user_lead.score
            : undefined,
      })),
      total: result.total,
      returned: companies.length,
      truncated,
      truncatedHint,
      withEmail: result.withEmail,
      dbCompanyCount: "dbCompanyCount" in result ? result.dbCompanyCount : undefined,
      dataSource: dataSource,
      orgnrs: companies.map((c) => c.orgnr),
      filters: searchFilters,
    },
  };
}

async function executeScanWebsites(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const requested = Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : [];
  const { orgnrs, remainingOrgnrs, capped } = capScanOrgnrs(requested);
  if (orgnrs.length === 0) {
    return { summary: "Ingen firma å skanne", data: { scans: [] } };
  }

  const companies = await loadCompaniesByOrgnr(orgnrs);
  const scans: WebsiteScanResult[] = [];
  let scanned = 0;
  const deadline = Date.now() + AGENT_TOOL_SCAN_TIMEOUT_MS;
  let timedOut = false;

  await updateRunProgress(ctx.runId, {
    phase: "scan_websites",
    orgnrs,
    scanned: 0,
    total: companies.length,
    remainingOrgnrs: [...remainingOrgnrs, ...orgnrs],
  });

  const social: ScanSocialOptions = {
    ...DEFAULT_SCAN_SOCIAL_OPTIONS,
    includeFacebook: args.includeFacebook === true,
    includeInstagram: args.includeInstagram === true,
  };

  async function scanOneCompany(
    company: Company,
    cachedByOrgnr: Map<string, WebsiteScanResult>
  ): Promise<WebsiteScanResult> {
    const input = toScanInput(company);
    let scan = cachedByOrgnr.get(company.orgnr);
    if (scan && isWebsiteScanCacheComplete(scan, social)) {
      return scan;
    }
    if (scan && isSocialScanComplete(scan, social)) {
      scan = await withTimeout(
        enrichScanContacts(input, scan),
        AGENT_SCAN_ONE_TIMEOUT_MS,
        `Berik ${company.name}`
      );
      await persistCachedWebsiteScans([scan], ctx.userId);
      return scan;
    }

    scan = await withTimeout(
      scanCompanyWebsite(input, { social, userId: ctx.userId }),
      AGENT_SCAN_ONE_TIMEOUT_MS,
      `Skann ${company.name}`
    );
    await persistCachedWebsiteScans([scan], ctx.userId);
    return scan;
  }

  async function recordScanProgress(force = false) {
    const pendingOrgnrs = [...orgnrs.slice(scanned), ...remainingOrgnrs];
    const isLast = scanned >= companies.length;
    if (
      force ||
      isLast ||
      scanned === 1 ||
      scanned % AGENT_SCAN_PROGRESS_BATCH === 0
    ) {
      await updateRunProgress(ctx.runId, {
        phase: "scan_websites",
        orgnrs,
        scanned,
        total: companies.length,
        remainingOrgnrs: pendingOrgnrs,
      });
    }
    await ctx.onProgress?.({
      tool: "scan_websites",
      scanned,
      total: companies.length,
    });
  }

  for (let i = 0; i < companies.length; i += MAX_WEBSITE_SCAN_BATCH) {
    if (Date.now() > deadline) {
      timedOut = true;
      break;
    }

    const batch = companies.slice(i, i + MAX_WEBSITE_SCAN_BATCH);
    const cached = await loadCachedWebsiteScans(batch.map((c) => c.orgnr));
    const cachedByOrgnr = new Map(cached.map((s) => [s.orgnr, s]));

    for (let j = 0; j < batch.length; j += AGENT_SCAN_CONCURRENCY) {
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }

      const chunk = batch.slice(j, j + AGENT_SCAN_CONCURRENCY);
      let serperLimitError: SerperLimitReachedError | undefined;

      const chunkResults = await Promise.all(
        chunk.map(async (company) => {
          if (Date.now() > deadline) return null;
          try {
            return await scanOneCompany(company, cachedByOrgnr);
          } catch (err) {
            if (err instanceof SerperLimitReachedError) {
              serperLimitError = err;
              return null;
            }

            const message = err instanceof Error ? err.message : "Skann feilet";
            return {
              orgnr: company.orgnr,
              hasWebsite: false,
              websiteKind: "none" as const,
              websiteUrl: null,
              websiteDomain: null,
              bookingPlatform: null,
              source: "none" as const,
              confidence: "low" as const,
              query: company.name,
              scannedAt: new Date().toISOString(),
              error: message,
              displayName: company.name,
            } satisfies WebsiteScanResult;
          }
        })
      );

      if (serperLimitError) {
        const pendingOrgnrs = [...orgnrs.slice(scans.length), ...remainingOrgnrs];
        await updateRunProgress(ctx.runId, {
          phase: "scan_websites",
          orgnrs,
          scanned: scans.length,
          total: companies.length,
          remainingOrgnrs: pendingOrgnrs,
          serperLimitReached: true,
        });
        return {
          summary: serperLimitError.message,
          data: {
            scanned: scans.length,
            serperLimitReached: true,
            serperUsage: serperLimitError.usage,
            remainingOrgnrs: pendingOrgnrs,
            scans: scans.map((s) => ({
              orgnr: s.orgnr,
              hasWebsite: s.hasWebsite,
            })),
          },
        };
      }

      for (const scan of chunkResults) {
        if (!scan) continue;
        scans.push(scan);
        scanned++;
        await recordScanProgress();
      }

      if (timedOut) break;
    }

    if (timedOut) break;

    if (i + MAX_WEBSITE_SCAN_BATCH < companies.length) {
      await sleep(AGENT_SCAN_DELAY_MS);
    }
  }

  const withoutSite = scans.filter((s) => isLeadWithoutOwnSite(s)).length;
  const bookingOnly = scans.filter((s) => isBookingOnlyScan(s)).length;
  const withoutSiteNames = scans
    .filter((s) => isLeadWithoutOwnSite(s))
    .map((s) => companies.find((c) => c.orgnr === s.orgnr)?.name ?? s.displayName ?? s.orgnr)
    .filter(Boolean) as string[];

  const pendingOrgnrs = timedOut
    ? [...orgnrs.slice(scans.length), ...remainingOrgnrs]
    : remainingOrgnrs;

  await updateRunProgress(ctx.runId, {
    phase: timedOut ? "scan_websites" : "scan_done",
    orgnrs,
    scanned: scans.length,
    total: companies.length,
    remainingOrgnrs: pendingOrgnrs,
    timedOut: timedOut || undefined,
  });

  const limitParts: string[] = [];
  if (capped) {
    limitParts.push(
      `${remainingOrgnrs.length} gjenstår — si fra om du vil fortsette`
    );
  }
  if (timedOut) {
    limitParts.push("tok for lang tid — si fra om du vil fortsette");
  }

  return {
    summary: `Sjekket nettside for ${scans.length} firma${formatCompanyExamples(withoutSiteNames)}${limitParts.length > 0 ? `. ${limitParts.join(". ")}` : ""}`,
    data: {
      scanned: scans.length,
      withoutWebsite: withoutSite,
      bookingOnly,
      capped,
      timedOut,
      remainingOrgnrs: pendingOrgnrs,
      scans: scans.map(mapScanForAgent),
    },
  };
}

async function executeEnrichContacts(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnrs = capOrgnrs(
    Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : []
  );
  if (orgnrs.length === 0) {
    return { summary: "Ingen firma å berike", data: { enriched: 0 } };
  }

  const entitlements = await getEntitlements(ctx.userId);
  if (!entitlements.hasAccess) {
    return {
      summary: "Aktivt abonnement kreves for kontaktberikelse",
      data: { error: "no_access" },
    };
  }

  let companies = await loadCompaniesByOrgnr(orgnrs);
  const { companies: allowed, usage } = await applyCompanyContactLimit(
    ctx.userId,
    companies,
    entitlements.maxCompaniesWithContactPerMonth,
    undefined,
    { preserveOrder: true }
  );
  companies = allowed;

  const scans = await loadCachedWebsiteScans(companies.map((c) => c.orgnr));
  const scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const supabase = createServiceClient();
  let phonesAdded = 0;
  let emailsAdded = 0;
  let processed = 0;

  for (const company of companies) {
    const hadPhone = Boolean((company.phone ?? "").trim() || (company.mobile ?? "").trim());
    const hadEmail = Boolean((company.email ?? "").trim());
    const patch: Partial<Company> = {};

    const enhet = await fetchEnhet(company.orgnr).catch(() => null);
    if (enhet) {
      const mapped = mapBrregEnhet(enhet);
      if (!hadPhone) {
        if ((mapped.mobile ?? "").trim()) patch.mobile = mapped.mobile;
        else if ((mapped.phone ?? "").trim()) patch.phone = mapped.phone;
      }
      if (!hadEmail && (mapped.email ?? "").trim()) {
        patch.email = mapped.email;
        patch.has_email = mapped.has_email;
      }
    }

    const scan = scanByOrgnr.get(company.orgnr);
    if (!hadPhone && !(patch.phone || patch.mobile) && scan?.enrichedPhone) {
      Object.assign(patch, storePhone(scan.enrichedPhone));
    }
    if (!hadEmail && !patch.email && scan?.enrichedEmail) {
      patch.email = scan.enrichedEmail;
      patch.has_email = true;
    }

    const stillNeedPhone =
      !hadPhone && !(patch.phone || patch.mobile);
    const stillNeedEmail = !hadEmail && !patch.email;
    if (stillNeedPhone || stillNeedEmail) {
      const hit = await lookupFreeContact({
        orgnr: company.orgnr,
        name: company.name,
        email: company.email,
        website: company.website,
        municipality_name: company.municipality_name,
        city: company.city,
        industry_code: company.industry_code,
      }).catch(() => null);

      if (hit) {
        if (stillNeedPhone && hit.phone) {
          Object.assign(patch, storePhone(hit.phone));
        }
        if (stillNeedEmail && hit.email) {
          patch.email = hit.email;
          patch.has_email = true;
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("companies").update(patch).eq("orgnr", company.orgnr);
      if (patch.phone || patch.mobile) phonesAdded++;
      if (patch.email) emailsAdded++;
    }

    processed++;
    await updateRunProgress(ctx.runId, {
      phase: "enrich_contacts",
      processed,
      total: companies.length,
    });
    await sleep(100);
  }

  return {
    summary: `Beriket ${processed} firma — ${phonesAdded} nye telefoner, ${emailsAdded} nye e-poster`,
    data: {
      processed,
      phonesAdded,
      emailsAdded,
      contactQuotaRemaining: usage.remaining,
      limitReached: usage.limitReached,
    },
  };
}

async function executeFilterNoWebsite(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnrs = capOrgnrs(
    Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : []
  );
  if (orgnrs.length === 0) {
    return { summary: "Ingen firma å filtrere", data: { orgnrs: [] } };
  }

  const scans = await loadCachedWebsiteScans(orgnrs);
  const scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const notScanned = orgnrs.filter((o) => !scanByOrgnr.has(o));
  const without = orgnrs.filter((o) =>
    isLeadWithoutOwnSite(scanByOrgnr.get(o))
  );
  const bookingOnly = without.filter((o) => {
    const scan = scanByOrgnr.get(o);
    return scan ? isBookingOnlyScan(scan) : false;
  }).length;
  const facebookOnly = without.filter((o) => {
    const scan = scanByOrgnr.get(o);
    return scan && isLeadWithoutOwnSite(scan) && Boolean(scan.facebookUrl);
  }).length;
  const noWebsiteNoSocial = without.length - facebookOnly;

  const [confirmedCompanies, pendingCompanies] = await Promise.all([
    loadCompaniesByOrgnr(without),
    loadCompaniesByOrgnr(notScanned),
  ]);

  const summaryParts = [
    `Fant ${without.length} firma${formatCompanyExamples(confirmedCompanies.map((c) => c.name), 4)}`,
  ];
  if (notScanned.length > 0) {
    summaryParts.push(
      `${notScanned.length} gjenstår — si fra om du vil at jeg sjekker nettside for dem`
    );
  }

  return {
    summary: summaryParts.join(". "),
    data: {
      orgnrs: without,
      count: without.length,
      breakdown: {
        bookingOnly,
        facebookOnly,
        noWebsiteNoSocial,
      },
      notScanned,
      excludedNotScanned: notScanned.length,
      companies: confirmedCompanies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
      })),
      pendingScan: pendingCompanies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
        needsScan: true,
      })),
    },
  };
}

async function executeSaveList(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const orgnrs = capOrgnrs(
    Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : []
  );
  if (!name) {
    return { summary: "Listen trenger et navn", data: { error: "missing_name" } };
  }

  const filters = {
    municipalityCode:
      typeof args.municipalityCode === "string" ? args.municipalityCode : "",
    regionId: typeof args.regionId === "string" ? args.regionId : "",
    industryGroup:
      typeof args.industryGroup === "string" ? args.industryGroup : "",
    professionId:
      typeof args.professionId === "string" ? args.professionId : "",
    days: AGENT_LIST_PERIOD_DAYS,
    websitePresence: "without",
    modus: "websites",
    agentOrgnrs: orgnrs,
    createdBy: "agent",
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .insert({ user_id: ctx.userId, name, filters })
    .select("id")
    .single();

  if (error) {
    return { summary: `Kunne ikke lagre liste: ${error.message}`, data: { error: error.message } };
  }

  const url = buildAgentScanUrl({
    municipalityCode: filters.municipalityCode || undefined,
    regionId: filters.regionId || undefined,
    industryGroup: filters.industryGroup || undefined,
    professionId: filters.professionId || undefined,
    days: filters.days,
    orgnrs,
    savedListId: data.id,
  });

  return {
    summary: `Lagret liste «${name}» med ${orgnrs.length} firma — finnes under Lagrede målgrupper`,
    data: {
      savedListId: data.id,
      listName: name,
      url,
      orgnrCount: orgnrs.length,
      filters,
    },
  };
}

/** Eksportert for tester */
export { hasContactInfo };
