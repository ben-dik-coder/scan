import { agentOrgnrsFromFilters } from "@/lib/agent/saved-list-filters";
import { createClient } from "@/lib/supabase/server";
import type { ListMember, ListMembersResponse } from "@/domain/list";
import type { SavedList } from "@/types/database";

function normalizeOrgnrs(orgnrs: string[]): string[] {
  return [...new Set(orgnrs.map((o) => o.trim()).filter(Boolean))];
}

async function assertListOwner(listId: string, userId: string): Promise<SavedList> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listen finnes ikke");
  return data as SavedList;
}

/** Server-side: alle orgnr for en liste (filters + smart_list_items). */
export async function resolveListMembers(
  userId: string,
  listId: string,
  options?: { shuffle?: boolean }
): Promise<ListMembersResponse> {
  const list = await assertListOwner(listId, userId);
  const supabase = await createClient();

  const fromFilters = normalizeOrgnrs(agentOrgnrsFromFilters(list.filters));
  if (fromFilters.length > 0) {
    let orgnrs = fromFilters;
    if (options?.shuffle) {
      orgnrs = [...orgnrs].sort(() => Math.random() - 0.5);
    }
    return {
      listId: list.id,
      name: list.name,
      orgnrs,
      members: orgnrs.map((orgnr) => ({ orgnr, listId: list.id })),
    };
  }

  const { data: itemRows, error } = await supabase
    .from("smart_list_items")
    .select("orgnr, lane_id, sort_order, added_at")
    .eq("list_id", listId)
    .order("sort_order");

  if (error) throw new Error(error.message);

  const members: ListMember[] = (itemRows ?? []).map((row) => ({
    orgnr: row.orgnr as string,
    listId,
    laneId: row.lane_id as string | null,
    sortOrder: row.sort_order as number,
    addedAt: row.added_at as string,
  }));

  let orgnrs = normalizeOrgnrs(members.map((m) => m.orgnr));
  if (options?.shuffle) {
    orgnrs = [...orgnrs].sort(() => Math.random() - 0.5);
  }

  return {
    listId: list.id,
    name: list.name,
    orgnrs,
    members,
  };
}

export async function listUserLists(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .select("id, name, filters, list_kind, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const lists = data ?? [];
  const counts = await Promise.all(
    lists.map(async (list) => {
      const resolved = await resolveListMembers(userId, list.id as string);
      return resolved.orgnrs.length;
    })
  );

  return lists.map((list, index) => ({
    id: list.id as string,
    name: list.name as string,
    memberCount: counts[index] ?? 0,
    listKind: (list.list_kind as string) ?? "static",
    createdAt: list.created_at as string,
    updatedAt: (list.updated_at as string) ?? (list.created_at as string),
  }));
}
