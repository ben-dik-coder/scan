import type { Company } from "@/types/database";
import type { AgentSavedListFilters } from "@/lib/agent/saved-list-filters";

export type SmartListKind = "static" | "dynamic";

export type SmartListViewMode = "board" | "ranked" | "grid";

export type SmartListBoardConfig = {
  defaultView?: SmartListViewMode;
  aiIcpPrompt?: string;
  zoom?: number;
  cardSize?: "compact" | "comfortable";
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
};

export type SmartListLane = {
  id: string;
  list_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_system: boolean;
};

export type SmartListLabel = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  group_name: string | null;
};

export type SmartListItem = {
  id: string;
  list_id: string;
  orgnr: string;
  lane_id: string | null;
  sort_order: number;
  pinned: boolean;
  ai_score: number | null;
  ai_score_reason: string | null;
  note: string | null;
  snooze_until: string | null;
  custom_fields: Record<string, unknown>;
  added_at: string;
  last_ai_rank_at: string | null;
  label_ids?: string[];
};

export type SmartListRow = {
  id: string;
  name: string;
  filters: AgentSavedListFilters;
  list_kind: SmartListKind;
  board_config: SmartListBoardConfig;
  created_at: string;
  updated_at?: string;
};

export type SmartListCard = SmartListItem & {
  company: Company | null;
  labels: SmartListLabel[];
};

export type SmartListStats = {
  total: number;
  byLane: Record<string, number>;
  withPhone: number;
  withoutWebsite: number;
  avgScore: number;
  aTier: number;
};

export type SmartListBoard = {
  list: SmartListRow;
  lanes: SmartListLane[];
  items: SmartListCard[];
  labels: SmartListLabel[];
  stats: SmartListStats;
};

export type SmartListItemPatch = {
  id: string;
  lane_id?: string | null;
  sort_order?: number;
  pinned?: boolean;
  note?: string | null;
  ai_score?: number | null;
  ai_score_reason?: string | null;
  label_ids?: string[];
  custom_fields?: Record<string, unknown>;
};

export type { SmartListAiSummary } from "@/lib/smartliste/ai-summary-shared";
