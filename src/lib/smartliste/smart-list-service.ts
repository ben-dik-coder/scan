import { agentOrgnrsFromFilters } from "@/lib/agent/saved-list-filters";
import {
  laneIdForKey,
  rankCompaniesForSmartList,
  summarizeSmartListStats,
} from "@/lib/smartliste/ai-rank";
import { DEFAULT_BOARD_CONFIG, DEFAULT_LANE_SEEDS } from "@/lib/smartliste/board-config";
import type {
  SmartListBoard,
  SmartListBoardConfig,
  SmartListCard,
  SmartListItemPatch,
  SmartListKind,
  SmartListLabel,
  SmartListLane,
  SmartListRow,
  SmartListStats,
} from "@/lib/smartliste/types";
import { generateSmartListAiSummary } from "@/lib/smartliste/ai-summarize";
import { researchCompanyForSummary } from "@/lib/smartliste/company-research";
import { fetchCompaniesByOrgnrs } from "@/lib/brreg/fetch-companies-by-orgnr";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import { hasCompanyPhone } from "@/lib/brreg/lead-quality";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

async function ensureDefaultLanes(
  supabase: SupabaseClient,
  listId: string
): Promise<SmartListLane[]> {
  const { data: existing } = await supabase
    .from("smart_list_lanes")
    .select("*")
    .eq("list_id", listId)
    .order("sort_order");

  if ((existing ?? []).length > 0) {
    return existing as SmartListLane[];
  }

  const rows = DEFAULT_LANE_SEEDS.map((seed) => ({
    list_id: listId,
    name: seed.name,
    color: seed.color,
    sort_order: seed.sort_order,
    is_system: seed.is_system,
  }));

  const { data, error } = await supabase
    .from("smart_list_lanes")
    .insert(rows)
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []) as SmartListLane[];
}

async function migrateFromFilters(
  supabase: SupabaseClient,
  list: SmartListRow,
  lanes: SmartListLane[]
): Promise<void> {
  const orgnrs = agentOrgnrsFromFilters(list.filters);
  if (orgnrs.length === 0) return;

  const { count } = await supabase
    .from("smart_list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", list.id);

  if ((count ?? 0) > 0) return;

  const newLaneId = laneIdForKey(lanes, "new");
  const rows = orgnrs.map((orgnr, index) => ({
    list_id: list.id,
    orgnr,
    lane_id: newLaneId,
    sort_order: index,
  }));

  const { error } = await supabase.from("smart_list_items").insert(rows);
  if (error) throw new Error(error.message);
}

function computeStats(
  items: SmartListCard[],
  lanes: SmartListLane[]
): SmartListStats {
  const byLane: Record<string, number> = {};
  for (const lane of lanes) byLane[lane.id] = 0;

  let withPhone = 0;
  let withoutWebsite = 0;

  for (const item of items) {
    if (item.lane_id && byLane[item.lane_id] !== undefined) {
      byLane[item.lane_id] += 1;
    }
    if (item.company && hasCompanyPhone(item.company)) withPhone += 1;
    if (item.company && !item.company.website?.trim()) withoutWebsite += 1;
  }

  const { avgScore, aTier } = summarizeSmartListStats(items);

  return {
    total: items.length,
    byLane,
    withPhone,
    withoutWebsite,
    avgScore,
    aTier,
  };
}

export async function listSmartLists(userId: string): Promise<SmartListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .select("id, name, filters, list_kind, board_config, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...row,
    list_kind: (row.list_kind ?? "static") as SmartListKind,
    board_config: { ...DEFAULT_BOARD_CONFIG, ...(row.board_config ?? {}) },
  })) as SmartListRow[];
}

export async function createSmartList(
  userId: string,
  name: string,
  options?: {
    listKind?: SmartListKind;
    filters?: Record<string, unknown>;
    boardConfig?: SmartListBoardConfig;
  }
): Promise<SmartListRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .insert({
      user_id: userId,
      name: name.trim(),
      filters: options?.filters ?? {},
      list_kind: options?.listKind ?? "static",
      board_config: { ...DEFAULT_BOARD_CONFIG, ...(options?.boardConfig ?? {}) },
    })
    .select("id, name, filters, list_kind, board_config, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);

  const list = {
    ...data,
    list_kind: (data.list_kind ?? "static") as SmartListKind,
    board_config: { ...DEFAULT_BOARD_CONFIG, ...(data.board_config ?? {}) },
  } as SmartListRow;

  await ensureDefaultLanes(supabase, list.id);
  return list;
}

