"use client";

import { useDroppable } from "@dnd-kit/core";
import { laneHeaderClass } from "@/lib/smartliste/board-config";
import type { SmartListCard, SmartListLane } from "@/lib/smartliste/types";
import { cn } from "@/lib/utils";
import { SmartlisteCard } from "./SmartlisteCard";

type Props = {
  lane: SmartListLane;
  items: SmartListCard[];
  selectedIds: Set<string>;
  compact?: boolean;
  onSelect: (card: SmartListCard, additive: boolean) => void;
  onOpen: (card: SmartListCard) => void;
};

export function SmartlisteLane({
  lane,
  items,
  selectedIds,
  compact,
  onSelect,
  onOpen,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });

  return (
    <div className="smartliste-lane">
      <div className="smartliste-lane-header">
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", laneHeaderClass(lane.color))}
          style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "9999px" }}
        />
        <h3>{lane.name}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#94a3b8" }}>{items.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn("smartliste-lane-body", isOver && "is-over")}
      >
        {items.map((item) => (
          <SmartlisteCard
            key={item.id}
            card={item}
            selected={selectedIds.has(item.id)}
            compact={compact}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
            <p className="text-xs text-slate-500">Slipp kort her</p>
          </div>
        )}
      </div>
    </div>
  );
}
