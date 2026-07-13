/** Stabil nøkkel for Smartliste-soner (uavhengig av visningsnavn). */
export type LaneKey = "a" | "b" | "c" | "archive" | "new" | string;

export type Lane = {
  id: string;
  listId: string;
  laneKey: LaneKey | null;
  name: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
};
