"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CompanyFilters,
  type FilterState,
} from "@/components/CompanyFilters";
import { CompanyTable } from "@/components/CompanyTable";
import { SendCampaignForm } from "@/components/SendCampaignForm";
import { WebsiteScanStatus } from "@/components/WebsiteScanStatus";
import { useAutoWebsiteScan } from "@/hooks/useAutoWebsiteScan";
import {
  loadScanSocialOptions,
  saveScanSocialOptions,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import { regionLabel } from "@/lib/constants/regions";
import { industryGroupLabel } from "@/lib/constants/industries";
import { professionSearchLabel } from "@/lib/constants/professions";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { useDemo } from "@/lib/demo/store";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { Building2, Download, Globe, Globe2, List, Mail, Radar, Search } from "lucide-react";

type SequenceOption = {
  id: string;
  name: string;
  steps: unknown[];
};

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  truncated?: boolean;
};

type Props = {
  companies: CompanyWithLead[];
  total: number;
  withEmail: number;
  municipalities: Array<{ code: string; name: string; count: number }>;
  initialFilters: FilterState;
  templates: EmailTemplate[];
  sequences: SequenceOption[];
  dataSource?: "demo" | "brreg";
  /** db = Supabase etter bulk-import, brreg = live API */
  companiesSource?: "db" | "brreg";
  brregTotal?: number | null;
  dbCompanyCount?: number | null;
  allTime?: boolean;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
};

