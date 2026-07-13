"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { AppleButton, AppleRow, AppleSection, AppleSheet } from "@/components/apple";
import { SavedListPicker } from "@/components/saved-lists/SavedListPicker";
import { useWorkQueue } from "@/hooks/useWorkQueue";
import { formatCompanyName } from "@/lib/utils";
import { useMemo, useState } from "react";

function SortableQueueRow({
  orgnr,
  name,
}: {
  orgnr: string;
  name: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: orgnr,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="apple-row">
      <button
        type="button"
        className="text-[var(--apple-label-tertiary)]"
        {...attributes}
        {...listeners}
        aria-label="Dra for å sortere"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="apple-row-title truncate">{formatCompanyName(name)}</div>
        <div className="apple-row-subtitle">{orgnr}</div>
      </div>
    </div>
  );
}

export function WorkQueuePanel() {
  const {
    v2,
    queues,
    queueId,
    setQueueId,
    items,
    loading,
    busy,
    createQueue,
    loadFromList,
    reorder,
    removeFromQueue,
    reload,
  } = useWorkQueue();

  const [newQueueOpen, setNewQueueOpen] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [loadListOpen, setLoadListOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orgnrs = useMemo(() => items.map((i) => i.orgnr), [items]);

  if (!v2) return null;

  async function handleCreateQueue() {
    if (!newQueueName.trim()) return;
    await createQueue(newQueueName.trim());
    setNewQueueName("");
    setNewQueueOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orgnrs.indexOf(String(active.id));
    const newIndex = orgnrs.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orgnrs, oldIndex, newIndex);
    void reorder(next);
  }

  return (
    <div className="apple-ui">
      <AppleSection title="Mine køer">
        {queues.map((q) => (
          <AppleRow
            key={q.id}
            title={q.name}
            subtitle={`${q.itemCount} firma`}
            onClick={() => setQueueId(q.id)}
            trailing={
              queueId === q.id ? (
                <span className="text-xs font-semibold text-[var(--apple-tint)]">Aktiv</span>
              ) : null
            }
          />
        ))}
        <div className="flex flex-wrap gap-2 p-3">
          <AppleButton variant="secondary" onClick={() => setNewQueueOpen(true)}>
            <Plus className="h-4 w-4" />
            Ny kø
          </AppleButton>
          <AppleButton variant="secondary" onClick={() => setLoadListOpen(true)}>
            Last inn liste
          </AppleButton>
          <AppleButton variant="secondary" onClick={() => void reload()}>
            Oppdater
          </AppleButton>
        </div>
      </AppleSection>

      <AppleSection title="Rekkefølge i kø">
        {loading ? (
          <p className="p-4 text-sm text-[var(--apple-label-secondary)]">Laster…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-[var(--apple-label-secondary)]">
            Køen er tom. Legg til firma fra en liste.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orgnrs} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <div key={item.orgnr} className="group relative">
                  <SortableQueueRow orgnr={item.orgnr} name={item.name} />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--apple-danger)] opacity-0 group-hover:opacity-100"
                    onClick={() => void removeFromQueue([item.orgnr])}
                    aria-label="Fjern fra kø"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </AppleSection>

      <AppleSheet open={newQueueOpen} onClose={() => setNewQueueOpen(false)} title="Ny kø">
        <input
          className="mb-3 w-full rounded-[var(--apple-radius-sm)] border border-[var(--apple-separator)] bg-[var(--apple-bg-grouped)] px-3 py-2"
          placeholder="Navn på køen"
          value={newQueueName}
          onChange={(e) => setNewQueueName(e.target.value)}
        />
        <AppleButton disabled={busy} onClick={() => void handleCreateQueue()}>
          Opprett
        </AppleButton>
      </AppleSheet>

      <AppleSheet open={loadListOpen} onClose={() => setLoadListOpen(false)} title="Last liste inn i kø">
        <p className="mb-3 text-sm text-[var(--apple-label-secondary)]">
          Velg en liste — alle firma legges i aktiv kø.
        </p>
        <SavedListPicker
          mode="queue"
          loading={busy}
          onLoad={async (orgnrs, listName) => {
            if (!queueId) return;
            const listsRes = await fetch("/api/smartliste");
            const data = (await listsRes.json()) as { lists?: { id: string; name: string }[] };
            const match = data.lists?.find((l) => l.name === listName);
            if (match) {
              await loadFromList(match.id, true);
            } else if (orgnrs.length > 0) {
              const res = await fetch(`/api/queues/${encodeURIComponent(queueId)}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgnrs }),
              });
              if (res.ok) await reload();
            }
            setLoadListOpen(false);
          }}
        />
      </AppleSheet>
    </div>
  );
}
