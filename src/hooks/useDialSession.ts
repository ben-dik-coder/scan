"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { isNyleadV2Enabled } from "@/lib/features/v2";
import { resolveListOrgnrs } from "@/lib/saved-lists/resolve-list-orgnrs";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
  type QueueItemResponse,
} from "@/lib/sales/queue-score";
import type { DialChannel, DialLead } from "@/domain/queue";

const FETCH_TIMEOUT_MS = 30_000;

export type DialSourceMode = "queue" | "list";

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

function recentCompaniesLast30Days<T extends { registered_at: string | null }>(
  companies: T[]
): T[] {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  return companies.filter((c) => c.registered_at && c.registered_at >= sinceStr);
}

type Options = {
  channel: DialChannel;
  defaultSource?: DialSourceMode;
};

export function useDialSession({ channel, defaultSource = "queue" }: Options) {
  const v2 = isNyleadV2Enabled();
  const demo = useDemo();
  const searchParams = useSearchParams();
  const pendingListeRef = useRef<string | null | undefined>(undefined);
  const loadedListIdRef = useRef<string | null>(null);

  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedOrgnrs, setSkippedOrgnrs] = useState<Set<string>>(new Set());
  const [sourceMode, setSourceMode] = useState<DialSourceMode>(defaultSource);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listOrgnrs, setListOrgnrs] = useState<Set<string> | null>(null);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [resolvingList, setResolvingList] = useState(false);

  const loadLegacy = useCallback(async () => {
    if (isDemoMode()) {
      const recent = recentCompaniesLast30Days(demo.companies);
      const leadsByOrgnr = new Map(
        recent
          .filter((c) => c.user_lead?.queued_at)
          .map((c) => [c.orgnr, c.user_lead!])
      );
      const queuedCompanies = recent.filter((c) => leadsByOrgnr.has(c.orgnr));
      const candidates = buildQueueCandidates(queuedCompanies, leadsByOrgnr, new Map());
      setItems(mapQueueCandidatesToItems(candidates));
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/ko", { signal: controller.signal });
      const data = (await res.json()) as { items?: QueueItemResponse[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste kø");
      setItems(data.items ?? []);
    } finally {
      clearTimeout(timeout);
    }
  }, [demo.companies]);

  const loadV2 = useCallback(async () => {
    if (sourceMode === "list" && selectedListId) {
      const qs = channel === "ring" ? "?shuffle=1" : "";
      const res = await fetch(
        `/api/lists/${encodeURIComponent(selectedListId)}/dial${qs}`
      );
      const data = (await res.json()) as { items?: DialLead[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste liste");
      setItems((data.items ?? []).map(dialToLegacy));
      return;
    }

    let targetQueueId = queueId;
    if (!targetQueueId) {
      const queuesRes = await fetch("/api/queues");
      const queuesData = (await queuesRes.json()) as {
        queues?: { id: string; isDefault: boolean }[];
      };
      const def =
        queuesData.queues?.find((q) => q.isDefault) ?? queuesData.queues?.[0];
      targetQueueId = def?.id ?? null;
      if (targetQueueId) setQueueId(targetQueueId);
    }

    if (!targetQueueId) {
      setItems([]);
      return;
    }

    const res = await fetch(`/api/queues/${encodeURIComponent(targetQueueId)}`);
    const data = (await res.json()) as { items?: DialLead[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste kø");
    setItems((data.items ?? []).map(dialToLegacy));
  }, [sourceMode, selectedListId, queueId, channel]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (v2) await loadV2();
      else await loadLegacy();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Forespørselen tok for lang tid.");
      } else {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      }
    } finally {
      setLoading(false);
    }
  }, [v2, loadV2, loadLegacy]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const listId = searchParams.get("liste");
    if (!listId) {
      if (pendingListeRef.current === null) {
        pendingListeRef.current = undefined;
        return;
      }
      if (pendingListeRef.current !== undefined) return;
      if (loadedListIdRef.current !== null) {
        loadedListIdRef.current = null;
        setSelectedListId(null);
        setListOrgnrs(null);
        setSelectedListName(null);
        if (v2) setSourceMode("queue");
      }
      return;
    }

    if (pendingListeRef.current === listId) {
      pendingListeRef.current = undefined;
      if (loadedListIdRef.current === listId) return;
    }
    if (loadedListIdRef.current === listId) return;

    setResolvingList(true);
    void resolveListOrgnrs(listId, { demoLists: demo.savedLists, shuffle: channel === "ring" })
      .then((resolved) => {
        if (!resolved) {
          loadedListIdRef.current = null;
          setSelectedListId(null);
          setListOrgnrs(null);
          setSelectedListName(null);
          return;
        }
        loadedListIdRef.current = listId;
        setSelectedListId(listId);
        setListOrgnrs(new Set(resolved.orgnrs));
        setSelectedListName(resolved.name);
        if (v2) {
          setSourceMode("list");
        }
      })
      .finally(() => setResolvingList(false));
  }, [searchParams, demo.savedLists, channel, v2]);

  const filteredItems = useMemo(() => {
    if (!v2 && listOrgnrs) {
      return items.filter((i) => listOrgnrs.has(i.orgnr));
    }
    if (v2 && sourceMode === "list" && selectedListId) {
      return items;
    }
    if (v2 && sourceMode === "queue") {
      return items;
    }
    if (listOrgnrs) return items.filter((i) => listOrgnrs.has(i.orgnr));
    return items;
  }, [items, listOrgnrs, v2, sourceMode, selectedListId]);

  const dialQueue = useMemo(
    () =>
      filteredItems.filter(
        (i) =>
          i.status === "ny" &&
          Boolean(i.phone?.trim()) &&
          !skippedOrgnrs.has(i.orgnr)
      ),
    [filteredItems, skippedOrgnrs]
  );

  const current = dialQueue[0] ?? null;

  const skipCurrent = useCallback(() => {
    if (!current) return;
    setSkippedOrgnrs((prev) => new Set(prev).add(current.orgnr));
  }, [current]);

  const resetSkipped = useCallback(() => {
    setSkippedOrgnrs(new Set());
  }, []);

  const clearListFilter = useCallback(() => {
    loadedListIdRef.current = null;
    pendingListeRef.current = null;
    setSelectedListId(null);
    setListOrgnrs(null);
    setSelectedListName(null);
    if (v2) setSourceMode("queue");
  }, [v2]);

  const selectList = useCallback(
    async (listId: string | null, shuffle = false) => {
      if (!listId) {
        clearListFilter();
        return;
      }
      setResolvingList(true);
      try {
        const resolved = await resolveListOrgnrs(listId, {
          demoLists: demo.savedLists,
          shuffle,
        });
        if (!resolved) return;
        loadedListIdRef.current = listId;
        setSelectedListId(listId);
        setListOrgnrs(new Set(resolved.orgnrs));
        setSelectedListName(resolved.name);
        if (v2) setSourceMode("list");
      } finally {
        setResolvingList(false);
      }
    },
    [clearListFilter, demo.savedLists, v2]
  );

  return {
    v2,
    channel,
    items: filteredItems,
    dialQueue,
    current,
    loading,
    error,
    reload: load,
    skippedOrgnrs,
    skipCurrent,
    sourceMode,
    setSourceMode,
    queueId,
    setQueueId,
    selectedListId,
    selectedListName,
    listOrgnrs,
    resolvingList,
    selectList,
    clearListFilter,
    pendingListeRef,
    loadedListIdRef,
    resetSkipped,
  };
}
