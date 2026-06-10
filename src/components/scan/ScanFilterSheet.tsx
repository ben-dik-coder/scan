"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { FilterState } from "@/components/CompanyFilters";
import { CompanyFilters } from "@/components/CompanyFilters";
import type { AgentListTab } from "@/lib/agent/saved-list-filters";
import { cn } from "@/lib/utils";
import { Check, SlidersHorizontal, X } from "lucide-react";

type ListTabOption = {
  id: AgentListTab;
  label: string;
  count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  municipalities: Array<{ code: string; name: string; count: number }>;
  onChange: (filters: FilterState) => void;
  activeFilterCount: number;
  onOpen: () => void;
  hideTrigger?: boolean;
  listTabs?: ListTabOption[];
  activeListTab?: AgentListTab;
  onListTabChange?: (tabId: AgentListTab) => void;
};

function ListTabToggle({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition touch-manipulation",
        active
          ? "bg-white/10 text-white"
          : "text-slate-200 hover:bg-white/10 hover:text-white"
      )}
    >
      <span>{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-xs opacity-70">{count}</span>
        {active && <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />}
      </span>
    </button>
  );
}

export function ScanFilterSheet({
  open,
  onClose,
  filters,
  municipalities,
  onChange,
  activeFilterCount,
  onOpen,
  hideTrigger = false,
  listTabs,
  activeListTab = "all",
  onListTabChange,
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

  const sheet = open ? (
      <div className="scan-filter-sheet-overlay fixed inset-0 z-[110] lg:hidden">
        <button
          type="button"
          className="scan-glass-backdrop absolute inset-0 touch-manipulation"
          aria-label="Lukk filter"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scan-filter-sheet-title"
          className="scan-glass-mobile-sheet absolute bottom-0 left-0 right-0 max-h-[min(92vh,100dvh)] overflow-y-auto border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="scan-glass-mobile-sheet-header sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
            <p id="scan-filter-sheet-title" className="scan-glass-strong text-sm font-semibold">
              Filter markedet
            </p>
            <button
              type="button"
              onClick={onClose}
              className="scan-glass-mobile-sheet-close rounded-lg p-2 touch-manipulation"
              aria-label="Lukk"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            {listTabs && listTabs.length > 0 && onListTabChange && (
              <div className="mb-4">
                <p className="scan-filter-section-title mb-2 px-0.5">Nettside</p>
                <div
                  role="menu"
                  aria-label="Nettside-filter"
                  className="ko-filter-dropdown rounded-xl border border-white/10 p-1.5"
                >
                  {listTabs.map((tab) => (
                    <ListTabToggle
                      key={tab.id}
                      active={activeListTab === tab.id}
                      label={tab.label}
                      count={tab.count}
                      onClick={() => onListTabChange(tab.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            <CompanyFilters
              layout="sidebar"
              hideNameSearch
              hideWebsiteTabHint={Boolean(listTabs?.length)}
              filters={filters}
              municipalities={municipalities}
              onChange={onChange}
            />
            <button
              type="button"
              onClick={onClose}
              className="scan-btn-primary mt-4 w-full touch-manipulation py-2.5"
            >
              Vis resultater
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={onOpen}
          className="scan-btn-ghost lg:hidden inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 px-3 text-xs"
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

      {sheet && typeof document !== "undefined"
        ? createPortal(sheet, document.body)
        : null}
    </>
  );
}
