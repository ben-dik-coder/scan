/** Varsle UI når agent (eller bruker) lagrer en ny målgruppe. */
export const SAVED_LIST_CHANGED_EVENT = "nylead:saved-list-changed";

export type SavedListChangedDetail = {
  id: string;
  name: string;
  url?: string;
  orgnrCount?: number;
};

export function notifySavedListChanged(detail: SavedListChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SAVED_LIST_CHANGED_EVENT, { detail })
  );
}
