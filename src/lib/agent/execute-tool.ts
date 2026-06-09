import { getEntitlements } from "@/lib/billing/entitlements";
import {
  getSerperUsage,
  SerperLimitReachedError,
} from "@/lib/billing/serper-usage";
import {
  applyCompanyContactLimit,
  hasContactInfo,
} from "@/lib/billing/usage";
import { AGENT_MAX_COMPANIES_PER_JOB, AGENT_SCAN_DELAY_MS } from "@/lib/agent/constants";
import { AGENT_LIST_PERIOD_DAYS } from "@/lib/agent/saved-list-filters";
import { resolveAgentSearchIndustryFilters } from "@/lib/agent/search-filters";
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
import { mapBrregEnhet } from "@/lib/brreg/map-company";
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
};

export type ToolExecutionResult = {
  summary: string;
  data: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniqueOrgnrs(orgnrs: string[]): string[] {
  return Array.from(new Set(orgnrs.map((o) => o.trim()).filter(Boolean)));
}

function capOrgnrs(orgnrs: string[]): string[] {
  return uniqueOrgnrs(orgnrs).slice(0, AGENT_MAX_COMPANIES_PER_JOB);
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

  const scans = await loadCachedWebsiteScans(orgnrs);
  const scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const matched = orgnrs.filter((orgnr) => {
    const scan = scanByOrgnr.get(orgnr);
    if (!scan) return false;
    if (facebookOnly && !scan.facebookUrl) return false;
    if (hasPhone && !scan.enrichedPhone) return false;
    if (minConfidence === "high" && scan.confidence !== "high") return false;
    if (minConfidence === "medium" && scan.confidence === "low") return false;
    return true;
  });

  const companies = await loadCompaniesByOrgnr(matched);

  return {
    summary: `Filtrerte til ${matched.length} av ${orgnrs.length} firma`,
    data: {
      orgnrs: matched,
      count: matched.length,
      filters: { facebookOnly, hasPhone, minConfidence },
      companies: companies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
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

  const searchArgs = {
    municipalityCode,
    regionId,
    industryGroup,
    professionId,
    nameQuery,
    days,
    hasEmail: false,
    page: 1,
    pageSize: AGENT_MAX_COMPANIES_PER_JOB,
  };

  const useDb = await shouldUseBrregDb();
  const result = useDb
    ? await fetchCompaniesFromDb(searchArgs)
    : await fetchCompaniesFromBrreg(searchArgs);

  const orgnrs = result.companies.map((c) => c.orgnr);
  const [overrideMap, dbPatchMap] = await Promise.all([
    loadContactOverrides(orgnrs),
    loadDbContactPatches(orgnrs),
  ]);

  const companies = result.companies.map((company) => {
    const brregMissingContact =
      !(company.mobile ?? "").trim() && !(company.phone ?? "").trim();
    const override =
      overrideMap.get(company.orgnr) ??
      (brregMissingContact ? dbPatchMap.get(company.orgnr) : undefined);
    return mergeContactOverride(company, override);
  });

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
  };

  await updateRunProgress(ctx.runId, {
    phase: "search_done",
    searchFilters,
    orgnrs,
    remainingOrgnrs: orgnrs,
    scanned: 0,
    total: orgnrs.length,
  });

  return {
    summary: `Fant ${companies.length} firma${truncated ? ` (av ${result.total} totalt — begrenset til ${AGENT_MAX_COMPANIES_PER_JOB})` : ""}${formatCompanyExamples(companies.map((c) => c.name))}`,
    data: {
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
      dataSource: useDb ? "database" : "live_brreg",
      orgnrs: companies.map((c) => c.orgnr),
      filters: searchFilters,
    },
  };
}

async function executeScanWebsites(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnrs = capOrgnrs(
    Array.isArray(args.orgnrs) ? (args.orgnrs as string[]) : []
  );
  if (orgnrs.length === 0) {
    return { summary: "Ingen firma å skanne", data: { scans: [] } };
  }

  const companies = await loadCompaniesByOrgnr(orgnrs);
  const scans: WebsiteScanResult[] = [];
  let scanned = 0;

  await updateRunProgress(ctx.runId, {
    phase: "scan_websites",
    orgnrs,
    scanned: 0,
    total: companies.length,
    remainingOrgnrs: orgnrs,
  });

  const social: ScanSocialOptions = {
    ...DEFAULT_SCAN_SOCIAL_OPTIONS,
    includeFacebook: true,
  };

  for (let i = 0; i < companies.length; i += MAX_WEBSITE_SCAN_BATCH) {
    const batch = companies.slice(i, i + MAX_WEBSITE_SCAN_BATCH);
    const cached = await loadCachedWebsiteScans(batch.map((c) => c.orgnr));
    const cachedByOrgnr = new Map(cached.map((s) => [s.orgnr, s]));

    for (const company of batch) {
      const input = toScanInput(company);
      let scan = cachedByOrgnr.get(company.orgnr);
      try {
        if (scan && isWebsiteScanCacheComplete(scan, social)) {
          // bruk cache
        } else if (scan && isSocialScanComplete(scan, social)) {
          scan = await enrichScanContacts(input, scan);
          await persistCachedWebsiteScans([scan], ctx.userId);
        } else {
          scan = await scanCompanyWebsite(input, { social, userId: ctx.userId });
          scan = await enrichScanContacts(input, scan);
          await persistCachedWebsiteScans([scan], ctx.userId);
        }
      } catch (err) {
        if (err instanceof SerperLimitReachedError) {
          const remainingOrgnrs = orgnrs.slice(scans.length);
          await updateRunProgress(ctx.runId, {
            phase: "scan_websites",
            orgnrs,
            scanned: scans.length,
            total: companies.length,
            remainingOrgnrs,
            serperLimitReached: true,
          });
          return {
            summary: err.message,
            data: {
              scanned: scans.length,
              serperLimitReached: true,
              serperUsage: err.usage,
              remainingOrgnrs,
              scans: scans.map((s) => ({
                orgnr: s.orgnr,
                hasWebsite: s.hasWebsite,
              })),
            },
          };
        }
        throw err;
      }
      scans.push(scan);
      scanned++;
      await updateRunProgress(ctx.runId, {
        phase: "scan_websites",
        orgnrs,
        scanned,
        total: companies.length,
        remainingOrgnrs: orgnrs.slice(scanned),
      });
    }

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

  await updateRunProgress(ctx.runId, {
    phase: "scan_done",
    orgnrs,
    scanned: scans.length,
    total: companies.length,
    remainingOrgnrs: [],
  });

  return {
    summary: `Skannet ${scans.length} firma — ${withoutSite} uten egen nettside (${bookingOnly} kun booking)${formatCompanyExamples(withoutSiteNames)}`,
    data: {
      scanned: scans.length,
      withoutWebsite: withoutSite,
      bookingOnly,
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

  let scans = await loadCachedWebsiteScans(orgnrs);
  let scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));
  const pendingBeforeScan = orgnrs.filter((o) => !scanByOrgnr.has(o));
  let autoScanned = 0;

  if (pendingBeforeScan.length > 0) {
    await executeScanWebsites(ctx, { orgnrs: pendingBeforeScan });
    autoScanned = pendingBeforeScan.length;
    scans = await loadCachedWebsiteScans(orgnrs);
    scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));
  }

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

  const summaryParts = [`${without.length} uten nettside${formatCompanyExamples(confirmedCompanies.map((c) => c.name), 4)}`];
  if (autoScanned > 0) {
    summaryParts.unshift(`Skannet ${autoScanned} firma automatisk før filtrering`);
  }
  if (notScanned.length > 0) {
    summaryParts.push(
      `${notScanned.length} utelatt fordi de ikke er skannet — kjør scan_websites på disse orgnr først`
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
      autoScanned,
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
