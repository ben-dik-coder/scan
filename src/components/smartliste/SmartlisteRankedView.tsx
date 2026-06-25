"use client";

import type { SmartListBoard, SmartListCard } from "@/lib/smartliste/types";
import { cn, formatCompanyName } from "@/lib/utils";
import { ScoreRing } from "@/components/ui/primitives";

type Props = {
  board: SmartListBoard;
  searchQuery: string;
  selectedIds: Set<string>;
  onSelect: (card: SmartListCard, additive: boolean) => void;
  onOpen: (card: SmartListCard) => void;
};

export function SmartlisteRankedView({
  board,
  searchQuery,
  selectedIds,
  onSelect,
  onOpen,
}: Props) {
  const q = searchQuery.trim().toLowerCase();
  const items = [...board.items]
    .filter((item) => {
      if (!q) return true;
      const name = item.company?.name?.toLowerCase() ?? "";
      return name.includes(q) || item.orgnr.includes(q);
    })
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  return (
    <div style={{ overflow: "auto", padding: "1rem" }}>
      <table className="smartliste-table">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Firma</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Sone</th>
            <th className="px-3 py-2">Hvorfor</th>
            <th className="px-3 py-2">Merkelapper</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lane = board.lanes.find((l) => l.id === item.lane_id);
            return (
              <tr
                key={item.id}
                className={cn(selectedIds.has(item.id) && "selected")}
                onClick={(e) => onSelect(item, e.metaKey || e.ctrlKey)}
                onDoubleClick={() => onOpen(item)}
              >
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-100">
                    {item.company ? formatCompanyName(item.company.name) : item.orgnr}
                  </p>
                  <p className="text-xs text-slate-500">{item.orgnr}</p>
                </td>
                <td className="px-3 py-3">
                  <ScoreRing score={item.ai_score ?? 0} size="sm" />
                </td>
                <td className="px-3 py-3 text-slate-300">{lane?.name ?? "—"}</td>
                <td className="max-w-xs px-3 py-3 text-xs text-slate-400">
                  {item.ai_score_reason ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">
                  {item.labels.map((l) => l.name).join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">Ingen kort i listen</p>
      )}
    </div>
  );
}

export function SmartlisteInsights({ board }: { board: SmartListBoard }) {
  const { stats } = board;
  const rows = [
    { label: "Totalt", value: stats.total },
    { label: "A-tier (≥75)", value: stats.aTier },
    { label: "Snitt score", value: stats.avgScore },
    { label: "Med telefon", value: stats.withPhone },
    { label: "Uten nettside", value: stats.withoutWebsite },
  ];

  return (
    <div style={{ padding: "1rem" }}>
      <h3 className="smartliste-section-label">Liste-innsikt</h3>
      {rows.map((row) => (
        <div key={row.label} className="smartliste-stat-row">
          <span className="text-sm text-slate-300">{row.label}</span>
          <span className="text-sm font-semibold text-slate-100">{row.value}</span>
        </div>
      ))}

      <div className="pt-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Per sone
        </p>
        {board.lanes.map((lane) => (
          <div key={lane.id} className="mb-1 flex justify-between text-xs text-slate-400">
            <span>{lane.name}</span>
            <span>{stats.byLane[lane.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
