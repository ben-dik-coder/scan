"use client";

import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  campaignCount: number;
  totalSent: number;
  totalFailed: number;
  visibleCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  hasFailures: boolean;
  onHasFailuresChange: (value: boolean) => void;
  last30Days: boolean;
  onLast30DaysChange: (value: boolean) => void;
  loading?: boolean;
  onRefresh?: () => void;
};

export function CampaignToolbar({
  campaignCount,
  totalSent,
  totalFailed,
  visibleCount,
  search,
  onSearchChange,
  hasFailures,
  onHasFailuresChange,
  last30Days,
  onLast30DaysChange,
  loading,
  onRefresh,
}: Props) {
  return (
    <div className="campaign-toolbar space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="scan-glass-strong text-sm font-semibold">
          {campaignCount} kampanjer
          {totalSent > 0 && ` · ${totalSent} sendt`}
          {totalFailed > 0 && ` · ${totalFailed} feilet`}
        </p>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Oppdater
            </button>
          )}
          <Link href="/app" className="scan-btn-ghost text-xs font-semibold">
            + Fra Skann
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Søk emne…"
            className="scan-input w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <FilterChip
          active={hasFailures}
          label="Har feil"
          onClick={() => onHasFailuresChange(!hasFailures)}
        />
        <FilterChip
          active={last30Days}
          label="Siste 30 dager"
          onClick={() => onLast30DaysChange(!last30Days)}
        />
        {visibleCount !== campaignCount && (
          <span className="scan-glass-muted text-xs">
            Viser {visibleCount} av {campaignCount}
          </span>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
        active
          ? "border-brand-gold/50 bg-brand-gold/15 text-brand-gold"
          : "border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-200"
      )}
    >
      {label}
    </button>
  );
}