export function AppPageClient(props: Props) {
  const demo = useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveListName, setSaveListName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [localCompanies, setLocalCompanies] = useState(props.companies);
  const [listFilter, setListFilter] = useState<
    "all" | "no_website" | "with_website" | "not_scanned"
  >("all");
  const [socialOptions, setSocialOptions] = useState<ScanSocialOptions>(() =>
    loadScanSocialOptions()
  );

  useEffect(() => {
    saveScanSocialOptions(socialOptions);
  }, [socialOptions]);

  const filters = props.initialFilters;
  const companies =
    props.dataSource === "brreg" ? localCompanies : props.companies;

  const {
    websiteScans,
    scanning,
    scanComplete,
    progress,
    error: scanError,
    providers,
    truncated,
    rescan,
    scanCompanies,
    scanningOrgnrs,
    scanPending,
    scanTargetCount,
    scanningName,
  } = useAutoWebsiteScan(companies, { autoScan: false, socialOptions });

  const [scanSelectionMessage, setScanSelectionMessage] = useState<string | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const isLeadWithoutOwnSite = (orgnr: string) => {
    const scan = websiteScans.get(orgnr);
    if (!scan) return false;
    if (scan.websiteKind === "none") return true;
    if (scan.websiteKind === "booking_only") {
      return scan.confidence === "high" || scan.confidence === "medium";
    }
    return false;
  };

  const noWebsiteOrgnrs = useMemo(() => {
    return companies.filter((c) => isLeadWithoutOwnSite(c.orgnr)).map((c) => c.orgnr);
  }, [companies, websiteScans]);

  const noWebsiteCount = noWebsiteOrgnrs.length;
  const withWebsiteCount = useMemo(
    () =>
      companies.filter((c) => websiteScans.get(c.orgnr)?.hasWebsite === true).length,
    [companies, websiteScans]
  );

  const withFacebookCount = useMemo(
    () =>
      companies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.facebookUrl)).length,
    [companies, websiteScans]
  );

  const withInstagramCount = useMemo(
    () =>
      companies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.instagramUrl)).length,
    [companies, websiteScans]
  );

  const notScannedCount = useMemo(
    () =>
      companies.filter((c) => c.has_email && !websiteScans.has(c.orgnr)).length,
    [companies, websiteScans]
  );

  const withEmailCount = useMemo(
    () => companies.filter((c) => c.has_email).length,
    [companies]
  );

  const companyListKey = useMemo(
    () => props.companies.map((c) => c.orgnr).join(","),
    [props.companies]
  );

  useEffect(() => {
    setLocalCompanies(props.companies);
  }, [props.companies, companyListKey]);

  useEffect(() => {
    setSelected(new Set());
    setListFilter("all");
  }, [companyListKey]);

  const matchesPresenceFilters = (c: CompanyWithLead) => {
    const scan = websiteScans.get(c.orgnr);
    const web = filters.websitePresence;
    if (web === "with" && scan?.hasWebsite !== true) return false;
    if (web === "without" && !isLeadWithoutOwnSite(c.orgnr)) return false;
    if (web === "not_scanned" && (scan || !c.has_email)) return false;

    const fb = filters.facebookPresence;
    if (fb === "with" && !scan?.facebookUrl) return false;
    if (
      fb === "without" &&
      (!scan?.socialScan?.includeFacebook || Boolean(scan.facebookUrl))
    ) {
      return false;
    }

    const ig = filters.instagramPresence;
    if (ig === "with" && !scan?.instagramUrl) return false;
    if (
      ig === "without" &&
      (!scan?.socialScan?.includeInstagram || Boolean(scan.instagramUrl))
    ) {
      return false;
    }

    return true;
  };

  const displayCompanies = useMemo(() => {
    let list = companies;
    if (listFilter === "no_website") {
      list = list.filter((c) => isLeadWithoutOwnSite(c.orgnr));
    } else if (listFilter === "with_website") {
      list = list.filter((c) => websiteScans.get(c.orgnr)?.hasWebsite === true);
    } else if (listFilter === "not_scanned") {
      list = list.filter((c) => c.has_email && !websiteScans.has(c.orgnr));
    }
    return list.filter(matchesPresenceFilters);
  }, [companies, listFilter, websiteScans, filters.websitePresence, filters.facebookPresence, filters.instagramPresence]);

  function applyFilters(next: FilterState) {
    if (
      next.industryGroup &&
      next.industryGroup !== filters.industryGroup &&
      next.days !== 0
    ) {
      next = { ...next, days: 0 };
    }
    if (
      next.professionSearch.trim() &&
      next.professionSearch.trim() !== filters.professionSearch.trim() &&
      next.days !== 0
    ) {
      next = { ...next, days: 0 };
    }

    const params = new URLSearchParams(searchParams.toString());
    if (next.regionId) params.set("omrade", next.regionId);
    else params.delete("omrade");
    if (next.municipalityCode) params.set("kommune", next.municipalityCode);
    else params.delete("kommune");
    params.set("dager", String(next.days));
    params.set("epost", next.hasEmail ? "1" : "0");
    params.set("generisk", next.genericEmailOnly ? "1" : "0");
    if (next.industryGroup) params.set("bransje", next.industryGroup);
    else params.delete("bransje");
    if (next.professionSearch.trim()) params.set("yrke", next.professionSearch.trim());
    else params.delete("yrke");
    if (next.websitePresence !== "all") params.set("web", next.websitePresence);
    else params.delete("web");
    if (next.facebookPresence !== "all") params.set("fb", next.facebookPresence);
    else params.delete("fb");
    if (next.instagramPresence !== "all") params.set("ig", next.instagramPresence);
    else params.delete("ig");
    params.delete("page");
    setSelected(new Set());
    setListFilter("all");
    router.push(`/app?${params.toString()}`);
  }

  const selectable = useMemo(() => displayCompanies, [displayCompanies]);

  const allSelected =
    selectable.length > 0 && selectable.every((c) => selected.has(c.orgnr));

  function toggle(orgnr: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgnr)) next.delete(orgnr);
      else next.add(orgnr);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectable.map((c) => c.orgnr)));
  }

  function selectNoWebsite() {
    setSelected(new Set(noWebsiteOrgnrs));
  }

  function selectAllWithEmail() {
    setSelected(new Set(companies.filter((c) => c.has_email).map((c) => c.orgnr)));
  }

  async function updateStatus(orgnr: string, status: string) {
    if (props.dataSource === "brreg") {
      setLocalCompanies((prev) =>
        prev.map((c) =>
          c.orgnr === orgnr && c.user_lead
            ? {
                ...c,
                user_lead: { ...c.user_lead, status: status as LeadStatus },
              }
            : c
        )
      );
      return;
    }
    demo.updateLeadStatus(orgnr, status as LeadStatus);
  }

  async function exportSelectedCsv() {
    if (selected.size === 0) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgnrs: Array.from(selected),
          triggerWebhook: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eksport feilet");
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nylead-eksport-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      let msg = `Eksportert ${data.count} firma.`;
      if (data.webhookOk) msg += " Webhook sendt.";
      else if (data.webhookError) msg += ` Webhook: ${data.webhookError}`;
      setExportMessage(msg);
    } catch (err) {
      setExportMessage(err instanceof Error ? err.message : "Eksport feilet");
    } finally {
      setExporting(false);
    }
  }

  async function saveList() {
    if (!saveListName.trim()) return;
    demo.saveListDemo(saveListName, {
      regionId: filters.regionId,
      municipalityCode: filters.municipalityCode,
      days: filters.days,
      hasEmail: filters.hasEmail,
      genericEmailOnly: filters.genericEmailOnly,
      industryGroup: filters.industryGroup,
    });
    setSaveMessage("Liste lagret!");
    setSaveListName("");
  }

  const selectedCompanies = companies.filter((c) => selected.has(c.orgnr));

  function scanSelectedWithGoogle() {
    setScanSelectionMessage(null);
    const result = scanCompanies(selectedCompanies, { preserveOrder: true });
    if (!result.ok) {
      setScanSelectionMessage(result.message);
      return;
    }
    if ("cachedOnly" in result && result.cachedOnly) {
      setScanSelectionMessage("Alle valgte er allerede sjekket — ingen nytt Google-søk.");
      return;
    }
    const parts: string[] = [];
    if (result.cachedCount && result.cachedCount > 0) {
      parts.push(`${result.cachedCount} allerede lagret`);
    }
    if (result.scanned > 0) {
      parts.push(`sjekker ${result.scanned} nå`);
    }
    if (result.skipped > 0) {
      parts.push("maks 10 per gang — kjør igjen for resten");
    }
    if (parts.length > 0) {
      const msg = parts.join(" · ");
      setScanSelectionMessage(msg.charAt(0).toUpperCase() + msg.slice(1));
    }
  }

  const listTabs = [
    { id: "all" as const, label: "Alle", shortLabel: "Alle", count: companies.length, icon: List },
    {
      id: "no_website" as const,
      label: "Uten nettside",
      shortLabel: "Uten web",
      count: noWebsiteCount,
      icon: Globe,
    },
    {
      id: "with_website" as const,
      label: "Med nettside",
      shortLabel: "Med web",
      count: withWebsiteCount,
      icon: Globe2,
    },
    {
      id: "not_scanned" as const,
      label: "Ikke sjekket",
      shortLabel: "Ujekket",
      count: notScannedCount,
      icon: Radar,
    },
  ];

  const filterSummary = [
    filters.municipalityCode
      ? null
      : filters.regionId
        ? regionLabel(filters.regionId)
        : "Hele Norge",
    filters.industryGroup ? industryGroupLabel(filters.industryGroup) : null,
    filters.professionSearch.trim()
      ? professionSearchLabel(filters.professionSearch.trim()) ??
        `Yrke: ${filters.professionSearch.trim()}`
      : null,
    filters.days === 0 ? "Alle firma" : `Siste ${filters.days} dager`,
  ]
    .filter(Boolean)
    .join(" · ");

  const pagination = props.pagination;
  const pageStart =
    pagination && companies.length > 0
      ? (pagination.page - 1) * pagination.pageSize + 1
      : 0;
  const pageEnd =
    pagination && companies.length > 0
      ? pageStart + companies.length - 1
      : 0;
  const showExactTotal = pagination && !pagination.truncated;

  return (
    <div className="w-full max-w-none space-y-2 pb-6 lg:space-y-2.5">
      <section className="scan-surface-full overflow-hidden">
        <header className="p-2.5 lg:p-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900">Skann markedet</h1>
              <p className="text-xs text-slate-500">
                Velg firma → sjekk (maks 10) → send e-post
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="scan-chip">
                <Building2 className="h-3 w-3 text-brand-gold" />
                {pagination
                  ? showExactTotal
                    ? `${pagination.total} firma`
                    : `${companies.length} på siden`
                  : `${companies.length} firma`}
              </span>
              <span className="scan-chip">
                <Mail className="h-3 w-3 text-brand-gold" />
                {withEmailCount} med e-post
              </span>
            </div>
          </div>
          <details className="mt-1 text-xs text-slate-500">
            <summary className="cursor-pointer select-none hover:text-slate-700">
              Tilfeldig rekkefølge denne måneden
            </summary>
            <p className="mt-0.5 leading-snug">
              Ikke alle brukere treffer de samme firmaene først — det gjør det mer rettferdig.
            </p>
          </details>
        </header>

        <div className="border-t border-slate-200 p-2.5 lg:p-3">
          <CompanyFilters
            filters={filters}
            municipalities={props.municipalities}
            onChange={applyFilters}
          />
          {filterSummary && (
            <p className="mt-1 text-xs text-slate-500">{filterSummary}</p>
          )}

          <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Google-sjekk
              </span>
              <label className="scan-chip cursor-pointer">
                <input
                  type="checkbox"
                  checked={socialOptions.includeFacebook}
                  onChange={(e) =>
                    setSocialOptions((prev) => ({
                      ...prev,
                      includeFacebook: e.target.checked,
                    }))
                  }
                  className="h-3 w-3 rounded accent-sky-600"
                />
                Facebook
              </label>
              <label className="scan-chip cursor-pointer">
                <input
                  type="checkbox"
                  checked={socialOptions.includeInstagram}
                  onChange={(e) =>
                    setSocialOptions((prev) => ({
                      ...prev,
                      includeInstagram: e.target.checked,
                    }))
                  }
                  className="h-3 w-3 rounded accent-sky-600"
                />
                Instagram
              </label>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selected.size > 0 && (
                <span className="text-xs font-semibold text-brand-navy">
                  {selected.size} valgt
                </span>
              )}
              <button
                type="button"
                onClick={scanSelectedWithGoogle}
                disabled={scanning || selected.size === 0}
                className={cn(
                  "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition",
                  selected.size > 0 && !scanning
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                )}
              >
                <Search className="h-3.5 w-3.5" />
                {scanning
                  ? "Søker…"
                  : selected.size > 0
                    ? `Start sjekk (${Math.min(selected.size, 10)})`
                    : "Velg firma først"}
              </button>
            </div>
          </div>
          {scanSelectionMessage && (
            <p className="mt-1.5 text-xs font-medium text-amber-900">{scanSelectionMessage}</p>
          )}
        </div>

        {props.dataSource === "brreg" &&
          ((props.companiesSource === "db" &&
            props.dbCompanyCount != null &&
            props.dbCompanyCount > props.total + 2 &&
            filters.days !== 0) ||
            (props.brregTotal != null &&
              props.brregTotal > props.total + 2 &&
              props.companiesSource !== "db")) && (
            <div className="flex gap-2 border-t border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 lg:px-3">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p>
                {props.companiesSource === "db" ? (
                  <>
                    Du ser <strong>{props.total}</strong> firma med valgte filter
                    {filters.industryGroup
                      ? ` (${industryGroupLabel(filters.industryGroup).toLowerCase()})`
                      : ""}
                    . Registeret har{" "}
                    <strong>{props.dbCompanyCount!.toLocaleString("nb-NO")}</strong> firma totalt.
                    For mange flere: velg <strong>Alle firma</strong> under periode (ikke bare
                    siste 30 dager).
                  </>
                ) : (
                  <>
                    Du ser <strong>{props.total}</strong> av <strong>{props.brregTotal}</strong> i
                    Brønnøysund
                    {filters.industryGroup
                      ? ` (${industryGroupLabel(filters.industryGroup).toLowerCase()})`
                      : ""}
                    . For flere treff: velg <strong>Alle firma</strong> under periode, og slå av{" "}
                    <strong>Kun post@ / info@</strong> hvis den er på.
                  </>
                )}
              </p>
            </div>
          )}

        <WebsiteScanStatus
          embedded
          scanning={scanning}
          scanComplete={scanComplete}
          scanPending={scanPending}
          scanTargetCount={scanTargetCount}
          scanningName={scanningName}
          progress={progress}
          error={scanError}
          providers={providers}
          truncated={truncated}
          noWebsiteCount={noWebsiteCount}
          withWebsiteCount={withWebsiteCount}
          withFacebookCount={withFacebookCount}
          withInstagramCount={withInstagramCount}
          includeFacebook={socialOptions.includeFacebook}
          includeInstagram={socialOptions.includeInstagram}
          listFilter={listFilter}
          notScannedCount={notScannedCount}
          onRescan={rescan}
          scanResults={websiteScans}
        />

        <div className="border-t border-slate-200 px-2.5 py-2 lg:px-3">
          <div className="-mx-0.5 flex flex-wrap gap-1 px-0.5">
            {listTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListFilter(tab.id)}
                  className={cn(
                    "scan-tab",
                    listFilter === tab.id && "scan-tab-active"
                  )}
                >
                  <TabIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="tabular-nums font-semibold">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs text-slate-600">
            {pagination ? (
              <>
                Viser{" "}
                <strong className="text-slate-900">
                  {pageStart > 0 ? `${pageStart}–${pageEnd}` : "0"}
                </strong>{" "}
                {showExactTotal ? (
                  <>
                    av <strong className="text-slate-900">{pagination.total}</strong>
                  </>
                ) : props.brregTotal != null ? (
                  <>
                    (ca.{" "}
                    <strong className="text-slate-900">
                      {props.brregTotal.toLocaleString("nb-NO")}
                    </strong>{" "}
                    i Brønnøysund)
                  </>
                ) : (
                  <>
                    av minst{" "}
                    <strong className="text-slate-900">{pagination.total}</strong>
                  </>
                )}
                {listFilter !== "all" && (
                  <>
                    {" "}
                    · <strong className="text-slate-900">{displayCompanies.length}</strong> i
                    valgt fane
                  </>
                )}
              </>
            ) : (
              <>
                Viser <strong className="text-slate-900">{displayCompanies.length}</strong> av{" "}
                {companies.length}
              </>
            )}
            </p>

            {pagination && props.onPageChange && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-slate-600">
                  Side <strong className="text-slate-900">{pagination.page}</strong>
                  {showExactTotal ? (
                    <>
                      {" "}
                      / <strong className="text-slate-900">{pagination.totalPages}</strong>
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => props.onPageChange?.(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="scan-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Forrige
                </button>
                <button
                  type="button"
                  onClick={() => props.onPageChange?.(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="scan-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Neste
                </button>
              </div>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            {selected.size > 0 && (
              <button
                type="button"
                onClick={exportSelectedCsv}
                disabled={exporting}
                className="scan-btn-ghost inline-flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Eksporterer…" : `CSV (${selected.size})`}
              </button>
            )}
            {exportMessage && (
              <p className="w-full text-xs text-emerald-700">{exportMessage}</p>
            )}
            <button
              type="button"
              onClick={toggleAll}
              className="scan-btn-ghost"
            >
              {allSelected ? "Fjern valg" : "Velg synlige"}
            </button>
            {withEmailCount > 0 && (
              <button
                type="button"
                onClick={selectAllWithEmail}
                className="scan-btn-ghost"
              >
                Velg med e-post
              </button>
            )}
            {scanComplete && noWebsiteCount > 0 && (
              <button
                type="button"
                onClick={selectNoWebsite}
                className="scan-btn-ghost"
              >
                Uten nettside ({noWebsiteCount})
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 p-2">
          <CompanyTable
            companies={displayCompanies}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            allSelected={allSelected}
            onStatusChange={updateStatus}
            liveBrreg={props.dataSource === "brreg"}
            websiteScans={websiteScans}
            scanningOrgnrs={scanning ? scanningOrgnrs : undefined}
          />

          {pagination && props.onPageChange && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <p className="text-xs text-slate-600">
                Side <strong className="text-slate-900">{pagination.page}</strong>
                {showExactTotal ? (
                  <>
                    {" "}
                    / <strong className="text-slate-900">{pagination.totalPages}</strong>
                  </>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => props.onPageChange?.(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="scan-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Forrige
                </button>
                <button
                  type="button"
                  onClick={() => props.onPageChange?.(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="scan-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Neste
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-4 z-20 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg sm:inset-x-auto sm:right-6 sm:max-w-md">
          <span className="text-xs font-semibold text-slate-900">
            {selected.size} valgt
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={scanSelectedWithGoogle}
              disabled={scanning}
              className="scan-btn-primary min-h-[36px] px-3 disabled:opacity-50"
            >
              Google-sjekk
            </button>
          )}
        </div>
      )}

      <div className="scan-surface-pad w-full max-w-none">
        <SendCampaignForm
          selectedCompanies={selectedCompanies}
          templates={props.templates}
          sequences={props.sequences}
          websiteScans={websiteScans}
          onSent={() => setSelected(new Set())}
          light
        />
      </div>

      <details className="scan-surface-pad w-full max-w-none text-sm text-slate-600 lg:hidden">
        <summary className="cursor-pointer font-medium text-slate-800">
          Lagre søk (valgfritt)
        </summary>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={saveListName}
            onChange={(e) => setSaveListName(e.target.value)}
            placeholder="Navn på liste"
            className="scan-input flex-1"
          />
          <button type="button" onClick={saveList} className="scan-btn-primary px-4 py-2.5">
            Lagre
          </button>
        </div>
        {saveMessage && <p className="mt-2 text-emerald-600">{saveMessage}</p>}
      </details>
    </div>
  );
}
