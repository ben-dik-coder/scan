"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type CountData = {
  taken: number;
  cap: number;
  remaining: number;
  full: boolean;
};

type Props = {
  className?: string;
  /** Kompakt variant for prisseksjon */
  compact?: boolean;
};

export function SubscriberCapBanner({ className, compact = false }: Props) {
  const [data, setData] = useState<CountData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/subscriber-count");
        if (!res.ok) throw new Error("fetch failed");
        const json = (await res.json()) as CountData;
        if (!cancelled) {
          setData(json);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !data) return null;

  const pct =
    data.cap > 0 ? Math.min(100, Math.round((data.taken / data.cap) * 100)) : 0;
  const urgent = pct >= 85 && !data.full;

  if (data.full) {
    return (
      <div
        className={cn(
          "border-b border-red-500/30 bg-red-950/90 text-white",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-center font-sans font-semibold text-white",
            compact ? "py-2 text-xs" : "py-2.5 text-sm sm:py-3"
          )}
        >
          <Users className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
          <span>
            <strong className="font-display uppercase tracking-wide">Fullt</strong>
            {" — "}
            alle {data.cap} sitteplasser er tatt. Skriv til{" "}
            <a
              href="mailto:post@nylead.no?subject=Venteliste%20NyLead"
              className="underline decoration-red-300/60 underline-offset-2 hover:text-red-100"
            >
              post@nylead.no
            </a>{" "}
            for venteliste.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b border-brand-gold/15 bg-brand-goldPale text-brand-navy",
        urgent && "border-amber-400/40 bg-amber-50",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:gap-4",
          compact ? "py-2" : "py-2.5 sm:py-3"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Users
            className={cn(
              "h-4 w-4 shrink-0",
              urgent ? "text-amber-600" : "text-brand-gold"
            )}
            aria-hidden
          />
          <p
            className={cn(
              "font-sans leading-snug text-slate-700",
              compact ? "text-xs" : "text-sm"
            )}
          >
            <span className="font-sans text-base font-bold tabular-nums text-brand-navy sm:text-lg">
              {data.taken}
            </span>{" "}
            <span className="font-medium">
              av {data.cap} sitteplasser er tatt
            </span>
            {!compact && data.remaining > 0 && (
              <span className="hidden text-slate-500 sm:inline">
                {" "}
                · {data.remaining} ledige
              </span>
            )}
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:max-w-[200px] lg:max-w-[240px]">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-border"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                urgent
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-brand-gold to-brand-goldLight"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 font-sans font-semibold tabular-nums text-slate-600",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
