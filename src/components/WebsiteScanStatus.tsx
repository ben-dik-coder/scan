"use client";

import { Globe, Loader2, RefreshCw } from "lucide-react";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { cn } from "@/lib/utils";

type ListFilter = "all" | "no_website" | "with_website" | "not_scanned";

type Props = {
  scanning: boolean;
  scanComplete: boolean;
  scanPending?: boolean;
  scanTargetCount?: number;
  scanningName?: string | null;
  progress: { done: number; total: number };
  error: string | null;
  providers: string[];
  truncated: boolean;
  noWebsiteCount: number;
  withWebsiteCount: number;
  listFilter: ListFilter;
  totalWithEmail: number;
  notScannedCount: number;
  onRescan: () => void;
  scanResults: Map<string, WebsiteScanResult>;
};

export function WebsiteScanStatus({
  scanning,
  scanComplete,
  scanPending,
  scanTargetCount = 0,
  scanningName,
  progress,
  error,
  providers,
  truncated,
  noWebsiteCount,
  withWebsiteCount,
  listFilter,
  totalWithEmail,
  notScannedCount,
  onRescan,
}: Props) {
  if (!scanning && !scanComplete && !error && !scanPending) return null;

  const total = progress.total || scanTargetCount || 0;
  const done = scanComplete ? total : progress.done;
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : scanPending ? 0 : 0;
  const showBar = scanning || scanPending || scanComplete;

  return (
    <div
      className={cn(
        "glass overflow-hidden",
        scanning && "ring-2 ring-brand-gold/25",
        scanComplete && !scanning && "border-emerald-200/60"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/50 bg-white/35 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              scanning ? "bg-amber-100" : scanComplete ? "bg-emerald-100" : "bg-slate-100"
            )}
          >
            {scanning ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
            ) : (
              <Globe
                className={cn(
                  "h-5 w-5",
                  scanComplete ? "text-emerald-600" : "text-slate-500"
                )}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {scanning
                ? "Google sjekker nettsider…"
                : scanPending
                  ? "Starter sjekk…"
                  : "Google-sjekk ferdig"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {scanning
                ? `${progress.done} av ${progress.total}${scanningName ? ` · ${scanningName}` : ""}`
                : scanPending
                  ? `Forbereder ${scanTargetCount || progress.total || "…"} firma`
                  : `${noWebsiteCount} uten nettside · ${withWebsiteCount} med nettside`}
              {providers.length > 0 && !scanning && ` · ${providers.join(" + ")}`}
            </p>
          </div>
        </div>

        {scanComplete && !scanning && (
          <button type="button" onClick={onRescan} className="scan-btn-ghost inline-flex gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Sjekk på nytt
          </button>
        )}
      </div>

      {showBar && (
        <div className="space-y-2 px-5 py-4">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{scanComplete ? "Ferdig" : scanning ? "Fremdrift" : "Venter…"}</span>
            {(scanning || scanComplete) && (
              <span className="font-medium tabular-nums text-slate-700">
                {scanComplete ? 100 : percent}%
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/50">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out",
                scanComplete
                  ? "bg-emerald-500"
                  : scanPending
                    ? "w-1/5 animate-pulse bg-amber-400"
                    : "bg-brand-gold"
              )}
              style={
                scanPending || (scanning && percent === 0)
                  ? undefined
                  : { width: `${scanComplete ? 100 : Math.max(percent, 4)}%` }
              }
            />
          </div>
        </div>
      )}

      {(truncated || error || (scanComplete && notScannedCount > 0)) && (
        <div className="space-y-2 border-t border-white/50 bg-white/25 px-5 py-3 text-xs leading-relaxed text-slate-600 backdrop-blur-sm">
          {truncated && (
            <p>
              Google sjekker <strong>maks 10 om gangen</strong>. Bruk «Ikke Google-sjekket» eller
              huk av og trykk «Google-sjekk valgte».
            </p>
          )}
          {scanComplete && listFilter === "no_website" && noWebsiteCount > 0 && (
            <p className="text-amber-800">
              Du ser bare firma uten nettside. Bytt til «Alle» for hele listen.
            </p>
          )}
          {scanComplete && notScannedCount > 0 && listFilter === "all" && (
            <p>
              {notScannedCount} er ikke Google-sjekket ennå — du kan fortsatt sende e-post til dem.
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
