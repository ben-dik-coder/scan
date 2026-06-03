"use client";

import { useEffect, useState } from "react";
import { INDUSTRY_GROUPS } from "@/lib/constants/industries";
import { professionSearchLabel } from "@/lib/constants/professions";
import { kommuneBelongsToRegion, REGIONS } from "@/lib/constants/regions";
import { WEBBYRA_MARKET_PRESET } from "@/lib/constants/market";
import {
  Briefcase,
  Calendar,
  Globe,
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
  /** Fritekst yrke, f.eks. «rørlegger» */
  professionSearch: string;
  websitePresence: WebsitePresenceFilter;
  facebookPresence: SocialPresenceFilter;
  instagramPresence: SocialPresenceFilter;
};

type Props = {
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
};

export function CompanyFilters({ filters, municipalities, onChange }: Props) {
  const [professionDraft, setProfessionDraft] = useState(filters.professionSearch);
  const matchedProfession = professionSearchLabel(professionDraft);

  useEffect(() => {
    setProfessionDraft(filters.professionSearch);
  }, [filters.professionSearch]);

  useEffect(() => {
    const trimmed = professionDraft.trim();
    if (trimmed === filters.professionSearch.trim()) return;

    const timer = window.setTimeout(() => {
      onChange({ ...filters, professionSearch: trimmed });
    }, 400);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce kun på utkast
  }, [professionDraft]);

  const kommunerInRegion = filters.regionId
    ? municipalities.filter((m) => kommuneBelongsToRegion(m.code, filters.regionId))
    : municipalities;

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="border-t border-slate-100 pt-2">
        <label className="flex flex-col gap-0.5">
          <span className="scan-label">
            <Briefcase className="h-3.5 w-3.5 text-brand-gold" />
            Søk yrke
          </span>
          <input
            type="search"
            value={professionDraft}
            onChange={(e) => setProfessionDraft(e.target.value)}
            placeholder="F.eks. rørlegger, frisør, elektriker…"
            className="scan-input"
            autoComplete="off"
            spellCheck={false}
          />
          {professionDraft.trim().length >= 2 && (
            <span className="text-[10px] text-slate-500">
              {matchedProfession
                ? `Finner: ${matchedProfession}`
                : "Søker i navn og bransje — prøv et annet ord hvis du får lite treff"}
            </span>
          )}
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
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

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Etter Google-sjekk
        </span>
        <label className="flex flex-col gap-0.5 min-w-[7rem]">
          <span className="scan-label">
            <Globe className="h-3.5 w-3.5 text-brand-gold" />
            Nettside
          </span>
          <select
            value={filters.websitePresence}
            onChange={(e) =>
              onChange({
                ...filters,
                websitePresence: e.target.value as WebsitePresenceFilter,
              })
            }
            className="scan-input"
          >
            <option value="all">Alle</option>
            <option value="with">Kun med nettside</option>
            <option value="without">Kun uten nettside</option>
            <option value="not_scanned">Ikke sjekket</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 min-w-[7rem]">
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
        <label className="flex flex-col gap-0.5 min-w-[7rem]">
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
    </div>
  );
}
