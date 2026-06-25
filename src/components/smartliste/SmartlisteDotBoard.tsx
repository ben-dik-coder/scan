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
import { sortLanes } from "@/lib/smartliste/board-config";
import type { SmartListBoard, SmartListCard } from "@/lib/smartliste/types";
import { SmartlisteCard } from "./SmartlisteCard";
import { SmartlisteLane } from "./SmartlisteLane";

type Props = {
  board: SmartListBoard;
  zoom?: number;
  compact?: boolean;
  searchQuery: string;
  selectedIds: Set<string>;
  onSelect: (card: SmartListCard, additive: boolean) => void;
  onOpen: (card: SmartListCard) => void;
  onMoveItems: (itemIds: string[], laneId: string, sortBase: number) => void;
};

export function SmartlisteDotBoard({
  board,
  zoom = 100,
  compact = false,
  searchQuery,
  selectedIds,
  onSelect,
  onOpen,
  onMoveItems,
}: Props) {
  const [activeCard, setActiveCard] = useState<SmartListCard | null>(null);
  const lanes = useMemo(() => sortLanes(board.lanes), [board.lanes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return board.items;
    return board.items.filter((item) => {
      const name = item.company?.name?.toLowerCase() ?? "";
      const orgnr = item.orgnr.toLowerCase();
      const reason = item.ai_score_reason?.toLowerCase() ?? "";
      const labels = item.labels.map((l) => l.name.toLowerCase()).join(" ");
      return name.includes(q) || orgnr.includes(q) || reason.includes(q) || labels.includes(q);
    });
  }, [board.items, searchQuery]);

  const itemsByLane = useMemo(() => {
    const map = new Map<string, SmartListCard[]>();
    for (const lane of lanes) map.set(lane.id, []);
    const unassigned: SmartListCard[] = [];

    for (const item of filteredItems) {
      if (item.lane_id && map.has(item.lane_id)) {
        map.get(item.lane_id)!.push(item);
      } else {
        unassigned.push(item);
      }
    }

    for (const [, items] of map) {
      items.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.sort_order - b.sort_order;
      });
    }

    if (unassigned.length > 0) {
      const newLane = lanes.find((l) => l.name.includes("Uklassifisert"));
      if (newLane) map.get(newLane.id)!.push(...unassigned);
    }

    return map;
  }, [filteredItems, lanes]);

  function handleDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as SmartListCard | undefined;
    if (card) setActiveCard(card);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = active.data.current?.card as SmartListCard | undefined;
    if (!card) return;

    const targetLaneId = String(over.id);
    const laneExists = lanes.some((l) => l.id === targetLaneId);
    if (!laneExists || card.lane_id === targetLaneId) return;

    const targetItems = itemsByLane.get(targetLaneId) ?? [];
    onMoveItems([card.id], targetLaneId, targetItems.length);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="smartliste-dot-grid">
        <div
          className="smartliste-dot-board"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: zoom !== 100 ? `${10000 / zoom}%` : undefined,
          }}
        >
          <div className="smartliste-lanes">
          {lanes.map((lane) => (
            <SmartlisteLane
              key={lane.id}
              lane={lane}
              items={itemsByLane.get(lane.id) ?? []}
              selectedIds={selectedIds}
              compact={compact}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCard ? (
          <SmartlisteCard
            card={activeCard}
            selected={selectedIds.has(activeCard.id)}
            compact={compact}
            onSelect={() => {}}
            onOpen={() => {}}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
