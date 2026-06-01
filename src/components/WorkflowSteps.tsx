import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS } from "@/lib/site";
import { Check, Filter, Globe, Mail, Users } from "lucide-react";

const STEP_ICONS = [Filter, Globe, Users, Mail] as const;

export function WorkflowSteps({
  activeStep,
  selectedCount = 0,
  scanning = false,
  scanComplete = false,
  noWebsiteCount = 0,
}: {
  activeStep?: 1 | 2 | 3 | 4;
  selectedCount?: number;
  scanning?: boolean;
  scanComplete?: boolean;
  noWebsiteCount?: number;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {WORKFLOW_STEPS.map(({ step, title, short }, index) => {
        const Icon = STEP_ICONS[index] ?? Filter;
        const isActive = activeStep === step;
        const isDone =
          (step === 1 && (activeStep ?? 1) > 1) ||
          (step === 2 && scanComplete) ||
          (step === 3 && scanComplete && noWebsiteCount > 0) ||
          (step === 4 && selectedCount > 0);

        const badge =
          step === 3 && noWebsiteCount > 0 && scanComplete
            ? noWebsiteCount
            : step === 4 && selectedCount > 0
              ? selectedCount
              : null;

        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 transition backdrop-blur-md",
              isActive
                ? "border-white/80 bg-white/70 shadow-sm ring-1 ring-brand-gold/20"
                : isDone
                  ? "border-emerald-200/60 bg-emerald-50/50"
                  : "border-white/50 bg-white/30"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                isActive
                  ? "bg-brand-gold text-brand-navy shadow-sm"
                  : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-white/60 text-slate-400"
              )}
            >
              {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-brand-navy" : isDone ? "text-slate-700" : "text-slate-400"
                  )}
                >
                  {short}
                </p>
                {step === 2 && scanning && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold" />
                )}
                {badge != null && (
                  <span className="rounded-full bg-brand-gold/20 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    {badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{title}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
