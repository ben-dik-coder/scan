"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { PipelineCard } from "./PipelineCard";
import { PipelineColumn } from "./PipelineColumn";
import { PipelineClosedSection } from "./PipelineClosedSection";
import type { PipelineItem } from "./types";
import { ACTIVE_PIPELINE_STATUSES } from "./types";

type Props = {
  items: PipelineItem[];
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
  onOpenCard: (item: PipelineItem, section?: "notes") => void;
  showNyColumn?: boolean;
  onExpandNy?: () => void;
};

export function PipelineBoard({
  items,
  onStatusChange,
  onOpenCard,
  showNyColumn = false,
  onExpandNy,
}: Props) {
  const [activeItem, setActiveItem] = useState<PipelineItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columns = useMemo(
    () =>
      LEAD_STATUSES.filter((s) => {
        if (!(ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(s.id)) {
          return false;
        }
        if (s.id === "ny" && !showNyColumn) return false;
        return true;
      }),
    [showNyColumn]
  );

  const nyCount = useMemo(
    () => items.filter((i) => i.lead.status === "ny").length,
    [items]
  );

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as PipelineItem | undefined;
    if (item) setActiveItem(item);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const orgnr = String(active.id);
    const newStatus = String(over.id) as LeadStatus;
    const item = items.find((i) => i.lead.orgnr === orgnr);
    if (!item || item.lead.status === newStatus) return;

    if (!(ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(newStatus)) return;

    onStatusChange(orgnr, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex min-h-[420px] gap-3">
        {!showNyColumn && nyCount > 0 ? (
          <NyRail count={nyCount} onExpand={onExpandNy} />
        ) : null}

        <div className="-mx-1 flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
          {columns.map((col) => (
            <PipelineColumn
              key={col.id}
              statusId={col.id}
              label={col.label}
              colorClass={col.color}
              items={items.filter((i) => i.lead.status === col.id)}
              onOpenCard={onOpenCard}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <PipelineCard item={activeItem} onOpen={() => {}} isDragOverlay />
        ) : null}
      </DragOverlay>

      <div className="mt-3">
        <PipelineClosedSection
          items={items}
          onOpenCard={onOpenCard}
          onStatusChange={onStatusChange}
        />
      </div>
    </DndContext>
  );
}

function NyRail({
  count,
  onExpand,
}: {
  count: number;
  onExpand?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "ny" });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onExpand}
      className={cn(
        "pipeline-ny-rail flex w-11 shrink-0 flex-col items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0f0f0f] py-3 text-zinc-500 transition hover:border-white/15 hover:text-zinc-300",
        isOver && "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      )}
      title={`Vis ${count} nye leads — eller slipp her`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
        Ny
      </span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
        {count}
      </span>
    </button>
  );
}
