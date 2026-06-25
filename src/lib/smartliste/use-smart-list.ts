"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SmartListBoard,
  SmartListBoardConfig,
  SmartListItemPatch,
  SmartListRow,
  SmartListViewMode,
} from "@/lib/smartliste/types";

const SELECTED_LIST_KEY = "smartliste-selected-list-id";

export function useSmartList(initialListId?: string | null) {
  const [lists, setLists] = useState<SmartListRow[]>([]);
  const [board, setBoard] = useState<SmartListBoard | null>(null);
  const [listId, setListIdState] = useState<string | null>(initialListId ?? null);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setListId = useCallback((id: string | null) => {
    setListIdState(id);
    if (id) localStorage.setItem(SELECTED_LIST_KEY, id);
    else localStorage.removeItem(SELECTED_LIST_KEY);
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    setError(null);
    try {
      const res = await fetch("/api/smartliste");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente lister");
      setLists(data.lists ?? []);
      return data.lists as SmartListRow[];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feil ved henting av lister");
      return [];
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const loadBoard = useCallback(async (id: string) => {
    setLoadingBoard(true);
    setError(null);
    try {
      const res = await fetch(`/api/smartliste/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente liste");
      setBoard(data as SmartListBoard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feil ved henting av tavle");
      setBoard(null);
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    void refreshLists().then((rows) => {
      const stored = localStorage.getItem(SELECTED_LIST_KEY);
      const pick =
        initialListId ??
        stored ??
        rows[0]?.id ??
        null;
      if (pick) setListIdState(pick);
    });
  }, [initialListId, refreshLists]);

  useEffect(() => {
    if (!listId) {
      setBoard(null);
      return;
    }
    void loadBoard(listId);
  }, [listId, loadBoard]);

  const createList = useCallback(
    async (name: string) => {
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch("/api/smartliste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke opprette liste");
        await refreshLists();
        setListId(data.id);
        return data.id as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke opprette liste");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [refreshLists, setListId]
  );

  const deleteList = useCallback(
    async (id: string) => {
      setSyncing(true);
      try {
        const res = await fetch(`/api/smartliste/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Kunne ikke slette");
        }
        const nextLists = await refreshLists();
        if (listId === id) {
          setListId(nextLists[0]?.id ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke slette liste");
      } finally {
        setSyncing(false);
      }
    },
    [listId, refreshLists, setListId]
  );

  const patchItems = useCallback(
    async (patches: SmartListItemPatch[]) => {
      if (!listId || patches.length === 0) return;
      setSyncing(true);
      try {
        const res = await fetch(`/api/smartliste/${listId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patches }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke lagre");
        setBoard(data as SmartListBoard);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lagre endringer");
      } finally {
        setSyncing(false);
      }
    },
    [listId]
  );

  const rankList = useCallback(async () => {
    if (!listId) return;
    setRanking(true);
    setError(null);
    try {
      const res = await fetch(`/api/smartliste/${listId}/rank`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke rangere");
      setBoard(data.board as SmartListBoard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke rangere liste");
    } finally {
      setRanking(false);
    }
  }, [listId]);

  const summarizeItems = useCallback(
    async (itemIds: string[]) => {
      if (!listId || itemIds.length === 0) return 0;
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch(`/api/smartliste/${listId}/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke oppsummere");
        setBoard(data.board as SmartListBoard);
        return (data.summarized as number) ?? 0;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lage AI-oppsummering");
        return 0;
      } finally {
        setSyncing(false);
      }
    },
    [listId]
  );

  const updateBoardConfig = useCallback(
    async (patch: Partial<SmartListBoardConfig>) => {
      if (!listId || !board) return;
      const board_config = { ...board.list.board_config, ...patch };
      setBoard({ ...board, list: { ...board.list, board_config } });
      setSyncing(true);
      try {
        const res = await fetch(`/api/smartliste/${listId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board_config }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke lagre innstillinger");
        setBoard(data as SmartListBoard);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lagre innstillinger");
      } finally {
        setSyncing(false);
      }
    },
    [board, listId]
  );

  const createLabel = useCallback(
    async (name: string, color: string) => {
      if (!listId) return null;
      setSyncing(true);
      try {
        const res = await fetch(`/api/smartliste/${listId}/labels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke opprette merkelapp");
        await loadBoard(listId);
        return data.id as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke opprette merkelapp");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [listId, loadBoard]
  );

  const setViewMode = useCallback(
    (mode: SmartListViewMode) => {
      void updateBoardConfig({ defaultView: mode });
    },
    [updateBoardConfig]
  );

  return {
    lists,
    board,
    listId,
    setListId,
    loadingLists,
    loadingBoard,
    ranking,
    syncing,
    error,
    setError,
    refreshLists,
    loadBoard,
    createList,
    deleteList,
    patchItems,
    rankList,
    summarizeItems,
    updateBoardConfig,
    createLabel,
    setViewMode,
  };
}
