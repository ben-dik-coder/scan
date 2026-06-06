"use client";

import { cn } from "@/lib/utils";
import { Download, LayoutGrid, ListTodo, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = {
  id: "all" | "no_website" | "with_website" | "not_scanned";
  label: string;
  shortLabel: string;
  count: number;
  icon: LucideIcon;
};

type Props = {
  tabs: Tab[];
  activeTab: Tab["id"];
  onTabChange: (id: Tab["id"]) => void;
  listViewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  summary: string;
  selectedCount: number;
  addingToQueue: boolean;
  exporting: boolean;
  onAddToQueue: () => void;
  onExportCsv: () => void;
  exportMessage: string | null;
};

export function ScanListToolbar({
  tabs,
  activeTab,
  onTabChange,
  listViewMode,
  onViewModeChange,
  summary,
  selectedCount,
  addingToQueue,
  exporting,
  onAddToQueue,
  onExportCsv,
  exportMessage,
}: Props) {
  return (
    <div className="scan-glass-divider space-y-2 border-t px-2.5 py-2 lg:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-0.5 flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn("scan-tab", activeTab === tab.id && "scan-tab-active")}
              >
                <TabIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="tabular-nums font-semibold">{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="hidden items-center gap-0.5 rounded-xl border border-white/15 p-0.5 md:flex">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
              listViewMode === "table" && "bg-white/12 text-white"
            )}
            aria-pressed={listViewMode === "table"}
          >
            <Table2 className="h-3 w-3" />
            Tabell
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
              listViewMode === "cards" && "bg-white/12 text-white"
            )}
            aria-pressed={listViewMode === "cards"}
          >
            <LayoutGrid className="h-3 w-3" />
            Kort
          </button>
        </div>
      </div>

      <p className="scan-glass-muted text-xs">{summary}</p>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onAddToQueue}
            disabled={addingToQueue}
            className="scan-btn-primary inline-flex items-center gap-1 text-xs font-semibold"
          >
            <ListTodo className="h-3.5 w-3.5" />
            {addingToQueue ? "Legger i kø…" : `Legg ${selectedCount} i kø`}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exporting}
            className="scan-btn-ghost inline-flex items-center gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Eksporterer…" : "CSV"}
          </button>
          {exportMessage && (
            <span className="text-xs text-emerald-300">{exportMessage}</span>
          )}
        </div>
      )}
    </div>
  );
}
