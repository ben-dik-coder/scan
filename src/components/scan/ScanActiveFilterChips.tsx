"use client";

import type { FilterState } from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { industryGroupLabel } from "@/lib/constants/industries";
import { professionLabel } from "@/lib/constants/professions";
import { naceCodeLabel } from "@/lib/constants/nace-codes";
import { regionLabel } from "@/lib/constants/regions";

type Props = {
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
  variant?: "default" | "inline";
};

function buildSummaryParts(
  filters: FilterState,
  municipalities: Array<{ code: string; name: string; count: number }>
): string[] {
  const parts: string[] = [];
  const def = DEFAULT_MARKET_FILTERS;

  if (filters.regionId && filters.regionId !== def.regionId) {
    parts.push(regionLabel(filters.regionId));
  } else if (filters.municipalityCode) {
    const name =
      municipalities.find((m) => m.code === filters.municipalityCode)?.name ??
      filters.municipalityCode;
    parts.push(name);
  }

  if (filters.industryGroup) {
    parts.push(industryGroupLabel(filters.industryGroup));
  }

  if (filters.professionId) {
    parts.push(professionLabel(filters.professionId) ?? filters.professionId);
  }

  if (filters.naceCode) {
    const label = naceCodeLabel(filters.naceCode);
    parts.push(label ? `${filters.naceCode} ${label}` : filters.naceCode);
  }

  const nameQuery = (filters.nameQuery ?? "").trim();
  if (nameQuery) {
    parts.push(`«${nameQuery}»`);
  }

  if (filters.days !== def.days) {
    parts.push(filters.days === 0 ? "Alle firma" : `Siste ${filters.days} dager`);
  }

  if (filters.hasEmail) {
    parts.push("Kun med e-post");
  }

  if (filters.genericEmailOnly) {
    parts.push("Kun post@ / info@");
  }

  if (filters.facebookPresence !== "all") {
    parts.push(filters.facebookPresence === "with" ? "Med Facebook" : "Uten Facebook");
  }

  if (filters.instagramPresence !== "all") {
    parts.push(filters.instagramPresence === "with" ? "Med Instagram" : "Uten Instagram");
  }

  return parts;
}

export function countActiveMarketFilters(
  filters: FilterState,
  municipalities: Array<{ code: string; name: string; count: number }>
): number {
  return buildSummaryParts(filters, municipalities).length;
}

export function ScanActiveFilterChips({
  filters,
  municipalities,
  onChange,
  variant = "default",
}: Props) {
  const parts = buildSummaryParts(filters, municipalities);

  if (parts.length === 0) {
    return null;
  }

  const isInline = variant === "inline";

  return (
    <div
      className={
        isInline
          ? "scan-active-filter-chips scan-active-filter-chips--inline ml-auto flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1"
          : "scan-active-filter-chips flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-3 lg:px-5"
      }
    >
      <span className="scan-glass-muted text-xs">
        Filter: <span className="text-slate-300">{parts.join(" · ")}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_MARKET_FILTERS })}
        className="scan-btn-ghost px-2.5 py-0.5 text-[11px]"
      >
        Nullstill
      </button>
    </div>
  );
}
