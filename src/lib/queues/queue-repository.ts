import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
} from "@/lib/sales/queue-score";
import { createClient } from "@/lib/supabase/server";
import type { DialLead } from "@/domain/queue";
import type { Company, UserLead, WorkQueueItemRow, WorkQueueRow } from "@/types/database";
import { resolveListMembers } from "@/lib/lists/list-repository";

const DEFAULT_QUEUE_NAME = "Min arbeidskø";

function rowToWorkQueue(row: WorkQueueRow, itemCount: number) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sourceListId: row.source_list_id,
    isDefault: row.is_default,
    itemCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function countQueueItems(queueId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("work_queue_items")
    .select("*", { count: "exact", head: true })
    .eq("queue_id", queueId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function syncLegacyQueueIfNeeded(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("work_queues")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: queue, error: queueError } = await supabase
    .from("work_queues")
    .insert({
      user_id: userId,
      name: DEFAULT_QUEUE_NAME,
      is_default: true,
    })
    .select("*")
    .single();

  if (queueError) throw new Error(queueError.message);

  const { data: legacyLeads } = await supabase
    .from("user_leads")
    .select("orgnr, queued_at")
    .eq("user_id", userId)
    .not("queued_at", "is", null)
    .in("status", ["ny", "kontaktet"])
    .order("queued_at", { ascending: false });

  const orgnrs = [...new Set((legacyLeads ?? []).map((l) => l.orgnr as string))];
  if (orgnrs.length > 0) {
    const rows = orgnrs.map((orgnr, index) => ({
      queue_id: queue.id,
      orgnr,
      sort_order: index,
    }));
    const { error: itemsError } = await supabase.from("work_queue_items").upsert(rows, {
      onConflict: "queue_id,orgnr",
      ignoreDuplicates: true,
    });
    if (itemsError) throw new Error(itemsError.message);
  }

  return queue.id as string;
}

export async function listWorkQueues(userId: string) {
  await syncLegacyQueueIfNeeded(userId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_queues")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const queues = (data ?? []) as WorkQueueRow[];
  const withCounts = await Promise.all(
    queues.map(async (row) => rowToWorkQueue(row, await countQueueItems(row.id)))
  );
  return withCounts;
}

export async function createWorkQueue(
  userId: string,
  name: string,
  sourceListId?: string | null
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_queues")
    .insert({
      user_id: userId,
      name: name.trim() || "Ny kø",
      source_list_id: sourceListId ?? null,
      is_default: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToWorkQueue(data as WorkQueueRow, 0);
}

async function assertQueueOwner(queueId: string, userId: string): Promise<WorkQueueRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_queues")
    .select("*")
    .eq("id", queueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Køen finnes ikke");
  return data as WorkQueueRow;
}

export async function deleteWorkQueue(userId: string, queueId: string) {
  const queue = await assertQueueOwner(queueId, userId);
  if (queue.is_default) throw new Error("Kan ikke slette standardkøen");
  const supabase = await createClient();
  const { error } = await supabase.from("work_queues").delete().eq("id", queueId);
  if (error) throw new Error(error.message);
}

export async function renameWorkQueue(userId: string, queueId: string, name: string) {
  await assertQueueOwner(queueId, userId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_queues")
    .update({ name: name.trim() })
    .eq("id", queueId);
  if (error) throw new Error(error.message);
}

export async function addQueueItems(userId: string, queueId: string, orgnrs: string[]) {
  await assertQueueOwner(queueId, userId);
  const unique = [...new Set(orgnrs.map((o) => o.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;

  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("work_queue_items")
    .select("sort_order")
    .eq("queue_id", queueId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = ((maxRow?.sort_order as number) ?? -1) + 1;
  const rows = unique.map((orgnr) => ({
    queue_id: queueId,
    orgnr,
    sort_order: nextOrder++,
  }));

  const { error } = await supabase.from("work_queue_items").upsert(rows, {
    onConflict: "queue_id,orgnr",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
  return unique.length;
}

export async function removeQueueItems(
  userId: string,
  queueId: string,
  orgnrs: string[]
) {
  await assertQueueOwner(queueId, userId);
  const unique = [...new Set(orgnrs.map((o) => o.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("work_queue_items")
    .delete()
    .eq("queue_id", queueId)
    .in("orgnr", unique);
  if (error) throw new Error(error.message);
}

export async function reorderQueueItems(
  userId: string,
  queueId: string,
  orderedOrgnrs: string[]
) {
  await assertQueueOwner(queueId, userId);
  const supabase = await createClient();

  for (let i = 0; i < orderedOrgnrs.length; i++) {
    const orgnr = orderedOrgnrs[i]?.trim();
    if (!orgnr) continue;
    const { error } = await supabase
      .from("work_queue_items")
      .update({ sort_order: i })
      .eq("queue_id", queueId)
      .eq("orgnr", orgnr);
    if (error) throw new Error(error.message);
  }
}

export async function bulkLoadQueueFromList(
  userId: string,
  queueId: string,
  listId: string,
  options?: { replace?: boolean }
) {
  await assertQueueOwner(queueId, userId);
  const members = await resolveListMembers(userId, listId);
  if (options?.replace) {
    const supabase = await createClient();
    const { error } = await supabase.from("work_queue_items").delete().eq("queue_id", queueId);
    if (error) throw new Error(error.message);
  }
  const added = await addQueueItems(userId, queueId, members.orgnrs);
  const supabase = await createClient();
  await supabase
    .from("work_queues")
    .update({ source_list_id: listId })
    .eq("id", queueId);
  return { added, listName: members.name, orgnrCount: members.orgnrs.length };
}

async function buildDialLeadsFromOrgnrs(
  userId: string,
  orgnrs: string[],
  metaByOrgnr: Map<string, WorkQueueItemRow>
): Promise<DialLead[]> {
  if (orgnrs.length === 0) return [];

  const supabase = await createClient();
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("*")
    .in("orgnr", orgnrs);

  if (companiesError) throw new Error(companiesError.message);

  const { data: leads } = await supabase
    .from("user_leads")
    .select("*")
    .eq("user_id", userId)
    .in("orgnr", orgnrs);

  const companyRows = (companies ?? []) as Company[];
  const leadsByOrgnr = new Map((leads ?? []).map((l) => [l.orgnr as string, l as UserLead]));
  const scans = await loadCachedWebsiteScans(orgnrs);
  const scansByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const candidates = buildQueueCandidates(companyRows, leadsByOrgnr, scansByOrgnr);
  const mapped = mapQueueCandidatesToItems(candidates);
  const byOrgnr = new Map(mapped.map((item) => [item.orgnr, item]));

  const now = Date.now();
  const ordered = orgnrs
    .map((orgnr) => {
      const base = byOrgnr.get(orgnr);
      const meta = metaByOrgnr.get(orgnr);
      if (!base) return null;
      if (meta?.snooze_until && new Date(meta.snooze_until).getTime() > now) return null;
      return {
        ...base,
        pinned: meta?.pinned ?? false,
        sortOrder: meta?.sort_order ?? 0,
        status: base.status,
      } satisfies DialLead;
    })
    .filter((item): item is DialLead => item != null);

  ordered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.queueScore - a.queueScore;
  });

  return ordered;
}

export async function loadQueueDialLeads(
  userId: string,
  queueId: string
): Promise<DialLead[]> {
  await assertQueueOwner(queueId, userId);
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("work_queue_items")
    .select("*")
    .eq("queue_id", queueId)
    .order("pinned", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (items ?? []) as WorkQueueItemRow[];
  const metaByOrgnr = new Map(rows.map((r) => [r.orgnr, r]));
  return buildDialLeadsFromOrgnrs(
    userId,
    rows.map((r) => r.orgnr),
    metaByOrgnr
  );
}

export async function loadListDialLeads(
  userId: string,
  listId: string,
  options?: { shuffle?: boolean }
): Promise<DialLead[]> {
  const members = await resolveListMembers(userId, listId, options);
  const metaByOrgnr = new Map<string, WorkQueueItemRow>();
  members.orgnrs.forEach((orgnr, index) => {
    metaByOrgnr.set(orgnr, {
      id: "",
      queue_id: "",
      orgnr,
      sort_order: index,
      pinned: false,
      snooze_until: null,
      created_at: "",
    });
  });
  return buildDialLeadsFromOrgnrs(userId, members.orgnrs, metaByOrgnr);
}

export async function getDefaultQueueId(userId: string): Promise<string> {
  return syncLegacyQueueIfNeeded(userId);
}
