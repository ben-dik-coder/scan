"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Mail,
  Send,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Step = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  links?: { href: string; label: string }[];
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Velkommen til NyLead",
    body: "Her får du oversikt over leads, e-poster og oppfølging. Vi viser deg kort hvordan du går fra å finne firma til å ta kontakt.",
    icon: Sparkles,
  },
  {
    id: "scan",
    title: "Finn nye firma",
    body: "Start med «Selger nettsider» på Skann. Velg firma, kjør Google-sjekk (maks 10), og se hvem som mangler nettside. Slå på ukentlig varsel under E-post med samme filter.",
    icon: Building2,
    links: [
      { href: "/app?modus=websites", label: "Åpne Skann" },
      { href: "/app/innstillinger", label: "Ukentlig varsel" },
    ],
  },
  {
    id: "queue",
    title: "Jobb i arbeidskøen",
    body: "Firma du vil følge opp havner i Arbeidskø. Der prioriterer du, markerer kontaktet og holder orden.",
    icon: ListTodo,
    links: [{ href: "/app/ko", label: "Åpne arbeidskø" }],
  },
  {
    id: "followup",
    title: "Følg opp salget",
    body: "Pipeline viser status på hvert lead. Kampanjer og sekvenser hjelper deg å sende og følge opp e-post.",
    icon: GitBranch,
    links: [
      { href: "/app/pipeline", label: "Pipeline" },
      { href: "/app/kampanjer", label: "Kampanjer" },
    ],
  },
  {
    id: "content",
    title: "Maler og e-post",
    body: "Lag maler én gang og bruk dem i utsendelser. Koble til e-postkonto under Innstillinger før du sender.",
    icon: FileText,
    links: [
      { href: "/app/maler", label: "Maler" },
      { href: "/app/innstillinger", label: "E-postinnstillinger" },
    ],
  },
  {
    id: "done",
    title: "Du er klar",
    body: "Start gjerne på Oversikt eller gå rett til Skann. Du finner denne guiden igjen under Kom i gang.",
    icon: LayoutDashboard,
    links: [{ href: "/app/oversikt", label: "Oversikt" }],
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
};

export function OnboardingFlow({ open, onClose, onComplete, onSkip }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const step = STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="scan-glass-backdrop absolute inset-0"
        aria-label="Lukk introduksjon"
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        className={cn(
          "relative z-[1] w-full max-w-lg overflow-hidden rounded-2xl border border-white/25 bg-slate-900/92 text-white shadow-2xl backdrop-blur-xl",
          "max-h-[min(90vh,100dvh)]"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/15 bg-white/5 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Kom i gang · {stepIndex + 1} av {STEPS.length}
            </p>
            <h2 id="onboarding-title" className="mt-0.5 text-base font-semibold sm:text-lg">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="scan-glass-mobile-sheet-close shrink-0 rounded-lg p-2"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-400/15">
            <StepIcon className="h-6 w-6 text-sky-200" aria-hidden />
          </div>
          <p id="onboarding-body" className="text-sm leading-relaxed text-slate-200">
            {step.body}
          </p>

          {step.id === "followup" && (
            <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                Pipeline — status på hvert lead
              </li>
              <li className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                Kampanjer — sendte e-poster
              </li>
              <li className="flex items-center gap-2">
                <Workflow className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                Sekvenser — automatisert oppfølging
              </li>
            </ul>
          )}

          {step.id === "content" && (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <Mail className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              Koble e-post før du sender fra Skann eller kampanjer.
            </p>
          )}

          {step.links && step.links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {step.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleClose}
                  className="scan-btn-primary inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {link.label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          )}

          <div
            className="mt-5 flex gap-1"
            role="tablist"
            aria-label="Steg i introduksjonen"
          >
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                role="presentation"
                className={cn(
                  "h-1.5 flex-1 rounded-full transition",
                  i <= stepIndex ? "bg-sky-400/70" : "bg-white/15"
                )}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-slate-300 underline-offset-2 hover:text-white hover:underline"
          >
            Hopp over
          </button>
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Tilbake
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i + 1)}
                className="scan-btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold"
              >
                Neste
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="scan-btn-primary inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold"
              >
                Fullfør
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
