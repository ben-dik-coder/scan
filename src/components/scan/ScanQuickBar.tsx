"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ListTodo, Search, SlidersHorizontal, Users } from "lucide-react";

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
    <label className="relative block lg:hidden">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gold" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Søk i firmanavn…"
        className="scan-input min-h-[36px] w-full pl-9 text-sm"
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
  const activeStep = selectedCount > 0 ? 2 : 1;

  return (
    <div className="scan-quick-bar border-b border-white/[0.06] px-3 py-3 lg:px-4">
      {onNameQueryChange && (
        <MobileNameSearch value={nameQuery} onDebouncedChange={onNameQueryChange} />
      )}

      <div className="mt-3 flex flex-col gap-3 lg:mt-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <nav
            className="scan-steps flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
            aria-label="Steg"
          >
            <span
              className={cn(
                "scan-step",
                activeStep === 1 && "scan-step-active",
                activeStep >= 1 && "text-slate-300",
                activeStep > 1 && "scan-step-done"
              )}
            >
              <Users className="mr-0.5 inline h-3 w-3" aria-hidden />
              Velg
            </span>
            <span aria-hidden className="scan-step-sep text-slate-600">›</span>
            <span
              className={cn(
                "scan-step",
                activeStep === 2 && "scan-step-active text-white"
              )}
            >
              <Search className="mr-0.5 inline h-3 w-3" aria-hidden />
              Sjekk
            </span>
            <span aria-hidden className="scan-step-sep text-slate-600">›</span>
            <span className="scan-step text-slate-500">
              <ListTodo className="mr-0.5 inline h-3 w-3" aria-hidden />
              Kø
            </span>
          </nav>
          <p className="scan-stat-inline">
            {withContactCount} kontakt · {withWebsiteCount} med nett · {noWebsiteCount} uten nett
            {selectedCount > 0 && (
              <>
                {" "}
                · <strong>{selectedCount}</strong> valgt
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="scan-btn-ghost lg:hidden inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onSelectWithEmail}
            disabled={withEmailCount === 0}
            className="scan-btn-ghost min-h-[36px] px-3 text-xs disabled:opacity-40"
          >
            Velg med e-post
          </button>
          <button
            type="button"
            onClick={onCheckAndQueue}
            disabled={scanning || addingToQueue || withEmailCount === 0}
            className="scan-btn-primary min-h-[36px] px-4 text-xs disabled:opacity-40"
          >
            {addingToQueue ? "Legger i kø…" : "Rask start: topp 10 → kø"}
          </button>
        </div>
      </div>
    </div>
  );
}
