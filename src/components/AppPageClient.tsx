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
import { WorkflowSteps } from "@/components/WorkflowSteps";
import { useAutoWebsiteScan } from "@/hooks/useAutoWebsiteScan";
import { regionLabel } from "@/lib/constants/regions";
import { industryGroupLabel } from "@/lib/constants/industries";
import type { CompanyWithLead, EmailTemplate } from "@/types/database";
import { useDemo } from "@/lib/demo/store";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  Building2,
  Globe,
  Globe2,
  List,
  Mail,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";

type SequenceOption = {
  id: string;
  name: string;
  steps: unknown[];
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
  brregTotal?: number | null;
  allTime?: boolean;
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
  } = useAutoWebsiteScan(companies, { autoScan: false });

  const [scanSelectionMessage, setScanSelectionMessage] = useState<string | null>(
    null
  );

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

  const displayCompanies = useMemo(() => {
    if (listFilter === "all") return companies;
    if (listFilter === "no_website") {
      return companies.filter((c) => isLeadWithoutOwnSite(c.orgnr));
    }
    if (listFilter === "with_website") {
      return companies.filter((c) => websiteScans.get(c.orgnr)?.hasWebsite === true);
    }
    return companies.filter((c) => c.has_email && !websiteScans.has(c.orgnr));
  }, [companies, listFilter, websiteScans]);

  function applyFilters(next: FilterState) {
    if (
      next.industryGroup &&
      next.industryGroup !== filters.industryGroup &&
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
    setSelected(new Set());
    setListFilter("all");
    router.push(`/app?${params.toString()}`);
  }

  const selectable = useMemo(
    () => displayCompanies.filter((c) => c.has_email),
    [displayCompanies]
  );

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
  const selectedWithEmail = selectedCompanies.filter((c) => c.has_email);

  function scanSelectedWithGoogle() {
    setScanSelectionMessage(null);
    const result = scanCompanies(selectedCompanies);
    if (!result.ok) {
      setScanSelectionMessage(result.message);
      return;
    }
    if (result.skipped > 0) {
      setScanSelectionMessage(
        `Sjekker ${result.scanned} nå — maks 10 per gang. Huk av resten og kjør igjen.`
      );
    }
  }

  const activeStep: 1 | 2 | 3 | 4 = (() => {
    if (selected.size > 0) return 4;
    if (scanComplete && noWebsiteCount > 0) return 3;
    if (scanning || scanComplete) return 2;
    return 1;
  })();

  const filterSummary = [
    filters.regionId ? regionLabel(filters.regionId) : null,
    filters.industryGroup ? industryGroupLabel(filters.industryGroup) : null,
    filters.days === 0 ? "Alle firma" : `Siste ${filters.days} dager`,
  ]
    .filter(Boolean)
    .join(" · ");

  const listTabs = [
    { id: "all" as const, label: "Alle", count: companies.length, icon: List },
    { id: "no_website" as const, label: "Uten nettside", count: noWebsiteCount, icon: Globe },
    { id: "with_website" as const, label: "Med nettside", count: withWebsiteCount, icon: Globe2 },
    { id: "not_scanned" as const, label: "Ikke sjekket", count: notScannedCount, icon: Radar },
  ];

  return (
    <div className="space-y-8 pb-8">
      <header className="glass p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
              <Sparkles className="h-4 w-4 text-brand-gold" />
              Finn nye kunder
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Skann markedet
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
              Huk av firma du vil sjekke → trykk <strong>Google-sjekk</strong> (maks 10 om
              gangen) → send til de uten nettside.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="scan-chip">
              <Building2 className="h-3.5 w-3.5 text-brand-gold" />
              {companies.length} firma
            </span>
            <span className="scan-chip">
              <Mail className="h-3.5 w-3.5 text-brand-gold" />
              {withEmailCount} med e-post
            </span>
            {noWebsiteCount > 0 && (
              <span className="scan-chip border-amber-200/80 bg-amber-50/70 text-amber-900">
                <Globe className="h-3.5 w-3.5" />
                {noWebsiteCount} uten nettside
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="app-card p-5 sm:p-6">
        <WorkflowSteps
          activeStep={activeStep}
          selectedCount={selected.size}
          scanning={scanning}
          scanComplete={scanComplete}
          noWebsiteCount={noWebsiteCount}
        />
        <div className="my-6 border-t border-white/50" />
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Search className="h-4 w-4 text-brand-gold" />
          Søk i Brønnøysund
          {filterSummary && (
            <span className="font-normal text-slate-400">— {filterSummary}</span>
          )}
        </div>
        <CompanyFilters
          filters={filters}
          municipalities={props.municipalities}
          onChange={applyFilters}
        />
      </section>

      {props.brregTotal != null &&
        props.brregTotal > props.total + 2 &&
        props.dataSource === "brreg" && (
          <div className="glass-subtle flex gap-3 border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
            <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p>
              Du ser <strong>{props.total}</strong> av <strong>{props.brregTotal}</strong> i
              Brønnøysund
              {filters.industryGroup
                ? ` (${industryGroupLabel(filters.industryGroup).toLowerCase()})`
                : ""}
              . For flere treff: velg <strong>Alle firma</strong> under periode, og slå av{" "}
              <strong>Kun post@ / info@</strong> hvis den er på.
            </p>
          </div>
        )}

      <section className="glass border-sky-200/50 bg-gradient-to-br from-sky-50/80 to-white/60 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Google-sjekk</h2>
              <p className="mt-1 max-w-lg text-sm text-slate-600">
                1. Huk av firma i listen under · 2. Trykk knappen her · 3. Se hvem som mangler
                nettside (maks 10 per gang)
              </p>
              {selected.size > 0 && (
                <p className="mt-2 text-sm font-medium text-brand-navy">
                  {selected.size} valgt
                  {selectedWithEmail.length < selected.size &&
                    ` (${selected.size - selectedWithEmail.length} uten e-post kan ikke sjekkes)`}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={scanSelectedWithGoogle}
            disabled={scanning || selectedWithEmail.length === 0}
            className={cn(
              "inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition",
              selectedWithEmail.length > 0 && !scanning
                ? "bg-sky-600 text-white hover:bg-sky-700"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            )}
          >
            <Search className="h-5 w-5" />
            {scanning
              ? "Google søker…"
              : selectedWithEmail.length > 0
                ? `Start Google-sjekk (${Math.min(selectedWithEmail.length, 10)})`
                : "Huk av firma først"}
          </button>
        </div>
        {scanSelectionMessage && (
          <p className="mt-3 text-sm text-amber-800">{scanSelectionMessage}</p>
        )}
        {websiteScans.size === 0 && !scanning && selected.size === 0 && (
          <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-slate-600">
            Kolonnen <strong>Nett</strong> viser hvor dårlig nettsiden er: <strong>0</strong> = ingen
            nettside, høyere tall = verre. «—» betyr ikke skannet ennå. Uten SerpAPI-nøkkel er sjekken
            enklere (via e-post-domene).
          </p>
        )}
      </section>

      <WebsiteScanStatus
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
        listFilter={listFilter}
        totalWithEmail={withEmailCount}
        notScannedCount={notScannedCount}
        onRescan={rescan}
        scanResults={websiteScans}
      />

      <section className="glass overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/50 bg-white/30 px-4 py-4 backdrop-blur-md sm:px-5">
          <div className="flex flex-wrap gap-1.5">
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
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                  <span
                    className={cn(
                      "ml-0.5 tabular-nums text-xs",
                      listFilter === tab.id ? "text-slate-500" : "text-slate-400"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Viser <strong className="text-slate-800">{displayCompanies.length}</strong> av{" "}
              {companies.length}
              {props.brregTotal != null && props.brregTotal > props.total && (
                <span> · {props.brregTotal.toLocaleString("nb-NO")} i Brønnøysund</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={toggleAll} className="scan-btn-ghost">
                {allSelected ? "Fjern valg" : "Velg synlige"}
              </button>
              {withEmailCount > 0 && (
                <button type="button" onClick={selectAllWithEmail} className="scan-btn-ghost">
                  Velg alle med e-post
                </button>
              )}
              {scanComplete && noWebsiteCount > 0 && (
                <button type="button" onClick={selectNoWebsite} className="scan-btn-ghost">
                  Velg uten nettside ({noWebsiteCount})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <CompanyTable
            light
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
        </div>
      </section>

      {selected.size > 0 && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-center gap-3 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-lg backdrop-blur-xl lg:bottom-4">
          <span className="text-sm font-semibold text-brand-navy">
            {selected.size} valgt
          </span>
          {selectedWithEmail.length > 0 && (
            <button
              type="button"
              onClick={scanSelectedWithGoogle}
              disabled={scanning}
              className="scan-btn-primary text-sm disabled:opacity-50"
            >
              Google-sjekk
            </button>
          )}
          <span className="hidden text-xs text-slate-400 sm:inline">
            Scroll ned for å sende e-post
          </span>
        </div>
      )}

      <div className="app-card p-5 sm:p-6">
        <SendCampaignForm
          selectedCompanies={selectedCompanies}
          templates={props.templates}
          sequences={props.sequences}
          onSent={() => setSelected(new Set())}
          light
        />
      </div>

      <details className="app-card p-4 text-sm text-slate-600 lg:hidden">
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
