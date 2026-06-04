"use client";

import { SCAN_LEAD_MODE_LABELS, type ScanLeadMode } from "@/lib/scan/lead-modes";
import { cn } from "@/lib/utils";
import { Globe, Briefcase, Sparkles } from "lucide-react";

const MODES: { id: ScanLeadMode; icon: typeof Globe }[] = [
  { id: "websites", icon: Globe },
  { id: "profession", icon: Briefcase },
  { id: "all_new", icon: Sparkles },
];

type Props = {
  activeMode: ScanLeadMode | null;
  onSelect: (mode: ScanLeadMode) => void;
};

export function ScanLeadModes({ activeMode, onSelect }: Props) {
  return (
    <div className="scan-lead-modes border-b border-white/10 px-2.5 py-2.5 lg:px-3">
      <p className="scan-glass-muted mb-2 text-[10px] font-semibold uppercase tracking-wide">
        Finn mine leads
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map(({ id, icon: Icon }) => {
          const meta = SCAN_LEAD_MODE_LABELS[id];
          const isActive = activeMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "scan-lead-mode-card flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition",
                isActive
                  ? "border-sky-400/50 bg-sky-400/15"
                  : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/8"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                <span className="scan-glass-strong text-xs font-semibold">
                  {meta.title}
                </span>
                {id === "websites" && (
                  <span className="rounded-full bg-sky-400/25 px-1.5 py-0.5 text-[9px] font-bold text-sky-100">
                    Anbefalt
                  </span>
                )}
              </span>
              <span className="scan-glass-muted text-[10px] leading-snug">
                {meta.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
