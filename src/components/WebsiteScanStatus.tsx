"use client";

import { Globe, Loader2, RefreshCw } from "lucide-react";
import { useScanProgressAnimation } from "@/hooks/useScanProgressAnimation";
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
  withFacebookCount?: number;
  withInstagramCount?: number;
  includeFacebook?: boolean;
  includeInstagram?: boolean;
  listFilter: ListFilter;
  notScannedCount: number;
  onRescan: () => void;
  scanResults: Map<string, WebsiteScanResult>;
  /** When true, renders inside a parent scan-surface (no extra card border). */
  embedded?: boolean;
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
  withFacebookCount = 0,
  withInstagramCount = 0,
  includeFacebook = true,
  includeInstagram = true,
  listFilter,
  notScannedCount,
  onRescan,
  embedded = false,
}: Props) {
  const total = progress.total || scanTargetCount || 0;
  const done = progress.done;
  const isFinished = scanComplete && !scanning;
  const { currentStep, visualPercent, stepKey } = useScanProgressAnimation({
    scanning,
    scanComplete,
    scanPending,
    done,
    total,
    includeFacebook,
    includeInstagram,
  });

  if (!scanning && !scanComplete && !error && !scanPending) return null;

  const displayPercent = isFinished
    ? 100
    : scanning
      ? Math.round(visualPercent)
      : scanPending
        ? 0
        : total > 0
          ? Math.min(100, Math.round((done / total) * 100))
          : 0;
  const barWidth = isFinished
    ? 100
    : scanning
      ? Math.max(displayPercent, 4)
      : scanPending
        ? undefined
        : displayPercent > 0
          ? Math.max(displayPercent, 4)
          : 0;
  const showBar = scanning || scanPending || scanComplete;

  return (
    <div
      className={cn(
        embedded ? "border-t border-slate-200" : "scan-surface overflow-hidden",
        scanning && (embedded ? "bg-sky-50/40 ring-1 ring-inset ring-sky-200" : "ring-2 ring-sky-200"),
        scanComplete && !scanning && (embedded ? "bg-emerald-50/30" : "border-emerald-300")
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded",
              scanning ? "bg-amber-100" : scanComplete ? "bg-emerald-100" : "bg-slate-100"
            )}
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
            ) : (
              <Globe
                className={cn(
                  "h-3.5 w-3.5",
                  scanComplete ? "text-emerald-600" : "text-slate-500"
                )}
              />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">
              {scanning && currentStep ? (
                <span key={stepKey} className="scan-step-animate inline-block">
                  {currentStep}
                </span>
              ) : scanPending ? (
                "Starter…"
              ) : (
                "Ferdig!"
              )}
            </p>
            <p className="text-xs text-slate-600">
              {scanning ? (
                <>
                  {progress.done} av {progress.total}
                  {scanningName && (
                    <span className="mt-0.5 block truncate text-slate-500">{scanningName}</span>
                  )}
                </>
              ) : scanPending ? (
                `Forbereder ${scanTargetCount || progress.total || "…"} firma`
              ) : (
                <>
                  <span>
                    {noWebsiteCount} uten nettside · {withWebsiteCount} med nettside
                    {includeFacebook && ` · ${withFacebookCount} Facebook`}
                    {includeInstagram && ` · ${withInstagramCount} Instagram`}
                  </span>
                </>
              )}
              {providers.length > 0 && !scanning && (
                <p className="mt-1 text-xs text-slate-400">{providers.join(" · ")}</p>
              )}
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
        <div className="space-y-1 px-2.5 py-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              {isFinished ? (
                "Ferdig"
              ) : scanning && currentStep ? (
                <span key={`bar-${stepKey}`} className="scan-step-animate inline-block">
                  {currentStep}
                </span>
              ) : scanning ? (
                "Fremdrift"
              ) : (
                "Venter…"
              )}
            </span>
            {(scanning || isFinished) && (
              <span className="font-medium tabular-nums text-slate-700">
                {displayPercent}%
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out",
                isFinished
                  ? "bg-emerald-500"
                  : scanPending
                    ? "w-1/5 animate-pulse bg-amber-400"
                    : scanning
                      ? "scan-bar-active"
                      : "bg-brand-gold"
              )}
              style={
                scanPending || (scanning && barWidth === undefined)
                  ? undefined
                  : { width: `${barWidth}%` }
              }
            />
          </div>
        </div>
      )}

      {(truncated || error || (scanComplete && notScannedCount > 0)) && (
        <div className="space-y-1 border-t border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-snug text-slate-700">
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
