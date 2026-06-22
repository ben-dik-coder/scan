"use client";

import {
  CompanyFilters,
  type FilterState,
} from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { parseProfessionIdFromParam, professionLabel } from "@/lib/constants/professions";
import { naceCodeLabel } from "@/lib/constants/nace-codes";
import { regionLabel } from "@/lib/constants/regions";

function toFilterState(
  partial: Partial<FilterState> & { professionSearch?: string }
): FilterState {
  const professionId =
    partial.professionId ??
    (partial.professionSearch?.trim()
      ? parseProfessionIdFromParam(partial.professionSearch)
      : "");

  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: partial.days ?? DEFAULT_MARKET_FILTERS.days,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionId,
    naceCode: partial.naceCode ?? "",
    nameQuery: partial.nameQuery ?? "",
    websitePresence: partial.websitePresence ?? "all",
    facebookPresence: partial.facebookPresence ?? "all",
    instagramPresence: partial.instagramPresence ?? "all",
  };
}

export function formatWeeklyAlertSummary(filters: Partial<FilterState>): string {
  const parts: string[] = [];
  if (filters.regionId) parts.push(regionLabel(filters.regionId));
  if (filters.municipalityCode) parts.push(`kommune ${filters.municipalityCode}`);
  const professionId =
    filters.professionId ??
    ((filters as { professionSearch?: string }).professionSearch?.trim()
      ? parseProfessionIdFromParam((filters as { professionSearch?: string }).professionSearch!)
      : "");
  if (professionId) {
    parts.push(professionLabel(professionId) ?? professionId);
  }
  if (filters.naceCode) {
    const label = naceCodeLabel(filters.naceCode);
    parts.push(label ? `NACE ${filters.naceCode}` : filters.naceCode);
  }
  if (filters.days != null) {
    parts.push(filters.days === 0 ? "alle firma" : `siste ${filters.days} dager`);
  }
  if (filters.hasEmail) parts.push("kun med e-post");
  if (filters.nameQuery?.trim()) parts.push(`navn: ${filters.nameQuery.trim()}`);
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
            professionId: next.professionId,
            nameQuery: next.nameQuery,
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
