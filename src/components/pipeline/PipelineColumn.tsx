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
    <div className="pipeline-column flex w-[280px] shrink-0 flex-col snap-center sm:w-[300px]">
      <div className="pipeline-column-header mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", colorClass)} />
        <h3 className="truncate text-sm font-semibold text-slate-100">{label}</h3>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-300">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "pipeline-column-body min-h-[120px] flex-1 space-y-2 rounded-lg border p-2 transition-colors",
          isOver && "border-brand-gold/40 bg-brand-gold/5"
        )}
      >
        {items.map((item) => (
          <PipelineCard key={item.lead.orgnr} item={item} onOpen={onOpenCard} />
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-2 py-8 text-center">
            <p className="text-xs text-slate-500">Slipp leads her</p>
            {statusId === "ny" && (
              <Link
                href="/app"
                className="mt-2 text-xs font-semibold text-brand-gold underline hover:text-amber-300"
              >
                Legg til fra Skann
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
