"use client";

import { RefreshCw } from "lucide-react";

type Props = {
  title?: string;
  subtitle: string;
  slowLoad?: boolean;
  onRetry?: () => void;
};

/** Premium loading while Skann henter firma fra Brønnøysund */
export function ScanFetchLoading({
  title = "Henter firma fra registeret…",
  subtitle,
  slowLoad = false,
  onRetry,
}: Props) {
  return (
    <div
      className="app-scan-loading-wrap scan-glass-kommand flex min-h-[min(70dvh,520px)] flex-col items-center justify-center px-4 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-scan-loading-stage relative mb-8 flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
        <span className="app-scan-loading-glow" aria-hidden />
        <span className="app-scan-loading-ring app-scan-loading-ring--a" aria-hidden />
        <span className="app-scan-loading-ring app-scan-loading-ring--b" aria-hidden />
        <span className="app-scan-loading-ring app-scan-loading-ring--c" aria-hidden />
        <span className="app-scan-loading-sweep" aria-hidden />
        <span className="app-scan-loading-core" aria-hidden>
          <span className="app-scan-loading-core-dot" />
        </span>
        <span className="app-scan-loading-orbit" aria-hidden>
          <span className="app-scan-loading-satellite" />
        </span>
      </div>

      <div className="app-scan-loading-copy mx-auto max-w-sm text-center">
        <p className="app-scan-loading-title text-[15px] font-semibold tracking-tight text-white sm:text-base">
          {title}
        </p>
        <p className="app-scan-loading-sub mt-1.5 text-[13px] text-zinc-500">
          {subtitle}
        </p>

        <div className="app-scan-loading-bar mx-auto mt-5 h-[2px] w-40 overflow-hidden rounded-full bg-white/[0.06] sm:w-52">
          <span className="app-scan-loading-bar-fill block h-full w-1/3 rounded-full bg-emerald-400/90" />
        </div>

        {slowLoad ? (
          <p className="mt-4 text-[12px] leading-relaxed text-zinc-600">
            Tar litt tid… Brønnøysund har mange firma å sjekke.
          </p>
        ) : null}

        {slowLoad && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Prøv igjen
          </button>
        ) : null}
      </div>
    </div>
  );
}
