import { seededShuffle } from "@/lib/shuffle/seeded-shuffle";

const SCAN_SESSION_KEY = "nylead-scan-shuffle-session";

/** Fast seed for skann-batch (samme tab / sesjon). */
export function getScanShuffleSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(SCAN_SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SCAN_SESSION_KEY, id);
  }
  return id;
}

export function shuffleScanBatch<T>(items: readonly T[], reason: string): T[] {
  const seed = `${getScanShuffleSessionId()}|${reason}`;
  return seededShuffle(items, seed);
}
