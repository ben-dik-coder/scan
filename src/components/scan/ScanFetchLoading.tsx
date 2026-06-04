import { Loader2, RefreshCw } from "lucide-react";

type Props = {
  title?: string;
  subtitle: string;
  slowLoad?: boolean;
  onRetry?: () => void;
};

/** Laster firma — egne CSS-klasser som tåler at Tailwind kommer litt sent */
export function ScanFetchLoading({
  title = "Henter firma fra registeret…",
  subtitle,
  slowLoad = false,
  onRetry,
}: Props) {
  return (
    <div className="app-scan-loading-wrap scan-glass-kommand px-2 sm:px-3">
      <div className="app-scan-loading-card scan-surface-full overflow-hidden ring-2 ring-sky-400/25">
        <div className="scan-glass-scan-status is-scanning flex items-start gap-2.5 px-2.5 py-2.5">
          <div className="scan-glass-status-icon is-scanning flex h-7 w-7 shrink-0 items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="app-scan-loading-title scan-glass-strong text-xs font-semibold">
              {title}
            </p>
            <p className="app-scan-loading-sub scan-glass-muted text-[11px]">
              {subtitle}
            </p>
            {slowLoad && (
              <p className="scan-glass-muted mt-1 text-[11px]">
                Tar litt tid… Brønnøysund har mange firma å sjekke.
              </p>
            )}
            {slowLoad && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="scan-btn-ghost mt-1.5 inline-flex gap-1.5"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Prøv igjen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
