"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkQueue } from "@/domain/queue";
import type { DialLead } from "@/domain/queue";
import { isNyleadV2Enabled } from "@/lib/features/v2";
import type { QueueItemResponse } from "@/lib/sales/queue-score";

function dialToLegacy(item: DialLead): QueueItemResponse {
  return {
    orgnr: item.orgnr,
    name: item.name,
    email: item.email,
    phone: item.phone,
    municipalityName: item.municipalityName,
    registeredAt: item.registeredAt,
    status: item.status,
    queueScore: item.queueScore,
    daysSinceRegistration: item.daysSinceRegistration,
    hasWebsite: item.hasWebsite,
    websiteKind: item.websiteKind,
    dagligLeder: item.dagligLeder,
  };
}

export function useWorkQueue(initialQueueId?: string | null) {
  const v2 = isNyleadV2Enabled();
  const [queues, setQueues] = useState<WorkQueue[]>([]);
  const [queueId, setQueueId] = useState<string | null>(initialQueueId ?? null);
  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadQueues = useCallback(async () => {
    if (!v2) return;
    const res = await fetch("/api/queues");
    const data = (await res.json()) as { queues?: WorkQueue[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente køer");
    const list = data.queues ?? [];
    setQueues(list);
    if (!queueId && list.length > 0) {
      const def = list.find((q) => q.isDefault) ?? list[0];
      setQueueId(def.id);
    }
  }, [v2, queueId]);

  const loadItems = useCallback(
    async (targetQueueId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        if (v2) {
          const id = targetQueueId ?? queueId;
          if (!id) {
            await loadQueues();
            setItems([]);
            return;
          }
          const res = await fetch(`/api/queues/${encodeURIComponent(id)}`);
          const data = (await res.json()) as {
            items?: DialLead[];
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente kø");
          setItems((data.items ?? []).map(dialToLegacy));
          return;
        }

        const res = await fetch("/api/ko");
        const data = (await res.json()) as {
          items?: QueueItemResponse[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente kø");
        setItems(data.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      } finally {
        setLoading(false);
      }
    },
    [v2, queueId, loadQueues]
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const createQueue = useCallback(async (name: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { queue?: WorkQueue; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke opprette kø");
      await loadQueues();
      if (data.queue) setQueueId(data.queue.id);
      return data.queue ?? null;
    } finally {
      setBusy(false);
    }
  }, [loadQueues]);

  const addToQueue = useCallback(
    async (orgnrs: string[], targetQueueId?: string) => {
      const id = targetQueueId ?? queueId;
      if (!v2 || !id) return 0;
      setBusy(true);
      try {
        const res = await fetch(`/api/queues/${encodeURIComponent(id)}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgnrs }),
        });
        const data = (await res.json()) as {
          items?: DialLead[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke legge til");
        setItems((data.items ?? []).map(dialToLegacy));
        return orgnrs.length;
      } finally {
        setBusy(false);
      }
    },
    [v2, queueId]
  );

  const loadFromList = useCallback(
    async (listId: string, replace = false) => {
      if (!v2 || !queueId) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/queues/${encodeURIComponent(queueId)}/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId, replace }),
        });
        const data = (await res.json()) as {
          items?: DialLead[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste liste");
        setItems((data.items ?? []).map(dialToLegacy));
      } finally {
        setBusy(false);
      }
    },
    [v2, queueId]
  );

  const reorder = useCallback(
    async (orderedOrgnrs: string[]) => {
      if (!v2 || !queueId) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/queues/${encodeURIComponent(queueId)}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedOrgnrs }),
        });
        const data = (await res.json()) as {
          items?: DialLead[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke sortere");
        setItems((data.items ?? []).map(dialToLegacy));
      } finally {
        setBusy(false);
      }
    },
    [v2, queueId]
  );

  const removeFromQueue = useCallback(
    async (orgnrs: string[]) => {
      if (!v2 || !queueId) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/queues/${encodeURIComponent(queueId)}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgnrs }),
        });
        const data = (await res.json()) as {
          items?: DialLead[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke fjerne");
        setItems((data.items ?? []).map(dialToLegacy));
      } finally {
        setBusy(false);
      }
    },
    [v2, queueId]
  );

  return {
    v2,
    queues,
    queueId,
    setQueueId,
    items,
    loading,
    error,
    busy,
    reload: () => loadItems(),
    loadQueues,
    createQueue,
    addToQueue,
    loadFromList,
    reorder,
    removeFromQueue,
  };
}
