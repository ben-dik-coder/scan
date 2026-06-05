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
  withGulesiderCount?: number;
  withInstagramCount?: number;
  withLinkedInCount?: number;
  includeFacebook?: boolean;
  includeInstagram?: boolean;
  includeLinkedIn?: boolean;
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
  withGulesiderCount = 0,
  withInstagramCount = 0,
  withLinkedInCount = 0,
  includeFacebook = true,
  includeInstagram = true,
  includeLinkedIn = true,
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
        embedded
          ? "scan-glass-scan-status scan-glass-divider border-t"
          : "scan-surface scan-glass-scan-status overflow-hidden",
        scanning && (embedded ? "is-scanning ring-1 ring-inset ring-sky-400/30" : "ring-2 ring-sky-400/30"),
        scanComplete && !scanning && "is-complete"
      )}
    >
      <div className="scan-glass-divider flex flex-wrap items-center justify-between gap-3 border-b px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "scan-glass-status-icon flex h-7 w-7 items-center justify-center",
              scanning ? "is-scanning" : scanComplete ? "is-complete" : "is-idle"
            )}
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
          </div>
          <div>
            <p className="scan-glass-strong text-xs font-semibold">
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
            <p className="scan-glass-muted text-xs">
              {scanning ? (
                <>
                  {progress.done} av {progress.total}
                  {scanningName && (
                    <span className="mt-0.5 block truncate opacity-80">{scanningName}</span>
                  )}
                </>
              ) : scanPending ? (
                `Forbereder ${scanTargetCount || progress.total || "…"} firma`
              ) : (
                <>
                  <span>
                    {noWebsiteCount} uten nettside · {withWebsiteCount} med nettside
                    {withGulesiderCount > 0 && ` · ${withGulesiderCount} Gulesider`}
                    {includeFacebook && ` · ${withFacebookCount} Facebook`}
                    {includeInstagram && ` · ${withInstagramCount} Instagram`}
                    {includeLinkedIn && ` · ${withLinkedInCount} LinkedIn`}
                  </span>
                </>
              )}
              {providers.length > 0 && !scanning && (
                <p className="mt-1 text-xs opacity-70">{providers.join(" · ")}</p>
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
          <div className="scan-glass-muted flex justify-between text-xs">
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
              <span className="scan-glass-strong font-medium tabular-nums">
                {displayPercent}%
              </span>
            )}
          </div>
          <div className="scan-glass-progress-track h-1.5 overflow-hidden rounded-full">
            <div
              className={cn(
                "scan-glass-progress-fill h-full rounded-full transition-[width] duration-300 ease-out",
                isFinished
                  ? "is-complete"
                  : scanPending
                    ? "is-pending w-1/5 animate-pulse"
                    : scanning
                      ? "scan-bar-active"
                      : "bg-sky-400"
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
        <div className="scan-glass-status-footer space-y-1 border-t px-2.5 py-2 text-xs leading-snug">
          {truncated && (
            <p>
              Google sjekker <strong className="scan-glass-strong">maks 10 om gangen</strong>. Bruk «Ikke Google-sjekket» eller
              huk av og trykk «Google-sjekk valgte».
            </p>
          )}
          {scanComplete && listFilter === "no_website" && noWebsiteCount > 0 && (
            <p className="text-amber-200">
              Du ser bare firma uten nettside. Bytt til «Alle» for hele listen.
            </p>
          )}
          {scanComplete && notScannedCount > 0 && listFilter === "all" && (
            <p>
              {notScannedCount} er ikke Google-sjekket ennå — du kan fortsatt sende e-post til dem.
            </p>
          )}
          {error && (
            <p className="rounded-2xl bg-red-500/15 px-3 py-2 text-red-200">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
