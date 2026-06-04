"use client";

import {
  CompanyFilters,
  type FilterState,
} from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { regionLabel } from "@/lib/constants/regions";

function toFilterState(partial: Partial<FilterState>): FilterState {
  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: partial.days ?? DEFAULT_MARKET_FILTERS.days,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionSearch: partial.professionSearch ?? "",
    websitePresence: partial.websitePresence ?? "all",
    facebookPresence: partial.facebookPresence ?? "all",
    instagramPresence: partial.instagramPresence ?? "all",
  };
}

export function formatWeeklyAlertSummary(filters: Partial<FilterState>): string {
  const parts: string[] = [];
  if (filters.regionId) parts.push(regionLabel(filters.regionId));
  if (filters.municipalityCode) parts.push(`kommune ${filters.municipalityCode}`);
  if (filters.professionSearch?.trim()) parts.push(`yrke: ${filters.professionSearch.trim()}`);
  if (filters.days != null) {
    parts.push(filters.days === 0 ? "alle firma" : `siste ${filters.days} dager`);
  }
  if (filters.hasEmail) parts.push("kun med e-post");
  return parts.length > 0 ? parts.join(" · ") : "Hele Norge (standard)";
}

type Props = {
  filters: Partial<FilterState>;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: Partial<FilterState>) => void;
};

export function WeeklyAlertFilters({ filters, municipalities, onChange }: Props) {
  const full = toFilterState(filters);

  return (
    <div className="space-y-2">
      <CompanyFilters
        layout="mobile-bar"
        filters={full}
        municipalities={municipalities}
        onChange={(next) =>
          onChange({
            regionId: next.regionId,
            municipalityCode: next.municipalityCode,
            days: next.days,
            professionSearch: next.professionSearch,
            hasEmail: next.hasEmail,
            industryGroup: next.industryGroup,
          })
        }
      />
      <p className="scan-glass-muted text-[11px]">
        Varsel bruker: {formatWeeklyAlertSummary(filters)}
      </p>
    </div>
  );
}
