"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type TrialContext = {
  isTrialing: boolean;
  trialDay: number | null;
  daysLeft: number | null;
  showNudge: boolean;
};

type Props = {
  noWebsiteCount: number;
  withEmailCount: number;
};

export function TrialNudgeBanner({ noWebsiteCount, withEmailCount }: Props) {
  const [ctx, setCtx] = useState<TrialContext | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trial/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCtx(data as TrialContext);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ctx?.showNudge || dismissed) return null;

  const day = ctx.trialDay ?? 0;
  let message = "Kjør Google-sjekk og finn firma uten nettside.";
  if (day >= 5) {
    message =
      noWebsiteCount > 0
        ? `Du har ${noWebsiteCount} uten nettside — ta kontakt med 3 i dag.`
        : withEmailCount > 0
          ? "Velg 10 firma med e-post og kjør Google-sjekk."
          : "Velg firma med e-post og kjør Google-sjekk.";
  } else if (day >= 3 && noWebsiteCount > 0) {
    message = `${noWebsiteCount} firma uten nettside — klar for kontakt.`;
  }

  return (
    <div
      className={cn(
        "scan-glass-notice mx-2.5 flex flex-wrap items-start justify-between gap-2 sm:mx-3",
        "border-sky-400/30 bg-sky-500/10"
      )}
      role="status"
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0">
          <p className="scan-glass-strong text-sm font-semibold">
            Prøveperiode · dag {day}
            {ctx.daysLeft != null && ctx.daysLeft <= 2
              ? ` (${ctx.daysLeft === 0 ? "siste dag" : `${ctx.daysLeft} d igjen`})`
              : ""}
          </p>
          <p className="scan-glass-muted mt-0.5 text-xs">{message}</p>
          <p className="mt-1.5 flex flex-wrap gap-2 text-xs font-semibold">
            <Link href="/app?modus=websites&web=without" className="text-sky-300 hover:text-sky-200">
              Åpne Skann
            </Link>
            <Link href="/app/ko" className="text-sky-300 hover:text-sky-200">
              Arbeidskø
            </Link>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="Lukk"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
