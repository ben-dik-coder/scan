import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/billing/plans";
import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_CAP = 300;

export type SubscriberCountResult = {
  /** Vises i banner (kan være override under test) */
  taken: number;
  /** Faktisk antall aktive/trialing i databasen */
  realCount: number;
  cap: number;
  remaining: number;
  full: boolean;
  overrideActive: boolean;
};

export function getSubscriberCap(): number {
  const raw = process.env.SUBSCRIBER_CAP?.trim();
  if (!raw) return DEFAULT_CAP;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

function parseOverride(): number | null {
  const raw = process.env.SUBSCRIBER_COUNT_OVERRIDE?.trim();
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function displayTakenCount(realCount: number): {
  taken: number;
  overrideActive: boolean;
} {
  const override = parseOverride();
  if (override !== null) {
    return { taken: override, overrideActive: true };
  }
  return { taken: realCount, overrideActive: false };
}

export async function countActiveSubscribers(): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("subscription_status", [...ACTIVE_SUBSCRIPTION_STATUSES]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getSubscriberCount(): Promise<SubscriberCountResult> {
  const cap = getSubscriberCap();
  const realCount = await countActiveSubscribers();
  const { taken, overrideActive } = displayTakenCount(realCount);
  const remaining = Math.max(0, cap - taken);
  const full = realCount >= cap;

  return {
    taken,
    realCount,
    cap,
    remaining,
    full,
    overrideActive,
  };
}

export function isSubscriberCapReached(realCount: number): boolean {
  return realCount >= getSubscriberCap();
}
