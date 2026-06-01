"use client";

import { AppPageClient } from "@/components/AppPageClient";
import { DEMO_MUNICIPALITIES } from "@/lib/demo/data";
import { isBrregLive } from "@/lib/demo/config";
import { filterDemoCompanies, useDemo } from "@/lib/demo/store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { FilterState } from "@/components/CompanyFilters";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { regionLabel } from "@/lib/constants/regions";
import { Loader2, RefreshCw } from "lucide-react";

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
  const hasGeneriskParam = params.has("generisk");
  const hasAnyFilter =
    params.has("omrade") ||
    params.has("kommune") ||
    params.has("dager") ||
    params.has("epost") ||
    params.has("generisk") ||
    params.has("bransje");

  if (brreg && !hasAnyFilter) {
    return { ...DEFAULT_MARKET_FILTERS, industryGroup: "" };
  }

  return {
    regionId: params.get("omrade") ?? (brreg ? DEFAULT_MARKET_FILTERS.regionId : ""),
    municipalityCode:
      params.get("kommune") ?? (brreg ? DEFAULT_MARKET_FILTERS.municipalityCode : ""),
    days: parseDaysParam(params),
    hasEmail: params.get("epost") !== "0",
    genericEmailOnly: hasGeneriskParam
      ? params.get("generisk") === "1"
      : false,
    industryGroup: params.get("bransje") ?? "",
  };
}

function buildCompaniesQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.regionId) params.set("omrade", filters.regionId);
  else params.delete("omrade");
  if (filters.municipalityCode) params.set("kommune", filters.municipalityCode);
  params.set("dager", String(filters.days));
  params.set("epost", filters.hasEmail ? "1" : "0");
  params.set("generisk", filters.genericEmailOnly ? "1" : "0");
  if (filters.industryGroup) params.set("bransje", filters.industryGroup);
  else params.delete("bransje");
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
  });

  return (
    <AppPageClient
      companies={filtered}
      total={filtered.length}
      withEmail={filtered.filter((c) => c.has_email).length}
      municipalities={DEMO_MUNICIPALITIES}
      initialFilters={filters}
      templates={templates}
      sequences={sequences}
      dataSource="demo"
    />
  );
}

function FirmaPageBrreg() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams, true);
  const { templates, sequences } = useDemo();

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
    params.set("epost", "1");
    params.set("generisk", "1");
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
  const [truncated, setTruncated] = useState(false);
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
    const query = buildCompaniesQuery(filters);

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
      setTruncated(Boolean(data.truncated));
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
      setTruncated(false);
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
  ]);

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
    return (
      <div className="glass flex flex-col items-center justify-center gap-4 py-24 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
        <p className="text-sm font-semibold text-slate-800">
          Henter firma fra Brønnøysund…
        </p>
        <p className="text-xs text-slate-500">
          {filters.municipalityCode
            ? `Kommune ${filters.municipalityCode} · ${periodLabel(filters.days)}`
            : filters.regionId
              ? `${regionLabel(filters.regionId)} · ${periodLabel(filters.days)}`
              : `Hele Norge · ${periodLabel(filters.days)}`}
        </p>
        {filters.days === 0 && (
          <p className="max-w-xs text-center text-xs text-amber-800/90">
            {filters.municipalityCode || filters.regionId
              ? "«Alle firma» kan ta litt tid — mange sider fra Brønnøysund"
              : "Tips: velg område eller kommune — ellers blir det veldig mange firma"}
          </p>
        )}
        {slowLoad && (
          <p className="max-w-sm text-center text-xs text-slate-500">
            Tar litt tid… Brønnøysund har mange firma å sjekke.
          </p>
        )}
        {slowLoad && (
          <button
            type="button"
            onClick={loadCompanies}
            className="scan-btn-ghost mt-2"
          >
            <RefreshCw className="h-3 w-3" />
            Prøv igjen
          </button>
        )}
      </div>
    );
  }

  if (error && companies.length === 0) {
    return (
      <div className="glass border-red-200/80 p-6 text-center">
        <p className="font-semibold text-red-700">{error}</p>
        <button
          type="button"
          onClick={loadCompanies}
          className="btn-primary mt-4 inline-flex gap-2 text-xs"
        >
          <RefreshCw className="h-4 w-4" />
          Prøv igjen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live fra Brønnøysund
          {fetchedAt && (
            <span className="text-emerald-200/60">
              · {new Date(fetchedAt).toLocaleTimeString("nb-NO")}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={loadCompanies}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Oppdater liste
        </button>
      </div>

      {contactUsage && (
        <p
          className={`app-card px-4 py-3 text-center text-xs ${
            contactUsage.limitReached ? "text-amber-800" : "text-slate-600"
          }`}
        >
          {contactUsage.used} av {contactUsage.limit} bedrifter med tlf/e-post brukt denne
          måneden
          {contactUsage.limitReached ? (
            <>
              {" "}
              — grensen er nådd.{" "}
              <a href="/app/abonnement" className="font-semibold underline">
                Oppgrader til Pro
              </a>{" "}
              for flere.
            </>
          ) : (
            <> ({contactUsage.remaining} igjen)</>
          )}
        </p>
      )}

      {truncated && brregTotal != null && (
        <p className="app-card px-4 py-3 text-center text-xs text-amber-800">
          Viser {total.toLocaleString("nb-NO")} av {brregTotal.toLocaleString("nb-NO")} i
          Brønnøysund. Velg smalere filter for flere treff.
        </p>
      )}

      <AppPageClient
        companies={companies}
        total={total}
        withEmail={withEmail}
        municipalities={municipalities}
        initialFilters={filters}
        templates={templates as EmailTemplate[]}
        sequences={sequences}
        dataSource="brreg"
        brregTotal={brregTotal}
        allTime={filters.days === 0}
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
    <Suspense fallback={<p className="text-white/60">Laster firma…</p>}>
      <FirmaPageInner />
    </Suspense>
  );
}
