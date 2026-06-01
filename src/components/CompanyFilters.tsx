"use client";

import { INDUSTRY_GROUPS } from "@/lib/constants/industries";
import { kommuneBelongsToRegion, REGIONS } from "@/lib/constants/regions";
import { Calendar, Mail, MapPin, MapPinned, Scissors } from "lucide-react";

export type FilterState = {
  regionId: string;
  municipalityCode: string;
  days: number;
  hasEmail: boolean;
  genericEmailOnly: boolean;
  industryGroup: string;
};

type Props = {
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
};

export function CompanyFilters({ filters, municipalities, onChange }: Props) {
  const kommunerInRegion = filters.regionId
    ? municipalities.filter((m) => kommuneBelongsToRegion(m.code, filters.regionId))
    : municipalities;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
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

        <label className="flex flex-col gap-1.5">
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

        <label className="flex flex-col gap-1.5">
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

        <label className="flex flex-col gap-1.5">
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

      <div className="flex flex-wrap gap-2 border-t border-white/50 pt-4">
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
    </div>
  );
}