export async function loadSmartListBoard(
  userId: string,
  listId: string
): Promise<SmartListBoard> {
  const supabase = await createClient();

  const { data: listRow, error: listError } = await supabase
    .from("saved_lists")
    .select("id, name, filters, list_kind, board_config, created_at, updated_at")
    .eq("user_id", userId)
    .eq("id", listId)
    .maybeSingle();

  if (listError) throw new Error(listError.message);
  if (!listRow) throw new Error("Listen finnes ikke");

  const list = {
    ...listRow,
    list_kind: (listRow.list_kind ?? "static") as SmartListKind,
    board_config: { ...DEFAULT_BOARD_CONFIG, ...(listRow.board_config ?? {}) },
  } as SmartListRow;

  const lanes = await ensureDefaultLanes(supabase, listId);
  await migrateFromFilters(supabase, list, lanes);

  const [{ data: itemsRaw }, { data: labelsRaw }] = await Promise.all([
    supabase
      .from("smart_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("pinned", { ascending: false })
      .order("sort_order"),
    supabase.from("smart_list_labels").select("*").eq("user_id", userId),
  ]);

  const labels = (labelsRaw ?? []) as SmartListLabel[];
  const labelMap = new Map(labels.map((l) => [l.id, l]));

  const itemIds = (itemsRaw ?? []).map((i) => i.id as string);
  const labelsByItem = new Map<string, SmartListLabel[]>();

  if (itemIds.length > 0) {
    const { data: itemLabelsRaw } = await supabase
      .from("smart_list_item_labels")
      .select("item_id, label_id")
      .in("item_id", itemIds);

    for (const row of itemLabelsRaw ?? []) {
      const itemId = row.item_id as string;
      const label = labelMap.get(row.label_id as string);
      if (!label) continue;
      const current = labelsByItem.get(itemId) ?? [];
      current.push(label);
      labelsByItem.set(itemId, current);
    }
  }

  const orgnrs = (itemsRaw ?? []).map((i) => i.orgnr as string);
  let companies: Company[] = [];
  if (orgnrs.length > 0) {
    companies = await fetchCompaniesByOrgnrs(orgnrs, userId);
  }
  const companyMap = new Map(companies.map((c) => [c.orgnr, c]));

  const now = Date.now();
  const items: SmartListCard[] = (itemsRaw ?? [])
    .filter((item) => {
      if (!item.snooze_until) return true;
      return new Date(item.snooze_until as string).getTime() <= now;
    })
    .map((item) => ({
      ...(item as SmartListCard),
      company: companyMap.get(item.orgnr as string) ?? null,
      labels: labelsByItem.get(item.id as string) ?? [],
    }));

  return {
    list,
    lanes,
    items,
    labels,
    stats: computeStats(items, lanes),
  };
}

export async function updateSmartListMeta(
  userId: string,
  listId: string,
  patch: { name?: string; board_config?: SmartListBoardConfig; list_kind?: SmartListKind }
): Promise<void> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.name?.trim()) update.name = patch.name.trim();
  if (patch.board_config) update.board_config = patch.board_config;
  if (patch.list_kind) update.list_kind = patch.list_kind;

  const { error } = await supabase
    .from("saved_lists")
    .update(update)
    .eq("user_id", userId)
    .eq("id", listId);

  if (error) throw new Error(error.message);
}

export async function deleteSmartList(userId: string, listId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_lists")
    .delete()
    .eq("user_id", userId)
    .eq("id", listId);
  if (error) throw new Error(error.message);
}

export async function patchSmartListItems(
  userId: string,
  listId: string,
  patches: SmartListItemPatch[]
): Promise<void> {
  const supabase = await createClient();

  for (const patch of patches) {
    const { label_ids, ...itemPatch } = patch;
    const { error } = await supabase
      .from("smart_list_items")
      .update(itemPatch)
      .eq("id", patch.id)
      .eq("list_id", listId);

    if (error) throw new Error(error.message);

    if (label_ids) {
      await supabase.from("smart_list_item_labels").delete().eq("item_id", patch.id);
      if (label_ids.length > 0) {
        const { error: labelError } = await supabase
          .from("smart_list_item_labels")
          .insert(label_ids.map((label_id) => ({ item_id: patch.id, label_id })));
        if (labelError) throw new Error(labelError.message);
      }
    }
  }
}

