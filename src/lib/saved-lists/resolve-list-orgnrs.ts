import {
  agentOrgnrsFromFilters,
  shuffledAgentOrgnrsFromFilters,
  type AgentSavedListFilters,
} from "@/lib/agent/saved-list-filters";
import { isDemoMode } from "@/lib/demo/config";
import type { SavedList } from "@/types/database";

export type ResolvedListOrgnrs = {
  listId: string;
  name: string;
  orgnrs: string[];
};

/** Trim og dedupliser orgnr slik at filtrering matcher køen. */
export function normalizeOrgnrList(orgnrs: string[]): string[] {
  return [...new Set(orgnrs.map((o) => o.trim()).filter(Boolean))];
}

/** Synkront: orgnr fra filters.agentOrgnrs (Skann-lister). */
export function orgnrsFromSavedListFilters(
  filters: AgentSavedListFilters | Record<string, unknown> | null | undefined
): string[] {
  return agentOrgnrsFromFilters(filters);
}

/** Antall firma i liste — filters først, ellers ukjent (null). */
export function savedListCountHint(
  filters: AgentSavedListFilters | Record<string, unknown> | null | undefined
): number | null {
  const fromFilters = agentOrgnrsFromFilters(filters);
  return fromFilters.length > 0 ? fromFilters.length : null;
}

async function fetchSmartListOrgnrs(listId: string): Promise<string[]> {
  const res = await fetch(`/api/smartliste/${encodeURIComponent(listId)}`);
  if (!res.ok) return [];
  const board = (await res.json()) as { items?: { orgnr: string }[] };
  return normalizeOrgnrList(
    (board.items ?? [])
      .map((i) => i.orgnr)
      .filter((o) => typeof o === "string")
  );
}

/**
 * Hent alle orgnr for en lagret liste — støtter både Skann (agentOrgnrs)
 * og Smartliste (smart_list_items).
 */
export async function resolveListOrgnrs(
  listId: string,
  options?: { demoLists?: SavedList[]; shuffle?: boolean }
): Promise<ResolvedListOrgnrs | null> {
  if (isDemoMode() && options?.demoLists) {
    const row = options.demoLists.find((l) => l.id === listId);
    if (!row) return null;
    const orgnrs = normalizeOrgnrList(
      options.shuffle
        ? shuffledAgentOrgnrsFromFilters(row.filters)
        : agentOrgnrsFromFilters(row.filters)
    );
    return { listId, name: row.name, orgnrs };
  }

  const listRes = await fetch(`/api/saved-lists?id=${encodeURIComponent(listId)}`);
  if (!listRes.ok) return null;
  const list = (await listRes.json()) as {
    id: string;
    name: string;
    filters?: Record<string, unknown>;
  };

  const fromFilters = normalizeOrgnrList(
    options?.shuffle
      ? shuffledAgentOrgnrsFromFilters(list.filters)
      : agentOrgnrsFromFilters(list.filters)
  );

  if (fromFilters.length > 0) {
    return { listId: list.id, name: list.name, orgnrs: fromFilters };
  }

  const orgnrs = await fetchSmartListOrgnrs(listId);
  return { listId: list.id, name: list.name, orgnrs: normalizeOrgnrList(orgnrs) };
}
