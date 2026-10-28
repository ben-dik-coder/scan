"use client";

import { memo } from "react";
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

function SmartlisteLaneInner({
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
          aria-hidden
        />
        <h3>{lane.name}</h3>
        <span className="smartliste-lane-count">{items.length}</span>
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
          <div className="smartliste-lane-drop">
            <p>Slipp kort her</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const SmartlisteLane = memo(SmartlisteLaneInner);
