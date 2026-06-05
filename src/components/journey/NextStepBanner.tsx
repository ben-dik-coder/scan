"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { JOURNEY_STEP_LABELS, type NextStepPhase } from "@/lib/sales/next-step";
import { cn } from "@/lib/utils";
import { useNextStep } from "./useNextStep";

type Props = {
  /** Hvilken del av flyten brukeren er på nå (for å utheve i progress-linja). */
  pagePhase?: NextStepPhase;
  variant?: "default" | "hero";
};

const PAGE_PHASE_PROGRESS: Partial<Record<NextStepPhase, number>> = {
  scan: 1,
  work_queue: 3,
  pipeline: 4,
  overview: 5,
};

export function NextStepBanner({ pagePhase, variant = "default" }: Props) {
  const { step, loading } = useNextStep();
  const isHero = variant === "hero";

  if (loading) {
    return (
      <div
        className={cn(
          "journey-banner flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3",
          isHero && "journey-banner--hero"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">Finner ditt neste steg…</span>
      </div>
    );
  }

  if (!step) return null;

  const highlightIndex =
    pagePhase != null
      ? (PAGE_PHASE_PROGRESS[pagePhase] ?? step.progress.current)
      : step.progress.current;

  return (
    <section
      className={cn(
        "journey-banner rounded-xl border border-white/15 bg-white/[0.04]",
        isHero && "journey-banner--hero"
      )}
      aria-label="Ditt neste steg"
    >
      <nav className="journey-banner-steps flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2.5 sm:px-4">
        {JOURNEY_STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === highlightIndex;
          const isDone = stepNum < highlightIndex;
          return (
            <span key={label} className="flex items-center gap-1">
              {i > 0 && (
                <span className="journey-banner-connector hidden text-slate-600 sm:inline" aria-hidden>
                  →
                </span>
              )}
              <span
                className={cn(
                  "journey-banner-step rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
                  isActive && "journey-banner-step--active",
                  isDone && !isActive && "journey-banner-step--done",
                  !isActive && !isDone && "text-slate-500"
                )}
              >
                {label}
              </span>
            </span>
          );
        })}
      </nav>

      <div
        className={cn(
          "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4",
          isHero && "sm:gap-4"
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
            Ditt neste steg
          </p>
          <h2
            className={cn(
              "font-semibold text-white",
              isHero ? "mt-1 text-xl sm:text-2xl" : "mt-0.5 text-base sm:text-lg"
            )}
          >
            {step.title}
          </h2>
          <p className={cn("text-slate-300", isHero ? "mt-1.5 text-sm" : "mt-1 text-xs sm:text-sm")}>
            {step.body}
          </p>
        </div>
        <Link
          href={step.cta.href}
          className={cn(
            "journey-banner-cta inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-500",
            isHero ? "px-5 py-3 text-sm" : "px-4 py-2.5 text-xs sm:text-sm"
          )}
        >
          {step.cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
