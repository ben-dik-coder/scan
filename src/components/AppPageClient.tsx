"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CompanyFilters,
  type FilterState,
} from "@/components/CompanyFilters";
import { CompanyTable } from "@/components/CompanyTable";
import { SendCampaignForm } from "@/components/SendCampaignForm";
import { WebsiteScanStatus } from "@/components/WebsiteScanStatus";
import {
  ScanActiveFilterChips,
  countActiveMarketFilters,
} from "@/components/scan/ScanActiveFilterChips";
import { ScanFilterSheet } from "@/components/scan/ScanFilterSheet";
import { ScanGooglePanel } from "@/components/scan/ScanGooglePanel";
import { ScanLeadModes } from "@/components/scan/ScanLeadModes";
import { ScanSavedAudiences } from "@/components/scan/ScanSavedAudiences";
import { TrialNudgeBanner } from "@/components/scan/TrialNudgeBanner";
import { ScanQuickBar } from "@/components/scan/ScanQuickBar";
import { ScanQueueHint } from "@/components/scan/ScanQueueHint";
import { useAutoWebsiteScan } from "@/hooks/useAutoWebsiteScan";
import {
  loadScanSocialOptions,
  saveScanSocialOptions,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import { industryGroupLabel } from "@/lib/constants/industries";
import { MAX_WEBSITE_SCAN_BATCH } from "@/lib/constants/market";
import { isDemoMode } from "@/lib/demo/config";
import {
  filtersForLeadMode,
  persistScanAudienceFilters,
  type ScanLeadMode,
} from "@/lib/scan/lead-modes";
import { buildLeadGoogleSearchQuery } from "@/lib/scan/google-search-query";
import { computeQueueScore } from "@/lib/sales/queue-score";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { useDemo } from "@/lib/demo/store";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  Building2,
  Download,
  Globe,
  Globe2,
  LayoutGrid,
  List,
  ListTodo,
  PhoneCall,
  Radar,
  Search,
  Table2,
} from "lucide-react";

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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [localCompanies, setLocalCompanies] = useState(props.companies);
  const [listFilter, setListFilter] = useState<
    "all" | "no_website" | "with_website" | "not_scanned"
  >("all");
  const [socialOptions, setSocialOptions] = useState<ScanSocialOptions>(() =>
    loadScanSocialOptions()
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [listViewMode, setListViewMode] = useState<"table" | "cards">("table");
  const [noWebsiteBanner, setNoWebsiteBanner] = useState(false);
  const [queueAfterScan, setQueueAfterScan] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const emailSectionRef = useRef<HTMLDetailsElement>(null);
  const queueActionRef = useRef<HTMLDivElement>(null);
  const wasScanningRef = useRef(false);

  const activeLeadMode = useMemo((): ScanLeadMode | null => {
    const m = searchParams.get("modus");
    if (m === "websites" || m === "profession" || m === "all_new") return m;
    return null;
  }, [searchParams]);

  useEffect(() => {
    saveScanSocialOptions(socialOptions);
  }, [socialOptions]);

  useEffect(() => {
    const web = searchParams.get("web");
    if (web === "without") setListFilter("no_website");
    else if (web === "with") setListFilter("with_website");
    else if (web === "not_scanned") setListFilter("not_scanned");
  }, [searchParams]);

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

  const withGulesiderCount = useMemo(
    () =>
      companies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.gulesiderListed)).length,
    [companies, websiteScans]
  );

  const withInstagramCount = useMemo(
    () =>
      companies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.instagramUrl)).length,
    [companies, websiteScans]
  );

  const withLinkedInCount = useMemo(
    () =>
      companies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.linkedinUrl)).length,
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

  const withContactCount = useMemo(
    () =>
      companies.filter((c) => {
        const scan = websiteScans.get(c.orgnr);
        return Boolean(
          c.has_email ||
            c.email ||
            c.phone ||
            c.mobile ||
            scan?.enrichedPhone ||
            scan?.facebookProfile?.email ||
            scan?.instagramProfile?.email
        );
      }).length,
    [companies, websiteScans]
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

  const activeFilterCount = countActiveMarketFilters(
    filters,
    props.municipalities
  );

  const scanQueueCount = Math.min(selected.size, MAX_WEBSITE_SCAN_BATCH);
  const scanQueueRemaining = Math.max(0, MAX_WEBSITE_SCAN_BATCH - scanQueueCount);

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

  const queueScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      map.set(
        c.orgnr,
        computeQueueScore(c, c.user_lead ?? null, websiteScans.get(c.orgnr) ?? null)
      );
    }
    return map;
  }, [companies, websiteScans]);

  const rankedDisplayCompanies = useMemo(() => {
    return [...displayCompanies].sort(
      (a, b) => (queueScores.get(b.orgnr) ?? 0) - (queueScores.get(a.orgnr) ?? 0)
    );
  }, [displayCompanies, queueScores]);

  function applyFilters(
    next: FilterState,
    options?: {
      preserveListFilter?: boolean;
      listFilter?: typeof listFilter;
    }
  ) {
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
    persistScanAudienceFilters(next);
    setSelected(new Set());
    if (options?.preserveListFilter && options.listFilter) {
      setListFilter(options.listFilter);
    } else if (!options?.preserveListFilter) {
      setListFilter("all");
    }
    router.push(`/app?${params.toString()}`);
  }

  function applyLeadMode(mode: ScanLeadMode) {
    const next = filtersForLeadMode(mode, filters);
    const params = new URLSearchParams(searchParams.toString());
    params.set("modus", mode);
    params.delete("page");
    persistScanAudienceFilters(next);
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
    params.delete("web");
    params.delete("fb");
    params.delete("ig");
    setListFilter("all");
    setSelected(new Set());
    router.push(`/app?${params.toString()}`);
  }

  const selectable = useMemo(() => rankedDisplayCompanies, [rankedDisplayCompanies]);

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

  function selectNoWebsiteWithEmail() {
    const orgnrs = companies
      .filter((c) => isLeadWithoutOwnSite(c.orgnr) && c.has_email)
      .map((c) => c.orgnr);
    setSelected(new Set(orgnrs));
  }

  function selectAllWithEmail() {
    setSelected(
      new Set(rankedDisplayCompanies.filter((c) => c.has_email).map((c) => c.orgnr))
    );
  }

  function noWebsiteOrgnrsInSelection(orgnrFilter?: Set<string>) {
    return companies
      .filter(
        (c) =>
          (!orgnrFilter || orgnrFilter.has(c.orgnr)) &&
          isLeadWithoutOwnSite(c.orgnr) &&
          c.has_email
      )
      .map((c) => c.orgnr);
  }

  async function addLeadsToQueue(orgnrs: string[]) {
    if (orgnrs.length === 0) return;
    setAddingToQueue(true);
    setScanSelectionMessage(null);
    try {
      let failed = 0;
      if (isDemoMode()) {
        for (const orgnr of orgnrs) {
          demo.setLeadStatus(orgnr, "ny", { queue: true });
        }
      } else {
        const results = await Promise.all(
          orgnrs.map(async (orgnr) => {
            const res = await fetch("/api/leads/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orgnr, status: "ny", queue: true }),
            });
            return res.ok;
          })
        );
        failed = results.filter((ok) => !ok).length;
      }
      const queued = orgnrs.length - failed;
      if (queued === 0) {
        setScanSelectionMessage("Kunne ikke legge firma i kø — prøv igjen.");
        return;
      }
      if (failed > 0) {
        setScanSelectionMessage(
          `${queued} lagt i kø. ${failed} feilet — prøv igjen for resten.`
        );
      }
      try {
        sessionStorage.setItem(
          "nylead-queue-toast",
          `${queued} lagt i kø — neste: kontakt første firma`
        );
      } catch {
        /* ignore */
      }
      router.push("/app/ko");
    } finally {
      setAddingToQueue(false);
    }
  }

  function addSelectedToQueue() {
    const orgnrs = Array.from(selected);
    if (orgnrs.length === 0) {
      setScanSelectionMessage("Velg minst ett firma først.");
      return;
    }
    void addLeadsToQueue(orgnrs);
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

  async function saveAudience(name: string) {
    const payload = {
      regionId: filters.regionId,
      municipalityCode: filters.municipalityCode,
      days: filters.days,
      hasEmail: filters.hasEmail,
      genericEmailOnly: filters.genericEmailOnly,
      industryGroup: filters.industryGroup,
      professionSearch: filters.professionSearch,
      websitePresence: filters.websitePresence,
      facebookPresence: filters.facebookPresence,
      instagramPresence: filters.instagramPresence,
    };
    if (isDemoMode()) {
      demo.saveListDemo(name, payload);
    } else {
      const res = await fetch("/api/saved-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Kunne ikke lagre");
      }
    }
    setSaveMessage("Målgruppe lagret!");
    persistScanAudienceFilters(filters);
  }

  const selectedCompanies = companies.filter((c) => selected.has(c.orgnr));

  const googleSearchQuery = useMemo(() => {
    if (selectedCompanies.length !== 1) return "";
    return buildLeadGoogleSearchQuery(selectedCompanies[0]);
  }, [selectedCompanies]);

  function scanSelectedWithGoogle() {
    setScanSelectionMessage(null);
    const result = scanCompanies(selectedCompanies, { preserveOrder: true });
    if (!result.ok) {
      setScanSelectionMessage(result.message);
      return result;
    }
    if ("cachedOnly" in result && result.cachedOnly) {
      setScanSelectionMessage("Alle valgte er allerede sjekket — ingen nytt Google-søk.");
      if (noWebsiteCount > 0) {
        setListFilter("no_website");
        setNoWebsiteBanner(true);
      }
      return result;
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
    return result;
  }

  function checkAndAddToQueue() {
    const ranked = [...companies]
      .filter((c) => c.has_email)
      .sort((a, b) => (queueScores.get(b.orgnr) ?? 0) - (queueScores.get(a.orgnr) ?? 0))
      .slice(0, MAX_WEBSITE_SCAN_BATCH);
    if (ranked.length === 0) {
      setScanSelectionMessage("Ingen firma med e-post å sjekke.");
      return;
    }
    const rankedOrgnrs = new Set(ranked.map((c) => c.orgnr));
    setSelected(rankedOrgnrs);
    setScanSelectionMessage(null);
    const result = scanSelectedWithGoogle();
    if (!result?.ok) return;

    if ("cachedOnly" in result && result.cachedOnly) {
      const orgnrs = noWebsiteOrgnrsInSelection(rankedOrgnrs);
      if (orgnrs.length > 0) {
        void addLeadsToQueue(orgnrs);
      } else {
        setScanSelectionMessage(
          "Ingen uten nettside med e-post i topp 10 — prøv «Legg valgte i kø» på firma du velger selv."
        );
      }
      return;
    }

    setQueueAfterScan(true);
  }

  useEffect(() => {
    if (wasScanningRef.current && !scanning && scanComplete && noWebsiteCount > 0) {
      setListFilter("no_website");
      setNoWebsiteBanner(true);
    }
    wasScanningRef.current = scanning;
  }, [scanning, scanComplete, noWebsiteCount]);

  useEffect(() => {
    if (!queueAfterScan || scanning || !scanComplete) return;
    setQueueAfterScan(false);
    const orgnrs = noWebsiteOrgnrsInSelection(selected);
    if (orgnrs.length > 0) {
      void addLeadsToQueue(orgnrs);
    } else {
      setScanSelectionMessage(
        "Ingen uten nettside med e-post i valget — velg firma og bruk «Legg valgte i kø»."
      );
    }
  }, [queueAfterScan, scanning, scanComplete, companies, selected, websiteScans]);

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
    <div className="scan-glass-kommand w-full max-w-none space-y-2 pb-6 lg:space-y-2.5">
      <section className="scan-surface-full overflow-hidden">
        <TrialNudgeBanner
          noWebsiteCount={noWebsiteCount}
          withEmailCount={withEmailCount}
        />
        <header className="scan-glass-header p-2.5 lg:p-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <h1 className="scan-glass-title">Finn klare leads</h1>
              <p className="scan-glass-subtitle">
                Velg marked → hent kontakt → ring eller send
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
                <PhoneCall className="h-3 w-3 text-brand-gold" />
                {withContactCount} med kontakt
              </span>
            </div>
          </div>
        </header>

        <ScanQueueHint />

        <ScanLeadModes activeMode={activeLeadMode} onSelect={applyLeadMode} />

        <ScanActiveFilterChips
          filters={filters}
          municipalities={props.municipalities}
          onChange={applyFilters}
        />

        <div className="scan-mobile-market-filters scan-glass-divider border-t px-2.5 py-2.5 lg:hidden">
          <p className="scan-glass-muted mb-2 text-[10px] font-semibold uppercase tracking-wide">
            Område og yrke
          </p>
          <CompanyFilters
            layout="mobile-bar"
            filters={filters}
            municipalities={props.municipalities}
            onChange={applyFilters}
          />
        </div>

        <div className="scan-glass-divider flex flex-col border-t lg:flex-row lg:gap-0">
          <aside className="scan-filter-sidebar hidden shrink-0 border-r border-white/10 p-3 lg:block lg:w-[17.5rem] xl:w-[19rem]">
            <p className="scan-glass-muted mb-2 text-[10px] font-semibold uppercase tracking-wide">
              Finn marked
            </p>
            <CompanyFilters
              layout="sidebar"
              filters={filters}
              municipalities={props.municipalities}
              onChange={applyFilters}
            />
          </aside>

          <div className="scan-main-panel min-w-0 flex-1">
            <ScanQuickBar
              withContactCount={withContactCount}
              noWebsiteCount={noWebsiteCount}
              selectedCount={selected.size}
              withEmailCount={withEmailCount}
              scanning={scanning}
              addingToQueue={addingToQueue}
              onSelectWithEmail={selectAllWithEmail}
              onCheckAndQueue={checkAndAddToQueue}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-2.5 py-2 lg:px-3">
              <ScanFilterSheet
                open={filterSheetOpen}
                onOpen={() => setFilterSheetOpen(true)}
                onClose={() => setFilterSheetOpen(false)}
                filters={filters}
                municipalities={props.municipalities}
                onChange={(next) => {
                  applyFilters(next);
                  setFilterSheetOpen(false);
                }}
                activeFilterCount={activeFilterCount}
              />
              {selected.size > 0 && (
                <div className="scan-queue-badge rounded-xl border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[11px]">
                  <span className="scan-glass-strong font-semibold">
                    {scanQueueCount} av {MAX_WEBSITE_SCAN_BATCH} i kø
                  </span>
                  {scanQueueRemaining > 0 && selected.size > MAX_WEBSITE_SCAN_BATCH && (
                    <span className="scan-glass-muted ml-1">
                      · {selected.size - MAX_WEBSITE_SCAN_BATCH} venter til neste runde
                    </span>
                  )}
                </div>
              )}
            </div>

            <div
              id="scan-step-google"
              className="scan-step-panel scan-glass-divider border-b p-2.5 lg:p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <label className="scan-chip cursor-pointer" title="Ekstra søk. Bruk bare når du vil sjekke sosiale medier også.">
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
                    Facebook (ekstra)
                  </label>
                  <label className="scan-chip cursor-pointer" title="Ekstra søk. Bruk bare når du vil sjekke Instagram også.">
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
                    Instagram (ekstra)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={scanSelectedWithGoogle}
                  disabled={scanning || selected.size === 0}
                  className={cn(
                    "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition",
                    selected.size > 0 && !scanning
                      ? "bg-sky-400 text-slate-900 hover:bg-sky-300"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
                  )}
                >
                  <Search className="h-3.5 w-3.5" />
                  {scanning
                    ? "Søker…"
                    : selected.size > 0
                      ? `Sjekk valgte (${scanQueueCount})`
                      : "Velg firma først"}
                </button>
              </div>
              {scanSelectionMessage && (
                <p className="mt-1.5 text-xs font-medium text-amber-200">
                  {scanSelectionMessage}
                </p>
              )}
              <ScanGooglePanel searchQuery={googleSearchQuery} />
            </div>

            {props.dataSource === "brreg" &&
          ((props.companiesSource === "db" &&
            props.dbCompanyCount != null &&
            props.dbCompanyCount > props.total + 2 &&
            filters.days !== 0) ||
            (props.brregTotal != null &&
              props.brregTotal > props.total + 2 &&
              props.companiesSource !== "db")) && (
            <div className="scan-glass-notice mx-2.5 my-2 flex gap-2 lg:mx-3">
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
          withGulesiderCount={withGulesiderCount}
          withInstagramCount={withInstagramCount}
          withLinkedInCount={withLinkedInCount}
          includeFacebook={socialOptions.includeFacebook}
          includeInstagram={socialOptions.includeInstagram}
          includeLinkedIn={socialOptions.includeLinkedIn}
          listFilter={listFilter}
          notScannedCount={notScannedCount}
          onRescan={rescan}
          scanResults={websiteScans}
            />

            <div className="scan-glass-divider border-t px-2.5 py-2 lg:px-3">
          <div className="-mx-0.5 flex flex-wrap gap-1 px-0.5">
            {listTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (filters.websitePresence !== "all") {
                      applyFilters(
                        { ...filters, websitePresence: "all" },
                        { preserveListFilter: true, listFilter: tab.id }
                      );
                    } else {
                      setListFilter(tab.id);
                    }
                  }}
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

          {noWebsiteBanner && listFilter === "no_website" && noWebsiteCount > 0 && (
            <div
              className="mt-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100"
              role="status"
            >
              <strong>{noWebsiteCount} firma uten nettside</strong> — klar for kontakt.
              Velg og send e-post, eller bruk «Sjekk og legg i kø».
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="scan-glass-muted">
            {pagination ? (
              <>
                Viser{" "}
                <strong className="scan-glass-strong">
                  {pageStart > 0 ? `${pageStart}–${pageEnd}` : "0"}
                </strong>{" "}
                {showExactTotal ? (
                  <>
                    av <strong className="scan-glass-strong">{pagination.total}</strong>
                  </>
                ) : props.brregTotal != null ? (
                  <>
                    (ca.{" "}
                    <strong className="scan-glass-strong">
                      {props.brregTotal.toLocaleString("nb-NO")}
                    </strong>{" "}
                    i Brønnøysund)
                  </>
                ) : (
                  <>
                    av minst{" "}
                    <strong className="scan-glass-strong">{pagination.total}</strong>
                  </>
                )}
                {listFilter !== "all" && (
                  <>
                    {" "}
                    · <strong className="scan-glass-strong">{rankedDisplayCompanies.length}</strong> i
                    valgt fane
                  </>
                )}
                {" "}
                · sortert etter score
              </>
            ) : (
              <>
                Viser <strong className="scan-glass-strong">{rankedDisplayCompanies.length}</strong> av{" "}
                {companies.length} · sortert etter score
              </>
            )}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <div className="hidden items-center gap-0.5 rounded-xl border border-white/15 p-0.5 md:flex">
              <button
                type="button"
                onClick={() => setListViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
                  listViewMode === "table" && "bg-white/12 text-white"
                )}
                aria-pressed={listViewMode === "table"}
              >
                <Table2 className="h-3 w-3" />
                Tabell
              </button>
              <button
                type="button"
                onClick={() => setListViewMode("cards")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
                  listViewMode === "cards" && "bg-white/12 text-white"
                )}
                aria-pressed={listViewMode === "cards"}
              >
                <LayoutGrid className="h-3 w-3" />
                Kort
              </button>
            </div>
          </div>

          <div ref={queueActionRef} className="mt-1.5 flex flex-wrap gap-1 scroll-mt-24">
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={addSelectedToQueue}
                  disabled={addingToQueue}
                  className="scan-btn-primary inline-flex items-center gap-1 font-semibold"
                >
                  <ListTodo className="h-3.5 w-3.5" />
                  {addingToQueue ? "Legger i kø…" : `Legg valgte i kø (${selected.size})`}
                </button>
                <button
                  type="button"
                  onClick={exportSelectedCsv}
                  disabled={exporting}
                  className="scan-btn-ghost inline-flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? "Eksporterer…" : `CSV (${selected.size})`}
                </button>
              </>
            )}
            {exportMessage && (
              <p className="w-full text-xs text-emerald-300">{exportMessage}</p>
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
              <>
                <button
                  type="button"
                  onClick={selectNoWebsite}
                  className="scan-btn-ghost"
                >
                  Uten nettside ({noWebsiteCount})
                </button>
                <button
                  type="button"
                  onClick={selectNoWebsiteWithEmail}
                  className="scan-btn-ghost"
                >
                  Uten nettside + e-post
                </button>
              </>
            )}
          </div>
            </div>

            <div className="scan-glass-divider border-t p-2">
              <CompanyTable
                companies={rankedDisplayCompanies}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                allSelected={allSelected}
                onStatusChange={updateStatus}
                liveBrreg={props.dataSource === "brreg"}
                websiteScans={websiteScans}
                scanningOrgnrs={scanning ? scanningOrgnrs : undefined}
                viewMode={listViewMode}
                queueScores={queueScores}
              />

          {pagination && props.onPageChange && (
            <div className="scan-glass-divider mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <p className="scan-glass-muted">
                Side <strong className="scan-glass-strong">{pagination.page}</strong>
                {showExactTotal ? (
                  <>
                    {" "}
                    / <strong className="scan-glass-strong">{pagination.totalPages}</strong>
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
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <div className="scan-glass-floating-bar fixed inset-x-3 bottom-4 z-20 flex items-center justify-between gap-2 border px-3 py-2 sm:inset-x-auto sm:right-6 sm:max-w-lg">
          <span className="text-xs font-semibold text-white">
            {selected.size} valgt
            {scanQueueCount < selected.size && (
              <span className="scan-glass-muted font-normal">
                {" "}
                · {scanQueueCount} i neste sjekk
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={addSelectedToQueue}
            disabled={addingToQueue}
            className="scan-btn-primary min-h-[36px] px-4 text-xs font-semibold"
          >
            {addingToQueue ? "Legger i kø…" : `Legg i kø (${selected.size})`}
          </button>
        </div>
      )}

      <details ref={emailSectionRef} className="scan-surface-pad w-full max-w-none scroll-mt-4">
        <summary className="scan-glass-muted cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide hover:text-slate-200">
          Avansert: send til mange
        </summary>
        <div className="mt-3">
          <SendCampaignForm
            selectedCompanies={selectedCompanies}
            templates={props.templates}
            sequences={props.sequences}
            websiteScans={websiteScans}
            onSent={() => setSelected(new Set())}
            light
          />
        </div>
      </details>

      <ScanSavedAudiences
        onApply={(next) => applyFilters(next)}
        onSaveCurrent={saveAudience}
        saveMessage={saveMessage}
      />
    </div>
  );
}
