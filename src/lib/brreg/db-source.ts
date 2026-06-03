import { createServiceClient } from "@/lib/supabase/service";

const COUNT_CACHE_MS = 60_000;
let cachedCount: { count: number; at: number } | null = null;

/** Minimum antall rader i `companies` før auto-modus bruker DB. */
export const BRREG_DB_AUTO_MIN_COUNT = 10_000;

export function brregDbMode(): "true" | "false" | "auto" {
  const raw = (process.env.BRREG_USE_DB ?? "auto").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return "true";
  if (raw === "false" || raw === "0" || raw === "no") return "false";
  return "auto";
}

export async function getBrregDbCompanyCount(): Promise<number> {
  if (cachedCount && Date.now() - cachedCount.at < COUNT_CACHE_MS) {
    return cachedCount.count;
  }

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(error.message);

  const n = count ?? 0;
  cachedCount = { count: n, at: Date.now() };
  return n;
}

export function invalidateBrregDbCountCache() {
  cachedCount = null;
}

/** Skal /api/companies lese fra Supabase i stedet for live Brreg-søk? */
export async function shouldUseBrregDb(): Promise<boolean> {
  const mode = brregDbMode();
  if (mode === "false") return false;
  if (mode === "true") return true;

  const count = await getBrregDbCompanyCount();
  return count >= BRREG_DB_AUTO_MIN_COUNT;
}
