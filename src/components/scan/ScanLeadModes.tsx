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
    <div className="scan-lead-modes border-b border-white/10 px-2.5 py-2 lg:px-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="scan-glass-muted shrink-0 text-[10px] font-semibold uppercase tracking-wide">
          Målgruppe
        </span>
        {MODES.map(({ id, icon: Icon }) => {
          const meta = SCAN_LEAD_MODE_LABELS[id];
          const isActive = activeMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={meta.description}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                isActive
                  ? "border-sky-400/50 bg-sky-400/20 text-white"
                  : "border-white/15 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-3.5 w-3.5 text-sky-400" aria-hidden />
              {meta.title}
              {id === "all_new" && (
                <span className="rounded-full bg-sky-400/30 px-1.5 py-0.5 text-[9px] font-bold text-sky-50">
                  Anbefalt
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
