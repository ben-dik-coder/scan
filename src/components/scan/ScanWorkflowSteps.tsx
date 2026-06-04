"use client";

import { cn } from "@/lib/utils";
import { Check, Mail, Search, Users } from "lucide-react";

export type WorkflowStep = 1 | 2 | 3;

type Props = {
  activeStep: WorkflowStep;
  selectedCount: number;
  onStepClick: (step: WorkflowStep) => void;
};

const STEPS = [
  { id: 1 as const, label: "Velg firma", short: "Velg", icon: Users },
  { id: 2 as const, label: "Google-sjekk", short: "Sjekk", icon: Search },
  { id: 3 as const, label: "Send e-post", short: "Send", icon: Mail },
];

export function ScanWorkflowSteps({ activeStep, selectedCount, onStepClick }: Props) {
  return (
    <nav
      className="scan-workflow-steps flex flex-wrap items-stretch gap-1 p-2.5 lg:px-3"
      aria-label="Arbeidsflyt"
    >
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = activeStep === step.id;
        const isDone = activeStep > step.id;
        const disabled = step.id === 2 && selectedCount === 0;
        const disabledStep3 = step.id === 3 && selectedCount === 0;

        return (
          <button
            key={step.id}
            type="button"
            disabled={disabled || disabledStep3}
            onClick={() => onStepClick(step.id)}
            className={cn(
              "scan-workflow-step flex min-h-[40px] flex-1 min-w-[5.5rem] items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition",
              isActive && "scan-workflow-step-active",
              isDone && !isActive && "scan-workflow-step-done",
              (disabled || disabledStep3) && "cursor-not-allowed opacity-45"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold",
                isActive && "border-sky-400/50 bg-sky-400/20 text-white",
                isDone && !isActive && "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
              )}
            >
              {isDone && !isActive ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Icon className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="scan-glass-strong block font-semibold leading-tight">
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.short}</span>
              </span>
              <span className="scan-glass-muted block text-[10px]">
                {step.id === 1 && "Huk av i listen"}
                {step.id === 2 && "Maks 10 om gangen"}
                {step.id === 3 && "E-post til valgte"}
              </span>
            </span>
            {index < STEPS.length - 1 && (
              <span className="scan-workflow-connector hidden sm:block" aria-hidden />
            )}
          </button>
        );
      })}
    </nav>
  );
}
