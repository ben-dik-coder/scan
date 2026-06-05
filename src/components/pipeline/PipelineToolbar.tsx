"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  totalCount: number;
  visibleCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  followUpToday: boolean;
  onFollowUpTodayChange: (value: boolean) => void;
  score70Plus: boolean;
  onScore70PlusChange: (value: boolean) => void;
};

export function PipelineToolbar({
  totalCount,
  visibleCount,
  search,
  onSearchChange,
  followUpToday,
  onFollowUpTodayChange,
  score70Plus,
  onScore70PlusChange,
}: Props) {
  return (
    <div className="pipeline-toolbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Søk firmanavn…"
            className="scan-input w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <FilterChip
          active={followUpToday}
          onClick={() => onFollowUpTodayChange(!followUpToday)}
          label="Oppfølging i dag"
        />
        <FilterChip
          active={score70Plus}
          onClick={() => onScore70PlusChange(!score70Plus)}
          label="Score 70+"
        />
      </div>

      <div className="flex items-center gap-3">
        <p className="scan-glass-muted text-xs">
          {visibleCount === totalCount
            ? `${totalCount} leads i pipeline`
            : `${visibleCount} av ${totalCount} leads`}
        </p>
        <Link
          href="/app"
          className="scan-btn-ghost inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          Fra Skann
        </Link>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
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
