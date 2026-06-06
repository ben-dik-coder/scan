"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { TUTORIAL_STEPS } from "@/lib/onboarding/tutorial-steps";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
};

export function AppTutorial({ open, onClose, onComplete, onSkip }: Props) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const step = TUTORIAL_STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;
  const progress = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100;

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const root = dialogRef.current;
    const selector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );

    const focusable = getFocusable();
    focusable[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [open, stepIndex]);

  function goToPage(href: string) {
    handleClose();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="app-tutorial-overlay fixed inset-0 z-[120] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button
        type="button"
        className="app-tutorial-backdrop absolute inset-0"
        aria-label="Lukk veiledning"
        onClick={handleClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-tutorial-title"
        aria-describedby="app-tutorial-body"
        className="app-tutorial-panel relative z-[1] flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#1a3a5c] via-[#234a73] to-[#1e4d6b] text-white shadow-2xl sm:max-h-[min(88vh,720px)]"
      >
        <div className="app-tutorial-progress h-1 bg-white/10">
          <div
            className="h-full bg-sky-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/90">
              NyLead veiledning
            </p>
            <p className="mt-0.5 text-xs text-slate-300">
              Steg {stepIndex + 1} av {TUTORIAL_STEPS.length}
              {step.duration ? (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                  <Clock3 className="h-3 w-3" aria-hidden />
                  ca. {step.duration}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-white/10 bg-black/10 p-4 sm:block">
            <ol className="space-y-1" aria-label="Alle steg">
              {TUTORIAL_STEPS.map((s, i) => {
                const Icon = s.icon;
                const isCurrent = i === stepIndex;
                const isDone = i < stepIndex;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStepIndex(i)}
                      className={cn(
                        "app-tutorial-step-btn flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                        isCurrent && "bg-sky-400/20 ring-1 ring-sky-400/35",
                        isDone && !isCurrent && "opacity-80 hover:bg-white/5",
                        !isCurrent && !isDone && "opacity-55 hover:bg-white/5 hover:opacity-75"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          isCurrent && "bg-sky-400 text-slate-900",
                          isDone && !isCurrent && "bg-emerald-500/25 text-emerald-200",
                          !isCurrent && !isDone && "bg-white/10 text-slate-300"
                        )}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {s.phase}
                        </span>
                        <span className="block truncate text-xs font-semibold text-white">
                          {s.title.replace(/^\d+\.\s*/, "").replace(/^.*?—\s*/, "")}
                        </span>
                      </span>
                      <Icon className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-sky-300/80" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-400/15 shadow-[0_0_24px_-8px_rgba(56,189,248,0.6)]">
                  <StepIcon className="h-6 w-6 text-sky-200" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                    {step.phase}
                  </p>
                  <h2 id="app-tutorial-title" className="text-lg font-bold text-white sm:text-xl">
                    {step.title}
                  </h2>
                  <p className="text-sm text-slate-300">{step.summary}</p>
                </div>
              </div>

              <p id="app-tutorial-body" className="text-sm leading-relaxed text-slate-200">
                {step.body}
              </p>

              <ul className="mt-4 space-y-2">
                {step.tips.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    {tip}
                  </li>
                ))}
              </ul>

              {step.href && step.ctaLabel ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => goToPage(step.href!)}
                    className="scan-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
                  >
                    {step.ctaLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/10 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
              >
                Hopp over
              </button>
              <div className="flex flex-wrap gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => i - 1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Tilbake
                  </button>
                ) : null}
                {!isLast ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => i + 1)}
                    className="scan-btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold"
                  >
                    Neste steg
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onComplete}
                    className="scan-btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold"
                  >
                    Fullfør veiledning
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-t border-white/10 px-4 py-2 sm:hidden">
          {TUTORIAL_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(i)}
              aria-label={`Gå til steg ${i + 1}: ${s.title}`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition",
                i <= stepIndex ? "bg-sky-400" : "bg-white/15"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
