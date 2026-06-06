"use client";

import type { FilterState } from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { industryGroupLabel } from "@/lib/constants/industries";
import { professionLabel } from "@/lib/constants/professions";
import { regionLabel } from "@/lib/constants/regions";
import { X } from "lucide-react";

type Chip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type Props = {
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
};

function buildChips(
  filters: FilterState,
  municipalities: Array<{ code: string; name: string; count: number }>,
  onChange: (filters: FilterState) => void
): Chip[] {
  const chips: Chip[] = [];
  const def = DEFAULT_MARKET_FILTERS;

  if (filters.regionId && filters.regionId !== def.regionId) {
    chips.push({
      id: "region",
      label: regionLabel(filters.regionId),
      onRemove: () => onChange({ ...filters, regionId: "", municipalityCode: "" }),
    });
  } else if (filters.municipalityCode) {
    const name =
      municipalities.find((m) => m.code === filters.municipalityCode)?.name ??
      filters.municipalityCode;
    chips.push({
      id: "kommune",
      label: name,
      onRemove: () => onChange({ ...filters, municipalityCode: "" }),
    });
  }

  if (filters.industryGroup) {
    chips.push({
      id: "bransje",
      label: industryGroupLabel(filters.industryGroup),
      onRemove: () => onChange({ ...filters, industryGroup: "" }),
    });
  }

  if (filters.professionId) {
    const label = professionLabel(filters.professionId) ?? filters.professionId;
    chips.push({
      id: "yrke",
      label,
      onRemove: () => onChange({ ...filters, professionId: "" }),
    });
  }

  if (filters.days !== def.days) {
    chips.push({
      id: "periode",
      label: filters.days === 0 ? "Alle firma" : `Siste ${filters.days} dager`,
      onRemove: () => onChange({ ...filters, days: def.days }),
    });
  }

  if (filters.hasEmail) {
    chips.push({
      id: "epost",
      label: "Kun med e-post",
      onRemove: () => onChange({ ...filters, hasEmail: false }),
    });
  }

  if (filters.genericEmailOnly) {
    chips.push({
      id: "generisk",
      label: "Kun post@ / info@",
      onRemove: () =>
        onChange({ ...filters, genericEmailOnly: false, hasEmail: filters.hasEmail }),
    });
  }

  if (filters.facebookPresence !== "all") {
    const labels = { with: "Med Facebook", without: "Uten Facebook" };
    chips.push({
      id: "fb",
      label: labels[filters.facebookPresence],
      onRemove: () => onChange({ ...filters, facebookPresence: "all" }),
    });
  }

  if (filters.instagramPresence !== "all") {
    const labels = { with: "Med Instagram", without: "Uten Instagram" };
    chips.push({
      id: "ig",
      label: labels[filters.instagramPresence],
      onRemove: () => onChange({ ...filters, instagramPresence: "all" }),
    });
  }

  return chips;
}

export function countActiveMarketFilters(
  filters: FilterState,
  municipalities: Array<{ code: string; name: string; count: number }>
): number {
  return buildChips(filters, municipalities, () => {}).length;
}

export function ScanActiveFilterChips({ filters, municipalities, onChange }: Props) {
  const chips = buildChips(filters, municipalities, onChange);
  const hasNonDefault =
    chips.length > 0 ||
    filters.regionId !== DEFAULT_MARKET_FILTERS.regionId ||
    filters.municipalityCode !== DEFAULT_MARKET_FILTERS.municipalityCode;

  if (!hasNonDefault && chips.length === 0) {
    return (
      <p className="scan-glass-muted px-2.5 pb-2 text-[11px] lg:px-3">
        Ingen ekstra filter — du ser standard utvalg for markedet.
      </p>
    );
  }

  return (
    <div className="scan-active-filter-chips flex flex-wrap items-center gap-1.5 px-2.5 pb-2 lg:px-3">
      <span className="scan-glass-muted mr-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Aktive filter
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="scan-filter-chip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:bg-white/12"
        >
          {chip.label}
          <X className="h-3 w-3 opacity-70" aria-hidden />
          <span className="sr-only">Fjern filter</span>
        </button>
      ))}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_MARKET_FILTERS })}
          className="scan-btn-ghost px-2 py-0.5 text-[11px]"
        >
          Nullstill
        </button>
      )}
    </div>
  );
}
