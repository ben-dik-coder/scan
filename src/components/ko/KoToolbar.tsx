"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
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
}: Props) {
  return (
    <div className="ko-toolbar space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="scan-glass-strong text-sm font-semibold">
          {nyCount} i køen
          {contactedCount > 0 && ` · ${contactedCount} kontaktet i dag`}
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/15 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("focus")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "focus"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Fokus
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "list"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-slate-400 hover:text-slate-200"
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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Søk i køen…"
          className="scan-input min-w-[180px] flex-1 py-2 text-sm sm:max-w-xs"
        />
        <FilterChip
          active={noWebsite}
          label="Uten nettside"
          onClick={() => onNoWebsiteChange(!noWebsite)}
        />
        <FilterChip
          active={hasPhone}
          label="Har tlf"
          onClick={() => onHasPhoneChange(!hasPhone)}
        />
        <Link
          href="/app"
          className="scan-btn-ghost text-xs font-semibold"
        >
          + Fra Skann
        </Link>
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
