import { currentMonthKey } from "@/lib/shuffle/seeded-shuffle";
import { createServiceClient } from "@/lib/supabase/service";

export const SERPER_MONTHLY_LIMIT = 1500;

export type SerperUsage = {
  used: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
};

export class SerperLimitReachedError extends Error {
  readonly usage: SerperUsage;

  constructor(usage: SerperUsage) {
    super(
      `Du har brukt opp Serper-kvoten (${usage.used} av ${usage.limit} kall denne måneden). Prøv igjen neste måned.`
    );
    this.name = "SerperLimitReachedError";
    this.usage = usage;
  }
}

function toSerperUsage(used: number): SerperUsage {
  const limit = SERPER_MONTHLY_LIMIT;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    limitReached: used >= limit,
  };
}

export async function getSerperUsage(userId: string): Promise<SerperUsage> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("usage_monthly")
    .select("serper_api_calls")
    .eq("user_id", userId)
    .eq("month_key", currentMonthKey())
    .maybeSingle();

  return toSerperUsage(data?.serper_api_calls ?? 0);
}

export async function assertSerperQuota(userId: string): Promise<SerperUsage> {
  const usage = await getSerperUsage(userId);
  if (usage.limitReached) {
    throw new SerperLimitReachedError(usage);
  }
  return usage;
}

export async function recordSerperApiCall(
  userId: string,
  count = 1
): Promise<SerperUsage> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("increment_serper_usage", {
    p_user_id: userId,
    p_month_key: currentMonthKey(),
    p_delta: count,
  });

  if (error) {
    throw new Error(`Kunne ikke oppdatere Serper-telling: ${error.message}`);
  }

  return toSerperUsage(typeof data === "number" ? data : Number(data ?? 0));
}
