"use client";

import { useEffect, useState } from "react";
import { ListTodo, Search, SlidersHorizontal } from "lucide-react";

type Props = {
  withContactCount: number;
  withWebsiteCount: number;
  noWebsiteCount: number;
  selectedCount: number;
  withEmailCount: number;
  scanning: boolean;
  addingToQueue: boolean;
  onSelectWithEmail: () => void;
  onCheckAndQueue: () => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  nameQuery?: string;
  onNameQueryChange?: (nameQuery: string) => void;
};

function MobileNameSearch({
  value,
  onDebouncedChange,
}: {
  value: string;
  onDebouncedChange: (nameQuery: string) => void;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== value) {
        onDebouncedChange(local);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [local, value, onDebouncedChange]);

  return (
    <label className="relative mb-2 block lg:hidden">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Søk i firmanavn…"
        className="scan-input min-h-[36px] w-full rounded-md pl-8 text-sm"
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

export function ScanQuickBar({
  withContactCount,
  withWebsiteCount,
  noWebsiteCount,
  selectedCount,
  withEmailCount,
  scanning,
  addingToQueue,
  onSelectWithEmail,
  onCheckAndQueue,
  onOpenFilters,
  activeFilterCount = 0,
  nameQuery = "",
  onNameQueryChange,
}: Props) {
  return (
    <div className="scan-quick-bar border-b border-white/[0.08] px-3 py-2.5 lg:px-4">
      {onNameQueryChange && (
        <MobileNameSearch value={nameQuery} onDebouncedChange={onNameQueryChange} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs tabular-nums text-zinc-500">
          <span className="text-zinc-400">{withContactCount}</span> kontakt
          <span className="mx-1.5 text-zinc-700">·</span>
          <span className="text-zinc-400">{withWebsiteCount}</span> med nett
          <span className="mx-1.5 text-zinc-700">·</span>
          <span className="text-zinc-400">{noWebsiteCount}</span> uten nett
          {selectedCount > 0 ? (
            <>
              <span className="mx-1.5 text-zinc-700">·</span>
              <span className="font-semibold text-zinc-200">{selectedCount}</span> valgt
            </>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              aria-haspopup="dialog"
              className="scan-btn-ghost inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onSelectWithEmail}
            disabled={withEmailCount === 0}
            className="scan-btn-ghost inline-flex h-8 items-center rounded-md px-2.5 text-xs disabled:opacity-40"
          >
            Velg med e-post
          </button>
          <button
            type="button"
            onClick={onCheckAndQueue}
            disabled={scanning || addingToQueue || withEmailCount === 0}
            className="scan-btn-primary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs disabled:opacity-40"
          >
            <ListTodo className="h-3.5 w-3.5" aria-hidden />
            {addingToQueue ? "Legger i kø…" : "Topp 10 → kø"}
          </button>
        </div>
      </div>
    </div>
  );
}
