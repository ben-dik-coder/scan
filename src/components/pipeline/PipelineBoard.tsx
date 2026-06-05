"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { LeadStatus } from "@/types/database";
import { PipelineCard } from "./PipelineCard";
import { PipelineColumn } from "./PipelineColumn";
import { PipelineClosedSection } from "./PipelineClosedSection";
import type { PipelineItem } from "./types";
import { ACTIVE_PIPELINE_STATUSES } from "./types";

type Props = {
  items: PipelineItem[];
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
  onOpenCard: (item: PipelineItem, section?: "notes") => void;
};

export function PipelineBoard({ items, onStatusChange, onOpenCard }: Props) {
  const [activeItem, setActiveItem] = useState<PipelineItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columns = useMemo(
    () =>
      LEAD_STATUSES.filter((s) =>
        (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(s.id)
      ),
    []
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
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 snap-x snap-mandatory md:mx-0 md:px-0">
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

      <DragOverlay>
        {activeItem ? (
          <PipelineCard item={activeItem} onOpen={() => {}} isDragOverlay />
        ) : null}
      </DragOverlay>

      <PipelineClosedSection
        items={items}
        onOpenCard={onOpenCard}
        onStatusChange={onStatusChange}
      />
    </DndContext>
  );
}
