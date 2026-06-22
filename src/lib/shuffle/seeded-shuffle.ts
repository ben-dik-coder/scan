/** Deterministisk shuffle — samme seed gir samme rekkefølge. */

export type MarketShuffleFilters = {
  regionId?: string;
  municipalityCode?: string;
  days?: number;
  hasEmail?: boolean;
  genericEmailOnly?: boolean;
  industryGroup?: string;
  professionId?: string;
  naceCode?: string;
  nameQuery?: string;
};

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMarketFilterKey(filters: MarketShuffleFilters): string {
  return [
    filters.regionId ?? "",
    filters.municipalityCode ?? "",
    String(filters.days ?? ""),
    filters.hasEmail ? "1" : "0",
    filters.genericEmailOnly ? "1" : "0",
    filters.industryGroup ?? "",
    filters.professionId ?? "",
    filters.naceCode ?? "",
    filters.nameQuery ?? "",
  ].join("|");
}

export function buildMarketShuffleSeed(
  userId: string,
  filters: MarketShuffleFilters,
  monthKey: string = currentMonthKey()
): string {
  return `${userId}|${buildMarketFilterKey(filters)}|${monthKey}`;
}

export function buildDemoShuffleSeed(
  filters: MarketShuffleFilters,
  sessionId: string,
  monthKey: string = currentMonthKey()
): string {
  return `demo|${sessionId}|${buildMarketFilterKey(filters)}|${monthKey}`;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG */
function createRng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stabil sorteringsnøkkel for deterministisk rekkefølge (paginering). */
export function seededRank(id: string, seed: string): number {
  return hashSeed(`${seed}|${id}`);
}

/** Fisher–Yates med fast seed — endrer ikke input-arrayet. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;

  const rng = createRng(hashSeed(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
