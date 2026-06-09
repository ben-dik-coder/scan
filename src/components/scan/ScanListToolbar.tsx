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
    <div className="scan-glass-divider space-y-3 border-t px-3 py-3 lg:px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="scan-segmented min-w-0 max-w-full overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "scan-segmented-item",
                  activeTab === tab.id && "scan-segmented-item-active"
                )}
              >
                <TabIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="tabular-nums opacity-70">{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="scan-segmented hidden shrink-0 md:inline-flex">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "scan-segmented-item scan-segmented-icon px-2",
              listViewMode === "table" && "scan-segmented-item-active"
            )}
            aria-pressed={listViewMode === "table"}
            aria-label="Tabellvisning"
            title="Tabell"
          >
            <Table2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "scan-segmented-item scan-segmented-icon px-2",
              listViewMode === "cards" && "scan-segmented-item-active"
            )}
            aria-pressed={listViewMode === "cards"}
            aria-label="Kortvisning"
            title="Kort"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
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
