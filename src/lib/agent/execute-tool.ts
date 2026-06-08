import { getEntitlements } from "@/lib/billing/entitlements";
import {
  applyCompanyContactLimit,
  hasContactInfo,
} from "@/lib/billing/usage";
import { AGENT_MAX_COMPANIES_PER_JOB, AGENT_SCAN_DELAY_MS } from "@/lib/agent/constants";
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
import { fetchCompaniesFromDb } from "@/lib/brreg/fetch-companies-db";
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
  progress: Record<string, unknown>
) {
  const supabase = createServiceClient();
  await supabase
    .from("agent_runs")
    .update({ progress })
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
    case "search_companies":
      return executeSearchCompanies(args);
    case "scan_websites":
      return executeScanWebsites(ctx, args);
    case "enrich_contacts":
      return executeEnrichContacts(ctx, args);
    case "filter_no_website":
      return executeFilterNoWebsite(args);
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
  const entitlements = await getEntitlements(ctx.userId);
  return {
    summary: `${entitlements.companiesWithContactRemaining} kontakter igjen denne måneden`,
    data: {
      hasAccess: entitlements.hasAccess,
      companiesWithContactUsed: entitlements.companiesWithContactUsed,
      companiesWithContactRemaining: entitlements.companiesWithContactRemaining,
      maxCompaniesWithContactPerMonth:
        entitlements.maxCompaniesWithContactPerMonth,
    },
  };
}

async function executeSearchCompanies(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const municipalityCode =
    typeof args.municipalityCode === "string" ? args.municipalityCode : undefined;
  const regionId = typeof args.regionId === "string" ? args.regionId : undefined;
  const industryGroup =
    typeof args.industryGroup === "string" ? args.industryGroup : undefined;
  const professionId =
    typeof args.professionId === "string" ? args.professionId : undefined;
  const days =
    typeof args.days === "number" && Number.isFinite(args.days) ? args.days : 30;

  const result = await fetchCompaniesFromDb({
    municipalityCode,
    regionId,
    industryGroup,
    professionId,
    days,
    hasEmail: false,
    page: 1,
    pageSize: AGENT_MAX_COMPANIES_PER_JOB,
  });

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

  return {
    summary: `Fant ${companies.length} firma${truncated ? ` (av ${result.total} totalt — begrenset til ${AGENT_MAX_COMPANIES_PER_JOB})` : ""}`,
    data: {
      companies: companies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
        website: c.website,
        municipality_name: c.municipality_name,
      })),
      total: result.total,
      returned: companies.length,
      truncated,
      orgnrs: companies.map((c) => c.orgnr),
      filters: { municipalityCode, regionId, industryGroup, professionId, days },
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
      if (scan && isWebsiteScanCacheComplete(scan, social)) {
        // bruk cache
      } else if (scan && isSocialScanComplete(scan, social)) {
        scan = await enrichScanContacts(input, scan);
        await persistCachedWebsiteScans([scan], ctx.userId);
      } else {
        scan = await scanCompanyWebsite(input, { social });
        scan = await enrichScanContacts(input, scan);
        await persistCachedWebsiteScans([scan], ctx.userId);
      }
      scans.push(scan);
      scanned++;
      await updateRunProgress(ctx.runId, {
        phase: "scan_websites",
        scanned,
        total: companies.length,
      });
    }

    if (i + MAX_WEBSITE_SCAN_BATCH < companies.length) {
      await sleep(AGENT_SCAN_DELAY_MS);
    }
  }

  const withoutSite = scans.filter((s) => isLeadWithoutOwnSite(s)).length;
  const bookingOnly = scans.filter((s) => isBookingOnlyScan(s)).length;

  return {
    summary: `Skannet ${scans.length} firma — ${withoutSite} uten egen nettside (${bookingOnly} kun booking)`,
    data: {
      scanned: scans.length,
      withoutWebsite: withoutSite,
      bookingOnly,
      scans: scans.map((s) => ({
        orgnr: s.orgnr,
        hasWebsite: s.hasWebsite,
        websiteKind: s.websiteKind,
        websiteUrl: s.websiteUrl,
        bookingPlatform: s.bookingPlatform,
        countsAsNoWebsite: isLeadWithoutOwnSite(s),
        confidence: s.confidence,
        facebookUrl: s.facebookUrl ?? null,
        linkedinUrl: s.linkedinUrl ?? null,
        instagramUrl: s.instagramUrl ?? null,
      })),
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

  const companies = await loadCompaniesByOrgnr(without);

  return {
    summary:
      notScanned.length > 0
        ? `${without.length} uten nettside (${notScanned.length} mangler skann — kjør scan_websites først)`
        : `${without.length} firma uten egen nettside`,
    data: {
      orgnrs: without,
      count: without.length,
      notScanned,
      companies: companies.map((c) => ({
        orgnr: c.orgnr,
        name: c.name,
        phone: c.phone ?? c.mobile,
        email: c.email,
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
    days: typeof args.days === "number" ? args.days : 30,
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
