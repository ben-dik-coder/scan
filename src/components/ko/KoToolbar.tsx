"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SavedListPicker } from "@/components/saved-lists/SavedListPicker";
import { Check, ChevronDown, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "focus" | "list";

type Props = {
  nyCount: number;
  contactedCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  noWebsite: boolean;
  onNoWebsiteChange: (value: boolean) => void;
  hasPhone: boolean;
  onHasPhoneChange: (value: boolean) => void;
  loading: boolean;
  onRefresh: () => void;
  hasItems?: boolean;
  onLoadSavedList?: (orgnrs: string[], listName: string) => Promise<void>;
  loadingList?: boolean;
};

export function KoToolbar({
  nyCount,
  contactedCount,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  noWebsite,
  onNoWebsiteChange,
  hasPhone,
  onHasPhoneChange,
  loading,
  onRefresh,
  hasItems = true,
  onLoadSavedList,
  loadingList = false,
}: Props) {
  return (
    <div className="ko-toolbar space-y-3">
      {hasItems && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="scan-glass-strong text-sm font-semibold">
            {nyCount} i køen
            {contactedCount > 0 && ` · ${contactedCount} kontaktet i dag`}
          </p>
          <div className="flex items-center gap-2">
            <div
              className="scan-segmented scan-segmented-view-toggle"
              role="tablist"
              aria-label="Visning"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "focus"}
                onClick={() => onViewModeChange("focus")}
                className={cn(
                  "scan-segmented-item shrink-0",
                  viewMode === "focus" && "scan-segmented-item-active"
                )}
              >
                Fokus
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "list"}
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "scan-segmented-item shrink-0",
                  viewMode === "list" && "scan-segmented-item-active"
                )}
              >
                Liste
              </button>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Oppdater
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {onLoadSavedList && (
          <SavedListPicker mode="queue" onLoad={onLoadSavedList} loading={loadingList} />
        )}
        {hasItems && (
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Søk i køen…"
              className="scan-input min-w-[180px] flex-1 py-2 text-sm sm:max-w-xs"
            />
            <KoFilterMenu
              noWebsite={noWebsite}
              onNoWebsiteChange={onNoWebsiteChange}
              hasPhone={hasPhone}
              onHasPhoneChange={onHasPhoneChange}
            />
          </>
        )}
        {!hasItems && (
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
      </div>
    </div>
  );
}

function KoFilterMenu({
  noWebsite,
  onNoWebsiteChange,
  hasPhone,
  onHasPhoneChange,
}: {
  noWebsite: boolean;
  onNoWebsiteChange: (value: boolean) => void;
  hasPhone: boolean;
  onHasPhoneChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (noWebsite ? 1 : 0) + (hasPhone ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="scan-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={cn("h-3.5 w-3.5 opacity-50 transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Lukk"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="ko-filter-dropdown absolute right-0 top-full z-40 mt-2 w-[min(100vw-2rem,240px)] rounded-xl border border-white/10 p-1.5 shadow-xl backdrop-blur-md"
          >
            <FilterMenuToggle
              active={noWebsite}
              label="Uten nettside"
              onClick={() => onNoWebsiteChange(!noWebsite)}
            />
            <FilterMenuToggle
              active={hasPhone}
              label="Har tlf"
              onClick={() => onHasPhoneChange(!hasPhone)}
            />
            <div className="my-1 border-t border-white/10" role="separator" />
            <Link
              href="/app"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-4 w-4 shrink-0 opacity-70" />
              Fra Skann
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function FilterMenuToggle({
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
      role="menuitemcheckbox"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
        active
          ? "bg-white/10 text-white"
          : "text-slate-200 hover:bg-white/10 hover:text-white"
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />}
    </button>
  );
}
