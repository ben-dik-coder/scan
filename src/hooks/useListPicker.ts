"use client";

import { useCallback, useEffect, useState } from "react";
import { SAVED_LIST_CHANGED_EVENT } from "@/lib/agent/saved-list-bus";
import { isDemoMode } from "@/lib/demo/config";
import { isNyleadV2Enabled } from "@/lib/features/v2";
import { useDemo } from "@/lib/demo/store";
import type { SavedList } from "@/types/database";

export type ListPickerRow = {
  id: string;
  name: string;
  memberCount: number | null;
};

export function useListPicker() {
  const demo = useDemo();
  const v2 = isNyleadV2Enabled();
  const [lists, setLists] = useState<ListPickerRow[]>([]);
  const [loading, setLoading] = useState(!isDemoMode());

  const load = useCallback(async () => {
    if (isDemoMode()) {
      setLists(
        demo.savedLists.map((l) => ({
          id: l.id,
          name: l.name,
          memberCount: null,
        }))
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (v2) {
        const res = await fetch("/api/smartliste");
        const data = (await res.json()) as {
          lists?: { id: string; name: string }[];
        };
        const rows = data.lists ?? [];
        const withCounts = await Promise.all(
          rows.map(async (row) => {
            const mRes = await fetch(`/api/lists/${encodeURIComponent(row.id)}/members`);
            if (!mRes.ok) return { ...row, memberCount: null };
            const m = (await mRes.json()) as { orgnrs?: string[] };
            return { ...row, memberCount: m.orgnrs?.length ?? 0 };
          })
        );
        setLists(withCounts);
        return;
      }

      const res = await fetch("/api/saved-lists");
      const data = (await res.json()) as { lists?: SavedList[] };
      setLists(
        (data.lists ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          memberCount: null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [demo.savedLists, v2]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onChange);
  }, [load]);

  return { lists, loading, reload: load, v2 };
}
