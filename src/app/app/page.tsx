"use client";

import { AppPageClient } from "@/components/AppPageClient";
import { DEMO_MUNICIPALITIES } from "@/lib/demo/data";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";
import { filterDemoCompanies, useDemo } from "@/lib/demo/store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterState } from "@/components/CompanyFilters";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { parseProfessionIdFromParam } from "@/lib/constants/professions";
import { regionLabel } from "@/lib/constants/regions";
import { getDemoShuffleSessionId } from "@/lib/shuffle/demo-session";
import {
  buildDemoShuffleSeed,
  seededShuffle,
} from "@/lib/shuffle/seeded-shuffle";
import { ScanFetchLoading } from "@/components/scan/ScanFetchLoading";
import { RefreshCw } from "lucide-react";

function parseDaysParam(params: URLSearchParams): number {
  const d = params.get("dager");
  if (d === "0" || d === "alle") return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 30;
}

function periodLabel(days: number): string {
  if (days === 0) return "alle firma (ingen tidsgrense)";
  return `siste ${days} dager`;
}

function parseFilters(params: URLSearchParams, brreg = false): FilterState {
  const hasAnyFilter =
    params.has("omrade") ||
    params.has("kommune") ||
    params.has("dager") ||
    params.has("epost") ||
    params.has("generisk") ||
    params.has("bransje") ||
    params.has("yrke");

  if (brreg && !hasAnyFilter) {
    return { ...DEFAULT_MARKET_FILTERS, industryGroup: "" };
  }

  return {
    regionId: params.has("omrade")
      ? (params.get("omrade") ?? "")
      : brreg && !hasAnyFilter
        ? DEFAULT_MARKET_FILTERS.regionId
        : "",
    municipalityCode: params.has("kommune")
      ? (params.get("kommune") ?? "")
      : brreg && !hasAnyFilter
        ? DEFAULT_MARKET_FILTERS.municipalityCode
        : "",
    days: parseDaysParam(params),
    hasEmail: params.has("epost")
      ? params.get("epost") === "1"
      : brreg
        ? DEFAULT_MARKET_FILTERS.hasEmail
        : false,
    genericEmailOnly: params.has("generisk")
      ? params.get("generisk") === "1"
      : brreg
        ? DEFAULT_MARKET_FILTERS.genericEmailOnly
        : false,
    industryGroup: params.get("bransje") ?? "",
    professionId: parseProfessionIdFromParam(params.get("yrke") ?? ""),
    websitePresence:
      (params.get("web") as FilterState["websitePresence"]) || "all",
    facebookPresence:
      (params.get("fb") as FilterState["facebookPresence"]) || "all",
    instagramPresence:
      (params.get("ig") as FilterState["instagramPresence"]) || "all",
  };
}

function parsePageParam(params: URLSearchParams): number {
  const raw = params.get("page");
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function buildCompaniesQuery(filters: FilterState, page = 1): string {
  const params = new URLSearchParams();
  if (filters.regionId) params.set("omrade", filters.regionId);
  else params.delete("omrade");
  if (filters.municipalityCode) params.set("kommune", filters.municipalityCode);
  else params.delete("kommune");
  params.set("dager", String(filters.days));
  params.set("epost", filters.hasEmail ? "1" : "0");
  params.set("generisk", filters.genericEmailOnly ? "1" : "0");
  if (filters.industryGroup) params.set("bransje", filters.industryGroup);
  else params.delete("bransje");
  if (filters.professionId) params.set("yrke", filters.professionId);
  else params.delete("yrke");
  if (filters.websitePresence !== "all") params.set("web", filters.websitePresence);
  else params.delete("web");
  if (filters.facebookPresence !== "all") params.set("fb", filters.facebookPresence);
  else params.delete("fb");
  if (filters.instagramPresence !== "all") params.set("ig", filters.instagramPresence);
  else params.delete("ig");
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  return params.toString();
}

function FirmaPageDemo() {
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams);
  const { companies, templates, sequences } = useDemo();

  const filtered = filterDemoCompanies(companies, {
    regionId: filters.regionId || undefined,
    municipalityCode: filters.municipalityCode || undefined,
    days: filters.days,
    hasEmail: filters.hasEmail,
    genericEmailOnly: filters.genericEmailOnly,
    industryGroup: filters.industryGroup || undefined,
    professionId: filters.professionId || undefined,
  });

  const shuffled = useMemo(() => {
    const seed = buildDemoShuffleSeed(
      {
        regionId: filters.regionId || undefined,
        municipalityCode: filters.municipalityCode || undefined,
        days: filters.days,
        hasEmail: filters.hasEmail,
        genericEmailOnly: filters.genericEmailOnly,
        industryGroup: filters.industryGroup || undefined,
        professionId: filters.professionId || undefined,
      },
      getDemoShuffleSessionId()
    );
    return seededShuffle(filtered, seed);
  }, [filtered, filters]);

  return (
    <AppPageClient
      companies={shuffled}
      total={shuffled.length}
      withEmail={shuffled.filter((c) => c.has_email).length}
      municipalities={DEMO_MUNICIPALITIES}
      initialFilters={filters}
      templates={templates}
      sequences={sequences}
      dataSource="demo"
    />
  );
}

