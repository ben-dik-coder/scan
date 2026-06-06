"use client";

import { cn } from "@/lib/utils";
import { ListTodo, Search, Users } from "lucide-react";

type Props = {
  withContactCount: number;
  noWebsiteCount: number;
  selectedCount: number;
  withEmailCount: number;
  scanning: boolean;
  addingToQueue: boolean;
  onSelectWithEmail: () => void;
  onCheckAndQueue: () => void;
};

const STEPS = [
  { id: 1, label: "Velg", icon: Users },
  { id: 2, label: "Sjekk", icon: Search },
  { id: 3, label: "Kø", icon: ListTodo },
] as const;

export function ScanQuickBar({
  withContactCount,
  noWebsiteCount,
  selectedCount,
  withEmailCount,
  scanning,
  addingToQueue,
  onSelectWithEmail,
  onCheckAndQueue,
}: Props) {
  const activeStep = selectedCount > 0 ? 2 : 1;

  return (
    <div className="scan-quick-bar border-b border-white/10 px-2.5 py-2 lg:px-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <nav
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
            aria-label="Steg"
          >
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              return (
                <span key={step.id} className="flex items-center gap-1">
                  {index > 0 && (
                    <span className="text-slate-600" aria-hidden>
                      →
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                      isActive && "bg-sky-400/20 text-sky-100",
                      isDone && "text-emerald-300",
                      !isActive && !isDone && "text-slate-500"
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {step.label}
                  </span>
                </span>
              );
            })}
          </nav>
          <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden />
          <p className="text-[11px] text-slate-300">
            <span className="tabular-nums font-semibold text-white">{withContactCount}</span> kontakt
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="tabular-nums font-semibold text-white">{noWebsiteCount}</span> uten nett
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="tabular-nums font-semibold text-white">{selectedCount}</span> valgt
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onSelectWithEmail}
            disabled={withEmailCount === 0}
            className="scan-btn-ghost min-h-[36px] px-3 text-xs font-semibold disabled:opacity-40"
          >
            Velg med e-post
          </button>
          <button
            type="button"
            onClick={onCheckAndQueue}
            disabled={scanning || addingToQueue || withEmailCount === 0}
            className="scan-btn-primary min-h-[36px] px-3 text-xs font-semibold disabled:opacity-40"
          >
            {addingToQueue ? "Legger i kø…" : "Sjekk topp 10 og legg i kø"}
          </button>
        </div>
      </div>
    </div>
  );
}
