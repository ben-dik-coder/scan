import { createServiceClient } from "@/lib/supabase/service";
import { daysAgoISO } from "@/lib/brreg/client";
import { isAllTimePeriod } from "@/lib/brreg/fetch-companies";

const COUNT_CACHE_MS = 60_000;
const NEWEST_CACHE_MS = 60_000;
let cachedCount: { count: number; at: number } | null = null;
let cachedNewest: { date: string | null; at: number } | null = null;

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

/** Nyeste ikke-null registreringsdato i DB (YYYY-MM-DD). */
export async function getBrregDbNewestRegisteredAt(): Promise<string | null> {
  if (cachedNewest && Date.now() - cachedNewest.at < NEWEST_CACHE_MS) {
    return cachedNewest.date;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("registered_at")
    .not("registered_at", "is", null)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const date =
    typeof data?.registered_at === "string"
      ? data.registered_at.slice(0, 10)
      : null;
  cachedNewest = { date, at: Date.now() };
  return date;
}

/**
 * Er DB fersk nok for et «siste N dager»-filter?
 * Hvis nyeste firma er eldre enn vinduet, blir filteret tomt selv om Brreg har data.
 */
export async function isBrregDbFreshForDays(days?: number): Promise<boolean> {
  if (isAllTimePeriod(days)) return true;
  const windowDays = days ?? 30;
  const newest = await getBrregDbNewestRegisteredAt();
  if (!newest) return false;
  return newest >= daysAgoISO(windowDays);
}

export function invalidateBrregDbCountCache() {
  cachedCount = null;
  cachedNewest = null;
}

/** Skal /api/companies lese fra Supabase i stedet for live Brreg-søk? */
export async function shouldUseBrregDb(options?: {
  days?: number;
}): Promise<boolean> {
  const mode = brregDbMode();
  if (mode === "false") return false;

  if (mode === "true") {
    // Selv hard DB-modus: fall tilbake til live Brreg når periodefilteret
    // ellers blir tomt pga. utdatert sync.
    if (options && !isAllTimePeriod(options.days)) {
      return isBrregDbFreshForDays(options.days);
    }
    return true;
  }

  const count = await getBrregDbCompanyCount();
  if (count < BRREG_DB_AUTO_MIN_COUNT) return false;

  if (options && !isAllTimePeriod(options.days)) {
    return isBrregDbFreshForDays(options.days);
  }
  return true;
}