export async function addOrgnrsToSmartList(
  userId: string,
  listId: string,
  orgnrs: string[]
): Promise<number> {
  const supabase = await createClient();
  const lanes = await ensureDefaultLanes(supabase, listId);
  const newLaneId = laneIdForKey(lanes, "new");

  const unique = [...new Set(orgnrs.map((o) => o.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;

  const { data: existing } = await supabase
    .from("smart_list_items")
    .select("orgnr, sort_order")
    .eq("list_id", listId);

  const existingSet = new Set((existing ?? []).map((e) => e.orgnr as string));
  const maxSort = Math.max(-1, ...(existing ?? []).map((e) => e.sort_order as number));

  const toInsert = unique
    .filter((orgnr) => !existingSet.has(orgnr))
    .map((orgnr, index) => ({
      list_id: listId,
      orgnr,
      lane_id: newLaneId,
      sort_order: maxSort + 1 + index,
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from("smart_list_items").insert(toInsert);
  if (error) throw new Error(error.message);
  return toInsert.length;
}

export async function removeSmartListItems(
  userId: string,
  listId: string,
  itemIds: string[]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("smart_list_items")
    .delete()
    .eq("list_id", listId)
    .in("id", itemIds);
  if (error) throw new Error(error.message);
}

export async function createSmartListLabel(
  userId: string,
  name: string,
  color: string,
  groupName?: string
): Promise<SmartListLabel> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("smart_list_labels")
    .insert({
      user_id: userId,
      name: name.trim(),
      color,
      group_name: groupName?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as SmartListLabel;
}

export async function rankSmartList(userId: string, listId: string): Promise<number> {
  const board = await loadSmartListBoard(userId, listId);
  const companies = board.items
    .map((i) => i.company)
    .filter((c): c is Company => c !== null);

  const ranks = rankCompaniesForSmartList(companies);
  const rankMap = new Map(ranks.map((r) => [r.orgnr, r]));
  const now = new Date().toISOString();

  const patches: SmartListItemPatch[] = [];
  const laneCounters = new Map<string, number>();

  for (const item of board.items) {
    if (item.pinned) continue;
    const rank = rankMap.get(item.orgnr);
    if (!rank) continue;

    const laneId = laneIdForKey(board.lanes, rank.laneKey);
    const counter = laneCounters.get(laneId ?? "none") ?? 0;
    laneCounters.set(laneId ?? "none", counter + 1);

    patches.push({
      id: item.id,
      lane_id: laneId,
      sort_order: counter,
      ai_score: rank.ai_score,
      ai_score_reason: rank.ai_score_reason,
    });
  }

  const supabase = await createClient();
  for (const patch of patches) {
    const { error } = await supabase
      .from("smart_list_items")
      .update({
        lane_id: patch.lane_id,
        sort_order: patch.sort_order,
        ai_score: patch.ai_score,
        ai_score_reason: patch.ai_score_reason,
        last_ai_rank_at: now,
      })
      .eq("id", patch.id)
      .eq("list_id", listId);
    if (error) throw new Error(error.message);
  }

  return patches.length;
}

export async function updateSmartListLane(
  userId: string,
  listId: string,
  laneId: string,
  patch: { name?: string; color?: string; sort_order?: number }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("smart_list_lanes")
    .update(patch)
    .eq("id", laneId)
    .eq("list_id", listId);
  if (error) throw new Error(error.message);
}

export async function createSmartListLane(
  userId: string,
  listId: string,
  name: string,
  color: string
): Promise<SmartListLane> {
  const supabase = await createClient();
  const { data: lanes } = await supabase
    .from("smart_list_lanes")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sortOrder = ((lanes?.[0]?.sort_order as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("smart_list_lanes")
    .insert({ list_id: listId, name: name.trim(), color, sort_order: sortOrder })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as SmartListLane;
}

export async function summarizeSmartListItems(
  userId: string,
  listId: string,
  itemIds: string[]
): Promise<number> {
  if (itemIds.length === 0) return 0;

  const board = await loadSmartListBoard(userId, listId);
  const icpPrompt = board.list.board_config.aiIcpPrompt;
  const items = board.items.filter((i) => itemIds.includes(i.id));
  if (items.length === 0) return 0;

  const orgnrs = items.map((i) => i.orgnr);
  const scans = await loadCachedWebsiteScans(orgnrs);
  const scanMap = new Map(scans.map((s) => [s.orgnr, s]));

  let count = 0;
  const supabase = await createClient();

  for (const item of items) {
    const company = item.company;
    if (!company) continue;

    const research = await researchCompanyForSummary(
      company,
      userId,
      scanMap.get(item.orgnr)
    );

    if (research.phonePatch) {
      const { error: phoneError } = await supabase
        .from("companies")
        .update(research.phonePatch)
        .eq("orgnr", company.orgnr);
      if (phoneError) throw new Error(phoneError.message);
    }

    const summary = await generateSmartListAiSummary(research, icpPrompt);

    const custom_fields = {
      ...(item.custom_fields ?? {}),
      ai_summary: summary,
    };

    const { error } = await supabase
      .from("smart_list_items")
      .update({ custom_fields })
      .eq("id", item.id)
      .eq("list_id", listId);

    if (error) throw new Error(error.message);
    count += 1;
  }

  return count;
}
