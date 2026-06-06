"use client";

import { useState } from "react";
import { INDUSTRY_GROUPS } from "@/lib/constants/industries";
import { PROFESSION_OPTIONS } from "@/lib/constants/professions";
import { kommuneBelongsToRegion, REGIONS } from "@/lib/constants/regions";
import { WEBBYRA_MARKET_PRESET } from "@/lib/constants/market";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  Layout,
  Mail,
  MapPin,
  MapPinned,
  Scissors,
} from "lucide-react";

export type WebsitePresenceFilter = "all" | "with" | "without" | "not_scanned";
export type SocialPresenceFilter = "all" | "with" | "without";

export type FilterState = {
  regionId: string;
  municipalityCode: string;
  days: number;
  hasEmail: boolean;
  genericEmailOnly: boolean;
  industryGroup: string;
  /** Konkret yrke-id fra dropdown (tom = alle yrker) */
  professionId: string;
  websitePresence: WebsitePresenceFilter;
  facebookPresence: SocialPresenceFilter;
  instagramPresence: SocialPresenceFilter;
};

type Props = {
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
  /** sidebar = desktop-panel, mobile-bar = alltid synlig på mobil, stack = full rad */
  layout?: "stack" | "sidebar" | "mobile-bar";
};

export function CompanyFilters({
  filters,
  municipalities,
  onChange,
  layout = "stack",
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isSidebar = layout === "sidebar";
  const isMobileBar = layout === "mobile-bar";
  const gridClass = isSidebar
    ? "flex flex-col gap-2"
    : isMobileBar
      ? "grid gap-2 sm:grid-cols-2"
      : "grid gap-2 sm:grid-cols-2 lg:grid-cols-4";

  const kommunerInRegion = filters.regionId
    ? municipalities.filter((m) => kommuneBelongsToRegion(m.code, filters.regionId))
    : municipalities;

  const regionField = (
    <label className="flex flex-col gap-0.5">
      <span className="scan-label">
        <MapPin className="h-3.5 w-3.5 text-brand-gold" />
        Område
      </span>
      <select
        value={filters.regionId}
        onChange={(e) =>
          onChange({
            ...filters,
            regionId: e.target.value,
            municipalityCode: "",
          })
        }
        className="scan-input"
      >
        {REGIONS.map((r) => (
          <option key={r.id || "alle"} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );

  const municipalityField = (
    <label className="flex flex-col gap-0.5">
      <span className="scan-label">
        <MapPinned className="h-3.5 w-3.5 text-brand-gold" />
        Kommune
      </span>
      <select
        value={filters.municipalityCode}
        onChange={(e) => onChange({ ...filters, municipalityCode: e.target.value })}
        className="scan-input"
      >
        <option value="">
          {filters.regionId ? "Alle i området" : "Alle kommuner"}
        </option>
        {kommunerInRegion.map((m) => (
          <option key={m.code} value={m.code}>
            {m.name}
            {m.count > 0 ? ` (${m.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const professionField = (
    <label className={`flex flex-col gap-0.5 ${isMobileBar ? "sm:col-span-2" : ""}`}>
      <span className="scan-label">
        <Briefcase className="h-3.5 w-3.5 text-brand-gold" />
        Yrke
      </span>
      <select
        value={filters.professionId}
        onChange={(e) => onChange({ ...filters, professionId: e.target.value })}
        className="scan-input"
      >
        <option value="">Alle yrker</option>
        {PROFESSION_OPTIONS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );

  if (isMobileBar) {
    return (
      <div className={gridClass}>
        {regionField}
        {municipalityField}
        {professionField}
      </div>
    );
  }

  const hasAdvancedSocial =
    filters.facebookPresence !== "all" || filters.instagramPresence !== "all";

  return (
    <div className="space-y-2">
      <div className={gridClass}>
        {regionField}
        {municipalityField}

        <label className="flex flex-col gap-0.5">
          <span className="scan-label">
            <Scissors className="h-3.5 w-3.5 text-brand-gold" />
            Bransje
          </span>
          <select
            value={filters.industryGroup}
            onChange={(e) => onChange({ ...filters, industryGroup: e.target.value })}
            className="scan-input"
          >
            {INDUSTRY_GROUPS.map((g) => (
              <option key={g.id || "alle"} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="scan-label">
            <Calendar className="h-3.5 w-3.5 text-brand-gold" />
            Periode
          </span>
          <select
            value={filters.days}
            onChange={(e) => onChange({ ...filters, days: Number(e.target.value) })}
            className="scan-input"
          >
            <option value={7}>Siste 7 dager</option>
            <option value={30}>Siste 30 dager</option>
            <option value={90}>Siste 90 dager</option>
            <option value={0}>Alle firma</option>
          </select>
        </label>
      </div>

      <div className={isSidebar ? "pt-1" : "scan-glass-divider border-t pt-2"}>
        {professionField}
      </div>

      <div
        className={
          isSidebar
            ? "flex flex-col gap-1.5 pt-1"
            : "scan-glass-divider flex flex-wrap gap-1.5 border-t pt-2"
        }
      >
        <span className="scan-glass-muted w-full text-[10px] font-semibold uppercase tracking-wide">
          Bransje-presets
        </span>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              industryGroup:
                filters.industryGroup === WEBBYRA_MARKET_PRESET.industryGroup
                  ? ""
                  : WEBBYRA_MARKET_PRESET.industryGroup,
              days:
                filters.industryGroup === WEBBYRA_MARKET_PRESET.industryGroup
                  ? filters.days
                  : WEBBYRA_MARKET_PRESET.days,
            })
          }
          className={`scan-chip cursor-pointer ${
            filters.industryGroup === WEBBYRA_MARKET_PRESET.industryGroup
              ? "scan-chip-active"
              : ""
          }`}
        >
          <Layout className="h-3.5 w-3.5" />
          Selger nettsider (Brreg)
        </button>
      </div>

      <div
        className={
          isSidebar
            ? "flex flex-wrap gap-1.5 pt-1"
            : "scan-glass-divider flex flex-wrap gap-1.5 border-t pt-2"
        }
      >
        <label
          className={`scan-chip cursor-pointer ${filters.hasEmail ? "scan-chip-active" : ""}`}
        >
          <input
            type="checkbox"
            checked={filters.hasEmail}
            onChange={(e) => onChange({ ...filters, hasEmail: e.target.checked })}
            className="sr-only"
          />
          <Mail className="h-3.5 w-3.5" />
          Kun med e-post
        </label>
        <label
          className={`scan-chip cursor-pointer ${filters.genericEmailOnly ? "scan-chip-active" : ""}`}
        >
          <input
            type="checkbox"
            checked={filters.genericEmailOnly}
            onChange={(e) => {
              const genericEmailOnly = e.target.checked;
              onChange({
                ...filters,
                genericEmailOnly,
                hasEmail: genericEmailOnly ? true : filters.hasEmail,
              });
            }}
            className="sr-only"
          />
          <Mail className="h-3.5 w-3.5" />
          Kun post@ / info@
        </label>
      </div>

      <details
        className={isSidebar ? "pt-1" : "scan-glass-divider border-t pt-2"}
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="scan-glass-muted flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold uppercase tracking-wide [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${advancedOpen ? "rotate-180" : ""}`}
          />
          Avansert etter Google-sjekk
          {hasAdvancedSocial && (
            <span className="rounded-full bg-sky-400/20 px-1.5 text-[9px] font-bold normal-case text-sky-200">
              aktiv
            </span>
          )}
        </summary>
        <p className="scan-glass-muted mt-1 text-[10px] leading-snug">
          Nettside-status velger du med fanene under listen (Alle / Uten web / Med web).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex min-w-[7rem] flex-col gap-0.5">
            <span className="scan-label">Facebook</span>
            <select
              value={filters.facebookPresence}
              onChange={(e) =>
                onChange({
                  ...filters,
                  facebookPresence: e.target.value as SocialPresenceFilter,
                })
              }
              className="scan-input"
            >
              <option value="all">Alle</option>
              <option value="with">Kun med Facebook</option>
              <option value="without">Kun uten Facebook</option>
            </select>
          </label>
          <label className="flex min-w-[7rem] flex-col gap-0.5">
            <span className="scan-label">Instagram</span>
            <select
              value={filters.instagramPresence}
              onChange={(e) =>
                onChange({
                  ...filters,
                  instagramPresence: e.target.value as SocialPresenceFilter,
                })
              }
              className="scan-input"
            >
              <option value="all">Alle</option>
              <option value="with">Kun med Instagram</option>
              <option value="without">Kun uten Instagram</option>
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}
