"use client";

import { Search } from "lucide-react";
import { SavedListPicker } from "@/components/saved-lists/SavedListPicker";
import { cn } from "@/lib/utils";

type Props = {
  totalCount: number;
  visibleCount: number;
  selectedListId: string | null;
  onListSelect: (selection: {
    listId: string | null;
    orgnrs: string[] | null;
    listName: string | null;
  }) => void;
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
  selectedListId,
  onListSelect,
  search,
  onSearchChange,
  followUpToday,
  onFollowUpTodayChange,
  score70Plus,
  onScore70PlusChange,
}: Props) {
  return (
    <div className="pipeline-toolbar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SavedListPicker
          mode="filter"
          selectedListId={selectedListId}
          onSelect={onListSelect}
        />
        <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Søk firmanavn…"
            className="h-8 w-full rounded-md border border-white/[0.08] bg-[#141414] py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none"
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

      <p className="shrink-0 text-[11px] text-zinc-600">
        {visibleCount === totalCount
          ? `${totalCount} i pipeline`
          : `${visibleCount} av ${totalCount}`}
      </p>
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
        "h-8 rounded-md border px-2.5 text-[11px] font-medium transition",
        active
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
          : "border-white/[0.08] text-zinc-500 hover:border-white/15 hover:text-zinc-300"
      )}
    >
      {label}
    </button>
  );
}
