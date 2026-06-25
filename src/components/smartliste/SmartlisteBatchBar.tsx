"use client";

import Link from "next/link";
import type { SmartListCard } from "@/lib/smartliste/types";
import { GitBranch, ListTodo, PhoneCall, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

type Props = {
  selectedCards: SmartListCard[];
  syncing: boolean;
  summarizing?: boolean;
  onClearSelection: () => void;
  onRemoveSelected: () => void;
  onSummarizeSelected: () => void;
  onExportQueue: () => Promise<void>;
  onExportPipeline: () => Promise<void>;
  onExportRing: () => Promise<void>;
};

export function SmartlisteBatchBar({
  selectedCards,
  syncing,
  summarizing = false,
  onClearSelection,
  onRemoveSelected,
  onSummarizeSelected,
  onExportQueue,
  onExportPipeline,
  onExportRing,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const count = selectedCards.length;

  if (count === 0) return null;

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="smartliste-batch-bar">
      <span className="text-sm font-semibold text-slate-200">
        {count} valgt
      </span>
      <button
        type="button"
        onClick={onClearSelection}
        className="text-xs text-slate-400 hover:text-slate-200"
      >
        Nullstill
      </button>

      <div style={{ margin: "0 0.5rem", width: "1px", height: "1rem", background: "rgba(255,255,255,0.1)" }} />

      <button
        type="button"
        disabled={syncing || summarizing || busy !== null}
        onClick={onSummarizeSelected}
        className="smartliste-btn smartliste-btn-primary"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI-oppsummer valgte
      </button>

      <div style={{ margin: "0 0.5rem", width: "1px", height: "1rem", background: "rgba(255,255,255,0.1)" }} />

      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Send utvalg til:</span>

      <button
        type="button"
        disabled={syncing || busy !== null}
        onClick={() => void run("queue", onExportQueue)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
      >
        <ListTodo className="h-3.5 w-3.5" />
        Arbeidskø
      </button>
      <button
        type="button"
        disabled={syncing || busy !== null}
        onClick={() => void run("pipeline", onExportPipeline)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
      >
        <GitBranch className="h-3.5 w-3.5" />
        Pipeline
      </button>
      <Link
        href="/app/ring"
        onClick={(e) => {
          if (syncing || busy) e.preventDefault();
          else void run("ring", onExportRing);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
      >
        <PhoneCall className="h-3.5 w-3.5" />
        Ringemodus
      </Link>

      <div className="flex-1" />

      <button
        type="button"
        disabled={syncing}
        onClick={onRemoveSelected}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Fjern fra liste
      </button>
    </div>
  );
}