type SequenceOption = {
  id: string;
  name: string;
  active: boolean;
  steps: { step_order: number; delay_days: number; subject: string; body: string }[];
};

function FirmaPageBrreg() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams, true);
  const currentPage = parsePageParam(searchParams);
  const demo = useDemo();
  const demoMode = isDemoMode();
  const [templates, setTemplates] = useState<EmailTemplate[]>(
    demoMode ? demo.templates : []
  );
  const [sequences, setSequences] = useState<SequenceOption[]>(
    demoMode ? demo.sequences : []
  );

  useEffect(() => {
    if (demoMode) {
      setTemplates(demo.templates);
      setSequences(demo.sequences);
      return;
    }

    let cancelled = false;

    async function loadSalesAssets() {
      try {
        const [templatesRes, sequencesRes] = await Promise.all([
          fetch("/api/templates"),
          fetch("/api/sequences"),
        ]);
        const templatesData = await templatesRes.json();
        const sequencesData = await sequencesRes.json();
        if (cancelled) return;
        if (templatesRes.ok && Array.isArray(templatesData)) {
          setTemplates(templatesData);
        }
        if (sequencesRes.ok && Array.isArray(sequencesData)) {
          setSequences(sequencesData);
        }
      } catch {
        /* behold tom liste — sending fungerer fortsatt med manuell tekst */
      }
    }

    loadSalesAssets();
    return () => {
      cancelled = true;
    };
  }, [demoMode, demo.templates, demo.sequences]);

  useEffect(() => {
    const hasAnyFilter =
      searchParams.has("omrade") ||
      searchParams.has("kommune") ||
      searchParams.has("dager") ||
      searchParams.has("epost") ||
      searchParams.has("generisk");
    if (hasAnyFilter) return;

    const params = new URLSearchParams();
    params.set("omrade", DEFAULT_MARKET_FILTERS.regionId);
    params.set("kommune", DEFAULT_MARKET_FILTERS.municipalityCode);
    params.set("dager", String(DEFAULT_MARKET_FILTERS.days));
    params.set("epost", DEFAULT_MARKET_FILTERS.hasEmail ? "1" : "0");
    params.set("generisk", DEFAULT_MARKET_FILTERS.genericEmailOnly ? "1" : "0");
    router.replace(`/app?${params.toString()}`);
  }, [searchParams, router]);

  const [companies, setCompanies] = useState<CompanyWithLead[]>([]);
  const [total, setTotal] = useState(0);
  const [withEmail, setWithEmail] = useState(0);
  const [municipalities, setMunicipalities] = useState(DEMO_MUNICIPALITIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [brregTotal, setBrregTotal] = useState<number | null>(null);
  const [companiesSource, setCompaniesSource] = useState<"db" | "brreg">("brreg");
  const [dbCompanyCount, setDbCompanyCount] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [contactUsage, setContactUsage] = useState<{
    used: number;
    limit: number;
    remaining: number;
    limitReached: boolean;
  } | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const loadGenRef = useRef(0);

  const loadCompanies = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    setLoading(true);
    setError(null);
    setSlowLoad(false);
    const query = buildCompaniesQuery(filters, currentPage);

    try {
      const res = await fetch(`/api/companies?${query}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (gen !== loadGenRef.current) return;
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente firma");

      setCompanies(data.companies ?? []);
      setTotal(data.total ?? 0);
      setWithEmail(data.withEmail ?? 0);
      setFetchedAt(data.fetchedAt ?? null);
      setBrregTotal(data.brregTotal ?? null);
      setCompaniesSource(data.source === "db" ? "db" : "brreg");
      setDbCompanyCount(
        typeof data.dbCompanyCount === "number" ? data.dbCompanyCount : null
      );
      setTruncated(Boolean(data.truncated));
      setPagination({
        page: data.page ?? currentPage,
        pageSize: data.pageSize ?? 100,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        hasNext: Boolean(data.hasNext),
        hasPrev: Boolean(data.hasPrev),
      });
      setContactUsage(data.contactUsage ?? null);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      if (err instanceof Error && err.name === "AbortError") {
        setError(
          "Henting tok for lang tid. Prøv igjen, eller velg kortere periode (ikke «alle firma»)."
        );
      } else {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      }
      setCompanies([]);
      setTotal(0);
      setWithEmail(0);
      setBrregTotal(null);
      setCompaniesSource("brreg");
      setDbCompanyCount(null);
      setTruncated(false);
      setPagination({
        page: currentPage,
        pageSize: 100,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: currentPage > 1,
      });
      setContactUsage(null);
    } finally {
      clearTimeout(timeout);
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [
    filters.regionId,
    filters.municipalityCode,
    filters.days,
    filters.hasEmail,
    filters.genericEmailOnly,
    filters.industryGroup,
    filters.professionId,
    currentPage,
  ]);

  function goToPage(page: number) {
    const params = new URLSearchParams(buildCompaniesQuery(filters, page));
    router.push(`/app?${params.toString()}`);
  }

  useEffect(() => {
    loadCompanies();
    return () => {
      loadGenRef.current += 1;
    };
  }, [loadCompanies]);

  useEffect(() => {
    if (!loading) {
      setSlowLoad(false);
      return;
    }
    const t = setTimeout(() => setSlowLoad(true), 8_000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    fetch("/api/kommuner")
      .then((r) => r.json())
      .then((data) => {
        if (data.municipalities?.length) {
          setMunicipalities(data.municipalities);
        }
      })
      .catch(() => {
        /* behold demo-kommuner som fallback */
      });
  }, []);

  if (loading && companies.length === 0) {
    const loadSubtitle = filters.municipalityCode
      ? `Kommune ${filters.municipalityCode} · ${periodLabel(filters.days)}`
      : filters.regionId
        ? `${regionLabel(filters.regionId)} · ${periodLabel(filters.days)}`
        : `Hele Norge · ${periodLabel(filters.days)}`;

    return (
      <>
        <ScanFetchLoading
          subtitle={loadSubtitle}
          slowLoad={slowLoad}
          onRetry={slowLoad ? loadCompanies : undefined}
        />
        {filters.days === 0 && (
          <p className="scan-glass-kommand px-3 text-[11px] text-amber-200">
            {filters.municipalityCode || filters.regionId
              ? "«Alle firma» kan ta litt tid — mange sider fra Brønnøysund"
              : "Tips: velg område eller kommune — ellers blir det veldig mange firma"}
          </p>
        )}
      </>
    );
  }

  if (error && companies.length === 0) {
    return (
      <div className="scan-glass-kommand px-2 sm:px-3">
        <div className="scan-surface-pad text-center">
          <p className="font-semibold text-red-300">{error}</p>
          <button
            type="button"
            onClick={loadCompanies}
            className="scan-btn-primary mt-4 inline-flex gap-2 px-4 py-2"
          >
            <RefreshCw className="h-4 w-4" />
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-glass-kommand w-full max-w-none space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-3">
        <span
          className={`scan-glass-source-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            companiesSource === "db" ? "" : "is-live"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              companiesSource === "db" ? "bg-sky-400" : "bg-emerald-400"
            }`}
          />
          {companiesSource === "db"
            ? `Fra database${
                dbCompanyCount != null
                  ? ` (${dbCompanyCount.toLocaleString("nb-NO")} firma totalt)`
                  : ""
              }`
            : "Live fra Brønnøysund"}
          {fetchedAt && (
            <span className="opacity-70">
              · {new Date(fetchedAt).toLocaleTimeString("nb-NO")}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={loadCompanies}
          disabled={loading}
          className="scan-glass-toolbar-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Oppdater liste
        </button>
      </div>

      {contactUsage && (
        <p
          className={`scan-surface-pad mx-2 text-center text-xs sm:mx-3 ${
            contactUsage.limitReached ? "text-amber-200" : "scan-glass-muted"
          }`}
        >
          {contactUsage.used} av {contactUsage.limit} bedrifter med tlf/e-post brukt denne
          måneden
          {contactUsage.limitReached ? (
            <>
              {" "}
              — grensen er nådd.{" "}
              <a href="/app/abonnement" className="font-semibold underline">
                Se abonnement
              </a>{" "}
              for mer.
            </>
          ) : (
            <> ({contactUsage.remaining} igjen)</>
          )}
        </p>
      )}

      <AppPageClient
        companies={companies}
        total={total}
        withEmail={withEmail}
        municipalities={municipalities}
        initialFilters={filters}
        templates={templates}
        sequences={sequences}
        dataSource="brreg"
        companiesSource={companiesSource}
        brregTotal={brregTotal}
        dbCompanyCount={dbCompanyCount}
        allTime={filters.days === 0}
        pagination={{ ...pagination, truncated }}
        onPageChange={goToPage}
      />
    </div>
  );
}

function FirmaPageInner() {
  if (isBrregLive()) {
    return <FirmaPageBrreg />;
  }
  return <FirmaPageDemo />;
}

export default function FirmaPage() {
  return (
    <Suspense
      fallback={
        <ScanFetchLoading subtitle="Forbereder søk…" title="Laster Skann…" />
      }
    >
      <FirmaPageInner />
    </Suspense>
  );
}
