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
  /** Glass-tema inne i /app — mørk bakgrunn, lys tekst */
  variant?: "default" | "glass";
};

export function SubscriberCapBanner({
  className,
  compact = false,
  variant = "default",
}: Props) {
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

  const isGlass = variant === "glass";

  if (data.full) {
    return (
      <div
        className={cn(
          isGlass
            ? "rounded-lg border border-red-400/30 bg-red-950/60 text-white"
            : "border-b border-red-500/30 bg-red-950/90 text-white",
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
        isGlass
          ? "rounded-lg border border-white/15 bg-white/5 text-slate-200"
          : "border-b border-app-accent/15 bg-app-accent/5 text-app-ink",
        !isGlass && urgent && "border-amber-400/40 bg-amber-50",
        isGlass && urgent && "border-amber-400/30 bg-amber-950/30",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4",
          isGlass ? "px-3 py-2.5" : "mx-auto max-w-6xl px-4 sm:max-w-6xl",
          !isGlass && (compact ? "py-2" : "py-2.5 sm:py-3")
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Users
            className={cn(
              "h-4 w-4 shrink-0",
              isGlass
                ? urgent
                  ? "text-amber-400"
                  : "text-sky-400"
                : urgent
                  ? "text-amber-600"
                  : "text-app-accent"
            )}
            aria-hidden
          />
          <p
            className={cn(
              "font-sans leading-snug",
              isGlass ? "text-slate-300" : "text-slate-700",
              compact ? "text-xs" : "text-sm"
            )}
          >
            <span
              className={cn(
                "font-sans font-bold tabular-nums",
                isGlass ? "text-base text-white sm:text-lg" : "text-base text-app-ink sm:text-lg"
              )}
            >
              {data.taken}
            </span>{" "}
            <span className="font-medium">
              av {data.cap} sitteplasser er tatt
            </span>
            {!compact && data.remaining > 0 && (
              <span
                className={cn(
                  "hidden sm:inline",
                  isGlass ? "text-slate-400" : "text-slate-500"
                )}
              >
                {" "}
                · {data.remaining} ledige
              </span>
            )}
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:max-w-[200px] lg:max-w-[240px]">
          <div
            className={cn(
              "h-1.5 flex-1 overflow-hidden rounded-full",
              isGlass ? "bg-white/15" : "bg-brand-border"
            )}
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                urgent
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : isGlass
                    ? "bg-gradient-to-r from-sky-500 to-sky-400"
                    : "bg-gradient-to-r from-app-accent to-app-accentLight"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 font-sans font-semibold tabular-nums",
              isGlass ? "text-slate-400" : "text-slate-600",
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
