"use client";

import { useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PipelineCard } from "./PipelineCard";
import type { PipelineItem } from "./types";

type Props = {
  statusId: string;
  label: string;
  colorClass: string;
  items: PipelineItem[];
  onOpenCard: (item: PipelineItem, section?: "notes") => void;
};

export function PipelineColumn({
  statusId,
  label,
  colorClass,
  items,
  onOpenCard,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId });

  return (
    <div className="pipeline-column flex w-[260px] shrink-0 flex-col snap-center sm:w-[280px]">
      <div className="pipeline-column-header mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", colorClass)} />
        <h3 className="truncate text-sm font-medium text-zinc-200">{label}</h3>
        <span className="ml-auto tabular-nums text-xs text-zinc-500">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "pipeline-column-body min-h-[140px] flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0f0f0f]/80 p-2 transition-colors",
          isOver && "border-emerald-400/35 bg-emerald-500/[0.04]"
        )}
      >
        {items.map((item) => (
          <PipelineCard key={item.lead.orgnr} item={item} onOpen={onOpenCard} />
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
            <p className="text-xs text-zinc-600">Slipp her</p>
            {statusId === "ny" && (
              <Link
                href="/app"
                className="mt-2 text-xs font-medium text-emerald-400/90 hover:text-emerald-300"
              >
                Fra Skann
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
