import type { SmartListBoardConfig, SmartListLane } from "./types";

export const LANE_COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  slate: "bg-slate-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  orange: "bg-orange-400",
};

export const LABEL_COLOR_OPTIONS = [
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "orange",
  "slate",
] as const;

export const DEFAULT_BOARD_CONFIG: SmartListBoardConfig = {
  defaultView: "board",
  zoom: 100,
  cardSize: "comfortable",
  leftPanelOpen: true,
  rightPanelOpen: true,
};

export type DefaultLaneSeed = {
  key: string;
  name: string;
  color: string;
  sort_order: number;
  is_system: boolean;
};

export const DEFAULT_LANE_SEEDS: DefaultLaneSeed[] = [
  { key: "a", name: "A — Topp prioritet", color: "emerald", sort_order: 0, is_system: true },
  { key: "b", name: "B — Vurder", color: "amber", sort_order: 1, is_system: true },
  { key: "c", name: "C — Lav prioritet", color: "slate", sort_order: 2, is_system: true },
  { key: "archive", name: "Arkiv / Parkert", color: "violet", sort_order: 3, is_system: true },
  { key: "new", name: "Nytt / Uklassifisert", color: "sky", sort_order: 4, is_system: true },
];

export function laneHeaderClass(color: string): string {
  return LANE_COLOR_CLASSES[color] ?? LANE_COLOR_CLASSES.slate;
}

export function labelChipClass(color: string): string {
  const map: Record<string, string> = {
    sky: "bg-sky-500/20 text-sky-200 border-sky-500/30",
    emerald: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-200 border-amber-500/30",
    rose: "bg-rose-500/20 text-rose-200 border-rose-500/30",
    violet: "bg-violet-500/20 text-violet-200 border-violet-500/30",
    orange: "bg-orange-500/20 text-orange-200 border-orange-500/30",
    slate: "bg-white/10 text-slate-300 border-white/15",
  };
  return map[color] ?? map.slate;
}

export function sortLanes(lanes: SmartListLane[]): SmartListLane[] {
  return [...lanes].sort((a, b) => a.sort_order - b.sort_order);
}
