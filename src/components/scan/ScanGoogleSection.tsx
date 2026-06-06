"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ScanGooglePanel } from "@/components/scan/ScanGooglePanel";
import { WebsiteScanStatus } from "@/components/WebsiteScanStatus";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import type { ScanSocialOptions } from "@/lib/website-scan/scan-social-options";
import { cn } from "@/lib/utils";

type ListFilter = "all" | "no_website" | "with_website" | "not_scanned";

type Props = {
  selectedCount: number;
  scanQueueCount: number;
  scanning: boolean;
  onScanSelected: () => void;
  socialOptions: ScanSocialOptions;
  onSocialOptionsChange: (next: ScanSocialOptions) => void;
  scanSelectionMessage: string | null;
  googleSearchQuery: string;
  scanComplete: boolean;
  scanPending?: boolean;
  scanTargetCount?: number;
  scanningName?: string | null;
  progress: { done: number; total: number };
  scanError: string | null;
  providers: string[];
  truncated: boolean;
  noWebsiteCount: number;
  withWebsiteCount: number;
  withFacebookCount?: number;
  withGulesiderCount?: number;
  withInstagramCount?: number;
  withLinkedInCount?: number;
  listFilter: ListFilter;
  notScannedCount: number;
  onRescan: () => void;
  websiteScans: Map<string, WebsiteScanResult>;
};

export function ScanGoogleSection({
  selectedCount,
  scanQueueCount,
  scanning,
  onScanSelected,
  socialOptions,
  onSocialOptionsChange,
  scanSelectionMessage,
  googleSearchQuery,
  scanComplete,
  scanPending,
  scanTargetCount,
  scanningName,
  progress,
  scanError,
  providers,
  truncated,
  noWebsiteCount,
  withWebsiteCount,
  withFacebookCount,
  withGulesiderCount,
  withInstagramCount,
  withLinkedInCount,
  listFilter,
  notScannedCount,
  onRescan,
  websiteScans,
}: Props) {
  const [manualOpen, setManualOpen] = useState(false);
  const isOpen = manualOpen || scanning || Boolean(scanError);

  useEffect(() => {
    if (scanning) setManualOpen(true);
  }, [scanning]);

  return (
    <details
      className="scan-glass-divider border-b"
      open={isOpen}
      onToggle={(e) => setManualOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2.5 text-sm font-semibold text-white/80 hover:text-white lg:px-3 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <Search className="h-4 w-4 text-sky-300" />
          Google-sjekk (valgfritt)
        </span>
        <ChevronDown className="h-4 w-4 text-white/40" />
      </summary>

      <div className="space-y-2 px-2.5 pb-2.5 lg:px-3 lg:pb-3">
        <p className="text-xs text-white/45">
          Sjekk om firma har nettside. Du kan også ringe eller sende uten dette steget.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="scan-chip cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={socialOptions.includeFacebook}
                onChange={(e) =>
                  onSocialOptionsChange({
                    ...socialOptions,
                    includeFacebook: e.target.checked,
                  })
                }
                className="h-3 w-3 rounded accent-sky-600"
              />
              + Facebook
            </label>
            <label className="scan-chip cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={socialOptions.includeInstagram}
                onChange={(e) =>
                  onSocialOptionsChange({
                    ...socialOptions,
                    includeInstagram: e.target.checked,
                  })
                }
                className="h-3 w-3 rounded accent-sky-600"
              />
              + Instagram
            </label>
          </div>
          <button
            type="button"
            onClick={onScanSelected}
            disabled={scanning || selectedCount === 0}
            className={cn(
              "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition",
              selectedCount > 0 && !scanning
                ? "bg-sky-400 text-slate-900 hover:bg-sky-300"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            {scanning
              ? "Søker…"
              : selectedCount > 0
                ? `Sjekk valgte (${scanQueueCount})`
                : "Velg firma i listen"}
          </button>
        </div>

        {scanSelectionMessage && (
          <p className="text-xs font-medium text-amber-200">{scanSelectionMessage}</p>
        )}

        <WebsiteScanStatus
          embedded
          scanning={scanning}
          scanComplete={scanComplete}
          scanPending={scanPending}
          scanTargetCount={scanTargetCount}
          scanningName={scanningName}
          progress={progress}
          error={scanError}
          providers={providers}
          truncated={truncated}
          noWebsiteCount={noWebsiteCount}
          withWebsiteCount={withWebsiteCount}
          withFacebookCount={withFacebookCount}
          withGulesiderCount={withGulesiderCount}
          withInstagramCount={withInstagramCount}
          withLinkedInCount={withLinkedInCount}
          includeFacebook={socialOptions.includeFacebook}
          includeInstagram={socialOptions.includeInstagram}
          includeLinkedIn={socialOptions.includeLinkedIn}
          listFilter={listFilter}
          notScannedCount={notScannedCount}
          onRescan={onRescan}
          scanResults={websiteScans}
        />

        <ScanGooglePanel searchQuery={googleSearchQuery} />
      </div>
    </details>
  );
}
