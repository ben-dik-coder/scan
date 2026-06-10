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
  disabled?: boolean;
};

export function ScanLeadModes({ activeMode, onSelect, disabled = false }: Props) {
  return (
    <div className="scan-segmented scan-lead-modes max-w-full overflow-x-auto" role="tablist" aria-label="Lead-modus">
      {MODES.map(({ id, icon: Icon }) => {
        const meta = SCAN_LEAD_MODE_LABELS[id];
        const isActive = activeMode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            disabled={disabled}
            title={meta.description}
            className={cn(
              "scan-segmented-item shrink-0 touch-manipulation",
              isActive && "scan-segmented-item-active",
              disabled && "pointer-events-none opacity-60"
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {meta.title}
          </button>
        );
      })}
    </div>
  );
}
