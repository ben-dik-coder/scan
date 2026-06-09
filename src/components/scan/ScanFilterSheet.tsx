"use client";

import { useEffect } from "react";
import type { FilterState } from "@/components/CompanyFilters";
import { CompanyFilters } from "@/components/CompanyFilters";
import { SlidersHorizontal, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
  activeFilterCount: number;
  onOpen: () => void;
  hideTrigger?: boolean;
};

export function ScanFilterSheet({
  open,
  onClose,
  filters,
  municipalities,
  onChange,
  activeFilterCount,
  onOpen,
  hideTrigger = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={onOpen}
          className="scan-btn-ghost lg:hidden inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Flere filter
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="scan-filter-sheet-overlay fixed inset-0 z-[110] lg:hidden">
          <button
            type="button"
            className="scan-glass-backdrop absolute inset-0"
            aria-label="Lukk filter"
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-filter-sheet-title"
            className="scan-glass-mobile-sheet absolute bottom-0 left-0 right-0 max-h-[min(92vh,100dvh)] overflow-y-auto"
          >
            <div className="scan-glass-mobile-sheet-header sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
              <p id="scan-filter-sheet-title" className="scan-glass-strong text-sm font-semibold">
                Filter markedet
              </p>
              <button
                type="button"
                onClick={onClose}
                className="scan-glass-mobile-sheet-close rounded-lg p-2"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <CompanyFilters
                layout="sidebar"
                hideNameSearch
                filters={filters}
                municipalities={municipalities}
                onChange={(next) => {
                  onChange(next);
                }}
              />
              <button
                type="button"
                onClick={onClose}
                className="scan-btn-primary mt-4 w-full py-2.5"
              >
                Vis resultater
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
