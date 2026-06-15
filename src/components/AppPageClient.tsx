"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CompanyFilters,
  type FilterState,
} from "@/components/CompanyFilters";
import { CompanyTable } from "@/components/CompanyTable";
import { SendCampaignForm } from "@/components/SendCampaignForm";
import {
  ScanActiveFilterChips,
  countActiveMarketFilters,
} from "@/components/scan/ScanActiveFilterChips";
import { ScanFilterSheet } from "@/components/scan/ScanFilterSheet";
import { ScanGoogleSection } from "@/components/scan/ScanGoogleSection";
import { ScanLeadModes } from "@/components/scan/ScanLeadModes";
import { ScanListToolbar } from "@/components/scan/ScanListToolbar";
import {
  ScanSavedAudiences,
  type SavedAudienceApply,
} from "@/components/scan/ScanSavedAudiences";
import { AddToListMenu, ScanCompanyLists } from "@/components/scan/ScanCompanyLists";
import { TrialNudgeBanner } from "@/components/scan/TrialNudgeBanner";
import { ScanQuickBar } from "@/components/scan/ScanQuickBar";
import { ScanQueueHint } from "@/components/scan/ScanQueueHint";
import { useAutoWebsiteScan } from "@/hooks/useAutoWebsiteScan";
import {
  loadScanSocialOptions,
  needsSocialRescan,
  saveScanSocialOptions,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import { industryGroupLabel } from "@/lib/constants/industries";
import { MAX_WEBSITE_SCAN_BATCH } from "@/lib/constants/market";
import { isDemoMode } from "@/lib/demo/config";
import {
  filtersForLeadMode,
  listTabForLeadMode,
  persistScanAudienceFilters,
  type ScanLeadMode,
} from "@/lib/scan/lead-modes";
import {
  GeolocationError,
  GPS_PRIVACY_HINT,
  requestUserPosition,
} from "@/lib/scan/geolocation";
import { resolveLocalKommuneFallback } from "@/lib/scan/local-kommune-pref";
import {
  AGENT_LIST_PERIOD_DAYS,
  filtersForAgentListApplication,
  matchesAgentListNoWebsiteTab,
  matchesAgentListWithWebsiteTab,
  shuffledAgentOrgnrsFromFilters,
  type AgentListTab,
  listFilterToWebsitePresence,
  websitePresenceToListFilter,
} from "@/lib/agent/saved-list-filters";
import { buildLeadGoogleSearchQuery } from "@/lib/scan/google-search-query";
import { computeQueueScore } from "@/lib/sales/queue-score";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { useDemo } from "@/lib/demo/store";
import type { LeadStatus } from "@/types/database";
import {
  Building2,
  Globe,
  Globe2,
  List,
  PhoneCall,
  Radar,
  RefreshCw,
  Search,
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

type ContactUsage = {
  used: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
};

/** Holdingselskap: navn med «holding» eller næringskode 64.20x */
function isHoldingCompany(c: CompanyWithLead): boolean {
  if (/\bholding\b/i.test(c.name)) return true;
  return (c.industry_code ?? "").startsWith("64.2");
}

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
  fetchedAt?: string | null;
  contactUsage?: ContactUsage | null;
  onRefreshList?: () => void;
  refreshingList?: boolean;
};

export function AppPageClient(props: Props) {
  const demo = useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [localCompanies, setLocalCompanies] = useState(props.companies);
  const [listFilter, setListFilter] = useState<AgentListTab>(() =>
    websitePresenceToListFilter(searchParams.get("web"))
  );
  const [socialOptions, setSocialOptions] = useState<ScanSocialOptions>(() =>
    loadScanSocialOptions()
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [listViewMode, setListViewMode] = useState<"table" | "cards">("table");
  const [hideHolding, setHideHolding] = useState(false);
  const [noWebsiteBanner, setNoWebsiteBanner] = useState(false);
  const [queueAfterScan, setQueueAfterScan] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const emailSectionRef = useRef<HTMLDetailsElement>(null);
  const wasScanningRef = useRef(false);
  const loadedSavedListIdRef = useRef<string | null>(null);
  const [pinnedOrgnrs, setPinnedOrgnrs] = useState<Set<string> | null>(null);
  const [activeListName, setActiveListName] = useState<string | null>(null);
  const [activeListSource, setActiveListSource] = useState<"agent" | "user" | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [agentListCompanies, setAgentListCompanies] = useState<CompanyWithLead[]>([]);
  const [agentListLoading, setAgentListLoading] = useState(false);

  const activeLeadMode = useMemo((): ScanLeadMode | null => {
    const m = searchParams.get("modus");
    if (m === "websites" || m === "profession" || m === "all_new") return m;
    return null;
  }, [searchParams]);

  useEffect(() => {
    saveScanSocialOptions(socialOptions);
  }, [socialOptions]);

  useEffect(() => {
    if (!listMessage) return;
    const t = window.setTimeout(() => setListMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [listMessage]);

  useEffect(() => {
    if (!saveMessage) return;
    const t = window.setTimeout(() => setSaveMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [saveMessage]);

  useEffect(() => {
    if (selected.size > 0) {
      document.body.dataset.scanSelectionBar = "open";
    } else {
      delete document.body.dataset.scanSelectionBar;
    }
    return () => {
      delete document.body.dataset.scanSelectionBar;
    };
  }, [selected.size]);

  useEffect(() => {
    setListFilter(websitePresenceToListFilter(searchParams.get("web")));
  }, [searchParams]);

  useEffect(() => {
    const listId = searchParams.get("liste");
    if (!listId || isDemoMode()) {
      loadedSavedListIdRef.current = null;
      return;
    }

    fetch(`/api/saved-lists?id=${encodeURIComponent(listId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row: { name?: string; filters?: Record<string, unknown> } | null) => {
        if (!row) return;
        const orgnrs = shuffledAgentOrgnrsFromFilters(row.filters);
        setPinnedOrgnrs(orgnrs.length ? new Set(orgnrs) : null);
        setActiveListName(row.name ?? null);
        setActiveListSource(
          row.filters?.createdBy === "agent"
            ? "agent"
            : orgnrs.length
              ? "user"
              : null
        );
        if (!orgnrs.length) return;

        setNoWebsiteBanner(false);

        const currentDays = searchParams.get("dager");
        const needsPeriodFix =
          currentDays !== "0" && currentDays !== "alle";
        const hasPresenceFilter =
          searchParams.has("fb") || searchParams.has("ig");
        const isNewList = loadedSavedListIdRef.current !== listId;
        loadedSavedListIdRef.current = listId;

        if (isNewList || needsPeriodFix || hasPresenceFilter) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("dager", String(AGENT_LIST_PERIOD_DAYS));
          params.delete("fb");
          params.delete("ig");
          if (isNewList) {
            params.set("web", "without");
          }
          router.replace(`/app?${params.toString()}`);
        }
      })
      .catch(() => undefined);
  }, [searchParams, router]);

  const filters = props.initialFilters;
  const companies =
    props.dataSource === "brreg" ? localCompanies : props.companies;

  const isAgentListActive = Boolean(pinnedOrgnrs && pinnedOrgnrs.size > 0);

  const visibleCompanies = useMemo(() => {
    if (!isAgentListActive || !pinnedOrgnrs) return companies;
    return agentListCompanies;
  }, [isAgentListActive, pinnedOrgnrs, agentListCompanies, companies]);

  const {
    websiteScans,
    scanning,
    scanComplete,
    progress,
    error: scanError,
    providers,
    serperUsage,
    truncated,
    rescan,
    scanCompanies,
    scanningOrgnrs,
    scanPending,
    scanTargetCount,
    scanningName,
  } = useAutoWebsiteScan(visibleCompanies, { autoScan: false, socialOptions });

  const [scanSelectionMessage, setScanSelectionMessage] = useState<string | null>(
    null
  );
  const [geoLocationMessage, setGeoLocationMessage] = useState<string | null>(null);
  const [geoLocationLoading, setGeoLocationLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pinnedOrgnrs?.size) {
      setAgentListCompanies([]);
      setAgentListLoading(false);
      return;
    }

    if (isDemoMode()) {
      setAgentListCompanies(demo.companies.filter((c) => pinnedOrgnrs.has(c.orgnr)));
      setAgentListLoading(false);
      return;
    }

    const orgnrs = Array.from(pinnedOrgnrs);
    const controller = new AbortController();
    setAgentListLoading(true);

    fetch(`/api/companies/by-orgnrs?orgnrs=${encodeURIComponent(orgnrs.join(","))}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Kunne ikke hente AI-liste"))))
      .then((data: { companies?: CompanyWithLead[] }) => {
        setAgentListCompanies(data.companies ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAgentListCompanies([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAgentListLoading(false);
      });

    return () => controller.abort();
  }, [pinnedOrgnrs, demo.companies]);

  const matchesNoWebsiteTab = (orgnr: string) =>
    matchesAgentListNoWebsiteTab(websiteScans.get(orgnr), isAgentListActive);

  const matchesWithWebsiteTab = (orgnr: string) =>
    matchesAgentListWithWebsiteTab(websiteScans.get(orgnr));

  const noWebsiteOrgnrs = useMemo(() => {
    return visibleCompanies
      .filter((c) => matchesNoWebsiteTab(c.orgnr))
      .map((c) => c.orgnr);
  }, [visibleCompanies, websiteScans, isAgentListActive]);

  const noWebsiteCount = noWebsiteOrgnrs.length;
  const withWebsiteCount = useMemo(
    () => visibleCompanies.filter((c) => matchesWithWebsiteTab(c.orgnr)).length,
    [visibleCompanies, websiteScans]
  );

  const withFacebookCount = useMemo(
    () =>
      visibleCompanies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.facebookUrl))
        .length,
    [visibleCompanies, websiteScans]
  );

  const withGulesiderCount = useMemo(
    () =>
      visibleCompanies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.gulesiderListed))
        .length,
    [visibleCompanies, websiteScans]
  );

  const withInstagramCount = useMemo(
    () =>
      visibleCompanies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.instagramUrl))
        .length,
    [visibleCompanies, websiteScans]
  );

  const withLinkedInCount = useMemo(
    () =>
      visibleCompanies.filter((c) => Boolean(websiteScans.get(c.orgnr)?.linkedinUrl))
        .length,
    [visibleCompanies, websiteScans]
  );

  const notScannedCount = useMemo(
    () =>
      visibleCompanies.filter((c) => c.has_email && !websiteScans.has(c.orgnr)).length,
    [visibleCompanies, websiteScans]
  );

  const withEmailCount = useMemo(
    () => visibleCompanies.filter((c) => c.has_email).length,
    [visibleCompanies]
  );

  const withContactCount = useMemo(
    () =>
      visibleCompanies.filter((c) => {
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
    [visibleCompanies, websiteScans]
  );

  const companyListKey = useMemo(
    () => visibleCompanies.map((c) => c.orgnr).join(","),
    [visibleCompanies]
  );

  useEffect(() => {
    setLocalCompanies(props.companies);
  }, [companyListKey, props.fetchedAt]);

  useEffect(() => {
    setSelected(new Set());
    if (!isAgentListActive) {
      setNoWebsiteBanner(false);
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("web")) {
        params.delete("web");
        params.delete("page");
        router.replace(`/app?${params.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved ny firmaliste
  }, [companyListKey, isAgentListActive]);

  const activeFilterCount = countActiveMarketFilters(
    filters,
    props.municipalities
  );

  const scanQueueCount = Math.min(selected.size, MAX_WEBSITE_SCAN_BATCH);

  const matchesSocialPresenceFilters = (c: CompanyWithLead) => {
    if (isAgentListActive) return true;

    const scan = websiteScans.get(c.orgnr);

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

  const holdingCount = useMemo(
    () => visibleCompanies.filter(isHoldingCompany).length,
    [visibleCompanies]
  );

  const companiesByListTab = useMemo(() => {
    const applyTab = (tabId: typeof listFilter) => {
      let list = visibleCompanies;
      if (hideHolding) {
        list = list.filter((c) => !isHoldingCompany(c));
      }
      if (tabId === "no_website") {
        list = list.filter((c) => matchesNoWebsiteTab(c.orgnr));
      } else if (tabId === "with_website") {
        list = list.filter((c) => matchesWithWebsiteTab(c.orgnr));
      } else if (tabId === "not_scanned") {
        list = list.filter((c) => c.has_email && !websiteScans.has(c.orgnr));
      }
      return list.filter(matchesSocialPresenceFilters);
    };

    return {
      all: applyTab("all"),
      no_website: applyTab("no_website"),
      with_website: applyTab("with_website"),
      not_scanned: applyTab("not_scanned"),
    };
  }, [
    visibleCompanies,
    websiteScans,
    isAgentListActive,
    hideHolding,
    filters.websitePresence,
    filters.facebookPresence,
    filters.instagramPresence,
  ]);

  const displayCompanies = useMemo(
    () => companiesByListTab[listFilter],
    [companiesByListTab, listFilter]
  );

  const queueScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of visibleCompanies) {
      map.set(
        c.orgnr,
        computeQueueScore(c, c.user_lead ?? null, websiteScans.get(c.orgnr) ?? null)
      );
    }
    return map;
  }, [visibleCompanies, websiteScans]);

  const rankedDisplayCompanies = useMemo(() => {
    if (isAgentListActive) {
      return displayCompanies;
    }
    return [...displayCompanies].sort(
      (a, b) => (queueScores.get(b.orgnr) ?? 0) - (queueScores.get(a.orgnr) ?? 0)
    );
  }, [displayCompanies, queueScores, isAgentListActive]);

  function applyFilters(
    next: FilterState,
    options?: {
      preserveListFilter?: boolean;
      listFilter?: typeof listFilter;
      listId?: string | null;
      agentOrgnrs?: string[] | null;
      listName?: string | null;
      listSource?: "agent" | "user" | null;
      modus?: ScanLeadMode | null;
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
      next.professionId &&
      next.professionId !== filters.professionId &&
      next.days !== 0
    ) {
      next = { ...next, days: 0 };
    }
    if (
      (next.nameQuery ?? "").trim() &&
      next.nameQuery !== filters.nameQuery &&
      next.days !== 0
    ) {
      next = { ...next, days: 0 };
    }
    if (options?.agentOrgnrs?.length) {
      next = filtersForAgentListApplication(
        {
          agentOrgnrs: options.agentOrgnrs,
          createdBy: "agent",
        },
        next
      );
      setNoWebsiteBanner(false);
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
    if (next.professionId) params.set("yrke", next.professionId);
    else params.delete("yrke");
    const trimmedNameQuery = (next.nameQuery ?? "").trim();
    if (trimmedNameQuery) params.set("navn", trimmedNameQuery);
    else params.delete("navn");
    if (next.websitePresence !== "all") params.set("web", next.websitePresence);
    else params.delete("web");
    if (next.facebookPresence !== "all") params.set("fb", next.facebookPresence);
    else params.delete("fb");
    if (next.instagramPresence !== "all") params.set("ig", next.instagramPresence);
    else params.delete("ig");
    params.delete("page");
    if (options?.modus) params.set("modus", options.modus);
    else if (options?.modus === null) params.delete("modus");
    if (options?.listId) params.set("liste", options.listId);
    else params.delete("liste");
    persistScanAudienceFilters(next);
    setSelected(new Set());
    if (options?.agentOrgnrs !== undefined) {
      const shuffledOrgnrs = options.agentOrgnrs?.length
        ? shuffledAgentOrgnrsFromFilters({ agentOrgnrs: options.agentOrgnrs })
        : null;
      setPinnedOrgnrs(shuffledOrgnrs?.length ? new Set(shuffledOrgnrs) : null);
    } else if (!options?.preserveListFilter) {
      setPinnedOrgnrs(null);
      setActiveListName(null);
    }
    if (options?.listName !== undefined) {
      setActiveListName(options.listName);
    }
    if (options?.listSource !== undefined) {
      setActiveListSource(options.listSource);
    } else if (options?.agentOrgnrs !== undefined) {
      setActiveListSource(options.agentOrgnrs?.length ? "user" : null);
    }
    if (options?.preserveListFilter && options.listFilter) {
      setListFilter(options.listFilter);
    } else if (!options?.preserveListFilter) {
      setListFilter("all");
    }
    router.push(`/app?${params.toString()}`);
  }

  function applySavedAudience(payload: SavedAudienceApply) {
    applyFilters(payload.filters, {
      preserveListFilter: true,
      listFilter:
        payload.agentOrgnrs?.length && payload.listSource === "agent"
          ? "no_website"
          : "all",
      listId: payload.listId ?? null,
      agentOrgnrs: payload.agentOrgnrs ?? null,
      listName: payload.listName ?? null,
      listSource: payload.listSource ?? (payload.agentOrgnrs?.length ? "user" : null),
    });
  }

  function applyProfessionModeFilters(
    municipalityCode: string,
    regionId: string,
    options?: { openFilters?: boolean }
  ) {
    const listTab = listTabForLeadMode("profession");
    const next = filtersForLeadMode("profession", {
      ...filters,
      municipalityCode,
      regionId,
    });
    applyFilters(next, {
      preserveListFilter: true,
      listFilter: listTab,
      listId: null,
      agentOrgnrs: null,
      listName: null,
      listSource: null,
      modus: "profession",
    });
    setNoWebsiteBanner(false);
    if (
      options?.openFilters &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setFilterSheetOpen(true);
    }
  }

  async function fetchDefaultMunicipalityPreference(): Promise<string | null> {
    if (isDemoMode()) return null;
    try {
      const res = await fetch("/api/user/memory?key=default_municipality");
      if (!res.ok) return null;
      const data = (await res.json()) as { value?: string | null };
      return data.value?.trim() || null;
    } catch {
      return null;
    }
  }

  async function applyProfessionModeWithGps() {
    setGeoLocationLoading(true);
    setGeoLocationMessage(`${GPS_PRIVACY_HINT} Henter posisjon…`);

    try {
      const pos = await requestUserPosition();
      const res = await fetch(
        `/api/geo/kommune?lat=${encodeURIComponent(String(pos.lat))}&lng=${encodeURIComponent(String(pos.lng))}`
      );
      const data = (await res.json()) as {
        kommunenummer?: string;
        kommunenavn?: string;
        regionId?: string;
        error?: string;
      };

      if (res.ok && data.kommunenummer) {
        applyProfessionModeFilters(
          data.kommunenummer,
          data.regionId ?? "",
          { openFilters: true }
        );
        setGeoLocationMessage(`Viser firma i ${data.kommunenavn ?? "ditt område"} (fra GPS).`);
        return;
      }

      await applyProfessionModeFallback(
        data.error ?? "Fant ikke kommune for posisjonen din."
      );
    } catch (err) {
      const reason =
        err instanceof GeolocationError
          ? err.message
          : "Kunne ikke hente posisjon.";
      await applyProfessionModeFallback(reason);
    } finally {
      setGeoLocationLoading(false);
    }
  }

  async function applyProfessionModeFallback(reason: string) {
    const memoryValue = await fetchDefaultMunicipalityPreference();
    const fallback = resolveLocalKommuneFallback({
      memoryValue,
      currentMunicipalityCode: filters.municipalityCode,
      municipalities: props.municipalities,
    });

    if (fallback) {
      applyProfessionModeFilters(
        fallback.municipalityCode,
        fallback.regionId,
        { openFilters: true }
      );
      const placeLabel = fallback.municipalityName ?? fallback.municipalityCode;
      const sourceLabel =
        fallback.source === "memory"
          ? "lagret preferanse"
          : fallback.source === "saved_filters"
            ? "tidligere valg"
            : "nåværende filter";
      setGeoLocationMessage(`${reason} Bruker ${placeLabel} (${sourceLabel}).`);
      return;
    }

    const listTab = listTabForLeadMode("profession");
    const next = filtersForLeadMode("profession", filters);
    applyFilters(next, {
      preserveListFilter: true,
      listFilter: listTab,
      listId: null,
      agentOrgnrs: null,
      listName: null,
      listSource: null,
      modus: "profession",
    });
    setNoWebsiteBanner(false);
    setFilterSheetOpen(true);
    setGeoLocationMessage(`${reason} Velg kommune under.`);
  }

  function applyLeadMode(mode: ScanLeadMode) {
    if (mode === "profession") {
      void applyProfessionModeWithGps();
      return;
    }

    setGeoLocationMessage(null);
    const listTab = listTabForLeadMode(mode);
    const next = filtersForLeadMode(mode, filters);
    applyFilters(next, {
      preserveListFilter: true,
      listFilter: listTab,
      listId: null,
      agentOrgnrs: null,
      listName: null,
      listSource: null,
      modus: mode,
    });
    setNoWebsiteBanner(false);
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

  function selectAllWithEmail() {
    setSelected(
      new Set(rankedDisplayCompanies.filter((c) => c.has_email).map((c) => c.orgnr))
    );
  }

  function noWebsiteOrgnrsInSelection(orgnrFilter?: Set<string>) {
    return visibleCompanies
      .filter(
        (c) =>
          (!orgnrFilter || orgnrFilter.has(c.orgnr)) &&
          matchesNoWebsiteTab(c.orgnr) &&
          c.has_email
      )
      .map((c) => c.orgnr);
  }

  async function addLeadsToQueue(
    orgnrs: string[],
    options?: { stayOnPage?: boolean }
  ) {
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
      if (options?.stayOnPage) {
        setListMessage(`${queued} firma lagt i kø`);
        return;
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

  // Hurtighandlinger fra rad-hover i tabellen
  function quickQueueCompany(c: CompanyWithLead) {
    void addLeadsToQueue([c.orgnr], { stayOnPage: true });
  }

  function quickEmailCompany(c: CompanyWithLead) {
    setSelected(new Set([c.orgnr]));
    const section = emailSectionRef.current;
    if (section) {
      section.open = true;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function quickCheckWebsiteCompany(c: CompanyWithLead) {
    setScanSelectionMessage(null);
    const result = scanCompanies([c], { preserveOrder: true });
    if (!result.ok) setScanSelectionMessage(result.message);
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
    const prevCompany =
      visibleCompanies.find((c) => c.orgnr === orgnr) ??
      companies.find((c) => c.orgnr === orgnr);
    if (!prevCompany) return;

    const prevStatus = prevCompany.user_lead?.status ?? "ny";
    if (prevStatus === status) return;

    const now = new Date().toISOString();
    const nextLead = (
      lead: CompanyWithLead["user_lead"]
    ): NonNullable<CompanyWithLead["user_lead"]> => ({
      user_id: lead?.user_id && lead.user_id !== "brreg-db" ? lead.user_id : "local",
      orgnr,
      status: status as LeadStatus,
      score: lead?.score ?? prevCompany.user_lead?.score ?? 0,
      notes: lead?.notes ?? null,
      last_contacted_at:
        status === "kontaktet" ? now : lead?.last_contacted_at ?? null,
      next_follow_up_at: lead?.next_follow_up_at ?? null,
      queued_at: lead?.queued_at ?? null,
      created_at: lead?.created_at ?? now,
      updated_at: now,
    });

    const patchList = (list: CompanyWithLead[]) =>
      list.map((c) =>
        c.orgnr === orgnr ? { ...c, user_lead: nextLead(c.user_lead) } : c
      );

    const applyLocal = () => {
      if (props.dataSource === "brreg") {
        setLocalCompanies(patchList);
        if (isAgentListActive) {
          setAgentListCompanies(patchList);
        }
        return;
      }
      demo.updateLeadStatus(orgnr, status as LeadStatus);
    };

    applyLocal();

    if (isDemoMode()) return;

    try {
      const res = await fetch("/api/leads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgnr, status }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Statusendring feilet");
    } catch (err) {
      const restoreLead = prevCompany.user_lead ?? null;
      const restoreList = (list: CompanyWithLead[]) =>
        list.map((c) =>
          c.orgnr === orgnr ? { ...c, user_lead: restoreLead } : c
        );

      if (props.dataSource === "brreg") {
        setLocalCompanies(restoreList);
        if (isAgentListActive) {
          setAgentListCompanies(restoreList);
        }
      } else {
        demo.updateLeadStatus(orgnr, prevStatus as LeadStatus);
      }
      setScanSelectionMessage(
        err instanceof Error ? err.message : "Kunne ikke endre status"
      );
    }
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
      professionId: filters.professionId,
      nameQuery: filters.nameQuery,
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

  const selectedCompanies = visibleCompanies.filter((c) => selected.has(c.orgnr));

  const googleSearchQuery = useMemo(() => {
    if (selectedCompanies.length !== 1) return "";
    return buildLeadGoogleSearchQuery(selectedCompanies[0]);
  }, [selectedCompanies]);

  function handleSocialOptionsChange(next: ScanSocialOptions) {
    const addedFacebook = next.includeFacebook && !socialOptions.includeFacebook;
    const addedInstagram = next.includeInstagram && !socialOptions.includeInstagram;
    setSocialOptions(next);

    if ((addedFacebook || addedInstagram) && selected.size > 0) {
      const targets = visibleCompanies.filter((c) => selected.has(c.orgnr));
      const missingSocial = targets.filter((c) => {
        const scan = websiteScans.get(c.orgnr);
        return scan && needsSocialRescan(scan, next);
      });
      if (missingSocial.length > 0) {
        const label = addedFacebook ? "Facebook" : "Instagram";
        setScanSelectionMessage(
          `${missingSocial.length} valgte er sjekket uten ${label} — trykk «Sjekk valgte» for nytt søk.`
        );
      }
    }
  }

  function scanSelectedWithGoogle() {
    setScanSelectionMessage(null);
    const result = scanCompanies(selectedCompanies, { preserveOrder: true });
    if (!result.ok) {
      setScanSelectionMessage(result.message);
      return result;
    }
    if ("cachedOnly" in result && result.cachedOnly) {
      if (result.socialRescanCount && result.socialRescanCount > 0) {
        setScanSelectionMessage(
          "Valgte firma trenger nytt sosialt søk — huk av Facebook/Instagram og trykk «Sjekk valgte» igjen."
        );
        return result;
      }
      setScanSelectionMessage("Alle valgte er allerede sjekket — ingen nytt Google-søk.");
      if (noWebsiteCount > 0) {
        setNoWebsiteBanner(true);
        if (searchParams.get("web") !== "without") {
          const params = new URLSearchParams(searchParams.toString());
          params.set("web", "without");
          params.delete("page");
          router.replace(`/app?${params.toString()}`);
        }
      }
      return result;
    }
    const parts: string[] = [];
    if (result.cachedCount && result.cachedCount > 0) {
      parts.push(`${result.cachedCount} allerede lagret`);
    }
    if (result.scanned > 0) {
      parts.push(`sjekker ${result.scanned} nå (ca. 2 Google-kall per firma)`);
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

  function rescanSelectedOrVisible() {
    if (selected.size > 0) {
      setScanSelectionMessage(null);
      scanCompanies(selectedCompanies, {
        preserveOrder: true,
        forceRescan: true,
      });
      return;
    }
    rescan();
  }

  function checkAndAddToQueue() {
    const ranked = [...visibleCompanies]
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
      setNoWebsiteBanner(true);
      if (searchParams.get("web") !== "without") {
        const params = new URLSearchParams(searchParams.toString());
        params.set("web", "without");
        params.delete("page");
        router.replace(`/app?${params.toString()}`);
      }
    }
    wasScanningRef.current = scanning;
  }, [scanning, scanComplete, noWebsiteCount, searchParams, router]);

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
  }, [queueAfterScan, scanning, scanComplete, visibleCompanies, selected, websiteScans]);

  function handleListTabChange(tabId: AgentListTab) {
    applyFilters(
      { ...filters, websitePresence: listFilterToWebsitePresence(tabId) },
      { preserveListFilter: true, listFilter: tabId }
    );
  }

  const listTabs = [
    {
      id: "all" as const,
      label: "Alle",
      shortLabel: "Alle",
      count: companiesByListTab.all.length,
      icon: List,
    },
    {
      id: "no_website" as const,
      label: "Uten nettside",
      shortLabel: "Uten web",
      count: companiesByListTab.no_website.length,
      icon: Globe,
      pinned: true,
    },
    {
      id: "with_website" as const,
      label: "Med nettside",
      shortLabel: "Med web",
      count: companiesByListTab.with_website.length,
      icon: Globe2,
      pinned: true,
    },
    {
      id: "not_scanned" as const,
      label: "Ikke sjekket",
      shortLabel: "Ujekket",
      count: companiesByListTab.not_scanned.length,
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

  const firmCount = pagination
    ? showExactTotal
      ? pagination.total
      : companies.length
    : companies.length;

  const sourceMetaParts: string[] = [];
  if (props.companiesSource === "db") {
    sourceMetaParts.push(
      `Database${
        props.dbCompanyCount != null
          ? ` (${props.dbCompanyCount.toLocaleString("nb-NO")})`
          : ""
      }`
    );
  } else if (props.dataSource === "brreg") {
    sourceMetaParts.push("Live Brreg");
  }
  if (props.contactUsage) {
    const { used, limit, remaining, limitReached } = props.contactUsage;
    sourceMetaParts.push(
      limitReached
        ? `${used} av ${limit} kontakter brukt`
        : `${used} av ${limit} kontakter (${remaining} igjen)`
    );
  }
  if (props.fetchedAt) {
    sourceMetaParts.push(
      new Date(props.fetchedAt).toLocaleTimeString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  const listSummary = isAgentListActive
    ? `AI-liste: ${rankedDisplayCompanies.length} av ${visibleCompanies.length}${
        listFilter !== "all" ? ` · ${rankedDisplayCompanies.length} i valgt fane` : ""
      }${agentListLoading ? " · henter firma…" : ""} · blandet rekkefølge`
    : pagination
    ? `Viser ${pageStart > 0 ? `${pageStart}–${pageEnd}` : "0"} ${
        showExactTotal
          ? `av ${pagination.total}`
          : props.brregTotal != null
            ? `(ca. ${props.brregTotal.toLocaleString("nb-NO")} i Brønnøysund)`
            : `av minst ${pagination.total}`
      }${listFilter !== "all" ? ` · ${rankedDisplayCompanies.length} i valgt fane` : ""} · sortert etter score`
    : `Viser ${rankedDisplayCompanies.length} av ${companies.length} · sortert etter score`;

  return (
    <div className="scan-glass-kommand w-full max-w-none space-y-3 pb-8 lg:space-y-4">
      <section className="scan-surface-full overflow-hidden">
        <TrialNudgeBanner
          noWebsiteCount={noWebsiteCount}
          withEmailCount={withEmailCount}
        />
        <header className="scan-glass-header scan-page-header px-4 py-2.5 lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h1 className="scan-glass-title">Skann</h1>
              <span className="scan-stat-inline">
                <Building2 className="mr-0.5 inline h-3 w-3 opacity-60" aria-hidden />
                <strong>{firmCount}</strong> firma
                <span className="mx-1.5 opacity-40" aria-hidden>
                  ·
                </span>
                <PhoneCall className="mr-0.5 inline h-3 w-3 opacity-60" aria-hidden />
                <strong>{withContactCount}</strong> med kontakt
              </span>
            </div>
            {props.onRefreshList && (
              <button
                type="button"
                onClick={props.onRefreshList}
                disabled={props.refreshingList}
                className="scan-glass-toolbar-btn inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${props.refreshingList ? "animate-spin" : ""}`}
                  aria-hidden
                />
                <span className="hidden sm:inline">Oppdater</span>
              </button>
            )}
          </div>

          {sourceMetaParts.length > 0 && (
            <p
              className={`scan-page-meta mt-0.5 text-[11px] leading-snug ${
                props.contactUsage?.limitReached ? "text-amber-300/90" : "scan-glass-muted"
              }`}
            >
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  props.companiesSource === "db" ? "bg-sky-400" : "bg-emerald-400"
                }`}
                aria-hidden
              />
              {sourceMetaParts.join(" · ")}
              {props.contactUsage?.limitReached && (
                <>
                  {" "}
                  —{" "}
                  <a href="/app/abonnement" className="font-semibold underline">
                    Se abonnement
                  </a>
                </>
              )}
            </p>
          )}

          <div className="scan-page-controls-row mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ScanLeadModes
              activeMode={activeLeadMode}
              onSelect={applyLeadMode}
              disabled={geoLocationLoading}
            />
            <ScanActiveFilterChips
              filters={filters}
              municipalities={props.municipalities}
              onChange={applyFilters}
              variant="inline"
            />
          </div>

          {geoLocationMessage && (
            <p
              className="scan-glass-muted mt-1.5 text-[11px] leading-snug"
              role="status"
              aria-live="polite"
            >
              {geoLocationMessage}
            </p>
          )}

          <ScanQueueHint />
        </header>

        <div className="scan-glass-divider flex flex-col border-t lg:flex-row lg:gap-0">
          <aside className="scan-filter-sidebar hidden shrink-0 border-r border-white/[0.06] p-4 lg:block lg:w-[17.5rem] xl:w-[19rem]">
            <p className="scan-filter-section-title mb-2 px-0.5">
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
              withWebsiteCount={withWebsiteCount}
              noWebsiteCount={noWebsiteCount}
              selectedCount={selected.size}
              withEmailCount={withEmailCount}
              scanning={scanning}
              addingToQueue={addingToQueue}
              onSelectWithEmail={selectAllWithEmail}
              onCheckAndQueue={checkAndAddToQueue}
              onOpenFilters={() => setFilterSheetOpen(true)}
              activeFilterCount={activeFilterCount}
              nameQuery={filters.nameQuery ?? ""}
              onNameQueryChange={(nameQuery) => applyFilters({ ...filters, nameQuery })}
            />

            <ScanFilterSheet
              open={filterSheetOpen}
              onOpen={() => setFilterSheetOpen(true)}
              onClose={() => setFilterSheetOpen(false)}
              filters={filters}
              municipalities={props.municipalities}
              onChange={applyFilters}
              activeFilterCount={activeFilterCount}
              hideTrigger
              listTabs={listTabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                count: tab.count,
              }))}
              activeListTab={listFilter}
              onListTabChange={handleListTabChange}
            />

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

            <ScanListToolbar
              tabs={listTabs}
              activeTab={listFilter}
              onTabChange={handleListTabChange}
              listViewMode={listViewMode}
              onViewModeChange={setListViewMode}
              summary={listSummary}
              selectedCount={selected.size}
              addingToQueue={addingToQueue}
              exporting={exporting}
              onAddToQueue={addSelectedToQueue}
              onExportCsv={exportSelectedCsv}
              exportMessage={exportMessage}
            />

            <div className="flex items-center px-3 pb-2 lg:px-4">
              <label className="scan-glass-muted inline-flex cursor-pointer select-none items-center gap-1.5 text-[11px]">
                <input
                  type="checkbox"
                  checked={hideHolding}
                  onChange={(e) => setHideHolding(e.target.checked)}
                  className="cv-checkbox h-3.5 w-3.5 rounded accent-sky-600"
                />
                Skjul holdingselskap
                {holdingCount > 0 && (
                  <span className="opacity-70">({holdingCount})</span>
                )}
              </label>
            </div>

            {activeListName && pinnedOrgnrs && pinnedOrgnrs.size > 0 && (
              <div className="scan-banner scan-banner-accent" role="status">
                <strong>
                  {activeListSource === "agent" ? "AI-liste" : "Firma-liste"}: {activeListName}
                </strong>{" "}
                — viser {agentListLoading ? "…" : visibleCompanies.length} av {pinnedOrgnrs.size}{" "}
                {activeListSource === "agent" ? "firma fra agenten" : "lagrede firma"}
                {visibleCompanies.length < pinnedOrgnrs.size ? (
                  <span>
                    {" "}
                    ({pinnedOrgnrs.size - visibleCompanies.length} finnes ikke i registeret)
                  </span>
                ) : null}
              </div>
            )}

            {isAgentListActive && filters.days !== AGENT_LIST_PERIOD_DAYS && (
              <div className="scan-glass-notice mx-2.5 mb-2 flex gap-2 lg:mx-3">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p>
                  AI-listen viser valgte firma uavhengig av når de ble registrert.{" "}
                  <strong>Siste 30 dager</strong> gjelder bare bakgrunnslisten — ikke disse{" "}
                  {pinnedOrgnrs?.size ?? 0} firmaene.
                </p>
              </div>
            )}

            {noWebsiteBanner && listFilter === "no_website" && noWebsiteCount > 0 && (
              <div className="scan-banner scan-banner-success" role="status">
                <strong>{noWebsiteCount} firma uten nettside</strong> — gode leads for nettside-salg.
              </div>
            )}

            {listFilter === "with_website" && withWebsiteCount > 0 && (
              <div className="scan-banner scan-banner-accent" role="status">
                <strong>{withWebsiteCount} firma med nettside</strong> — har allerede egen side på nett.
              </div>
            )}

            {selected.size > MAX_WEBSITE_SCAN_BATCH && (
              <p className="scan-glass-muted px-2.5 text-[11px] lg:px-3">
                Google sjekker maks {MAX_WEBSITE_SCAN_BATCH} om gangen — {scanQueueCount} valgt til
                neste sjekk.
              </p>
            )}

            <div className="scan-glass-divider border-t px-3 py-3 lg:px-4">
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
                onQuickQueue={quickQueueCompany}
                onQuickEmail={quickEmailCompany}
                onQuickCheckWebsite={quickCheckWebsiteCompany}
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

            <ScanGoogleSection
              selectedCount={selected.size}
              scanQueueCount={scanQueueCount}
              scanning={scanning}
              onScanSelected={scanSelectedWithGoogle}
              socialOptions={socialOptions}
              onSocialOptionsChange={handleSocialOptionsChange}
              scanSelectionMessage={scanSelectionMessage}
              googleSearchQuery={googleSearchQuery}
              scanComplete={scanComplete}
              scanPending={scanPending}
              scanTargetCount={scanTargetCount}
              scanningName={scanningName}
              progress={progress}
              scanError={scanError}
              providers={providers}
              serperUsage={serperUsage}
              truncated={truncated}
              noWebsiteCount={noWebsiteCount}
              withWebsiteCount={withWebsiteCount}
              withFacebookCount={withFacebookCount}
              withGulesiderCount={withGulesiderCount}
              withInstagramCount={withInstagramCount}
              withLinkedInCount={withLinkedInCount}
              listFilter={listFilter}
              notScannedCount={notScannedCount}
              onRescan={rescanSelectedOrVisible}
              websiteScans={websiteScans}
            />
            </div>
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <div className="scan-glass-floating-bar fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-2 border px-3 py-2 sm:inset-x-auto sm:right-6 sm:max-w-lg">
          <span className="text-xs font-semibold text-white">
            {selected.size} valgt
            {scanQueueCount < selected.size && (
              <span className="scan-glass-muted font-normal">
                {" "}
                · {scanQueueCount} i neste sjekk
              </span>
            )}
          </span>
          <AddToListMenu
            selectedOrgnrs={Array.from(selected)}
            onApply={applySavedAudience}
            onAdded={setListMessage}
          />
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

      {listMessage && selected.size === 0 && (
        <p className="fixed inset-x-3 bottom-20 z-20 text-center text-xs text-emerald-300 sm:inset-x-auto sm:right-6">
          {listMessage}
        </p>
      )}

      <details ref={emailSectionRef} className="scan-surface-pad mx-2 w-auto scroll-mt-4 sm:mx-3">
        <summary className="scan-glass-muted cursor-pointer select-none text-sm font-medium hover:text-white">
          Send e-post til valgte firma
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

      <details className="scan-surface-pad mx-2 w-auto sm:mx-3">
        <summary className="scan-glass-muted cursor-pointer select-none text-sm font-medium hover:text-white">
          Mine firmalister
        </summary>
        <div className="mt-3">
          <ScanCompanyLists
            selectedOrgnrs={Array.from(selected)}
            onApply={applySavedAudience}
            onAdded={setListMessage}
          />
        </div>
      </details>

      <details className="scan-surface-pad mx-2 w-auto sm:mx-3">
        <summary className="scan-glass-muted cursor-pointer select-none text-sm font-medium hover:text-white">
          Lagrede målgrupper
        </summary>
        <div className="mt-3">
          <ScanSavedAudiences
            currentFilters={filters}
            onApply={applySavedAudience}
            onSaveCurrent={saveAudience}
            saveMessage={saveMessage}
          />
        </div>
      </details>
    </div>
  );
}
