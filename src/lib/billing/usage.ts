import { createServiceClient } from "@/lib/supabase/service";
import { currentMonthKey, seededShuffle } from "@/lib/shuffle/seeded-shuffle";

export type CompanyContactRow = {
  orgnr: string;
  has_email: boolean;
  phone: string | null;
  mobile?: string | null;
};

export function hasContactInfo(c: CompanyContactRow): boolean {
  return Boolean(
    c.has_email ||
      (c.phone && c.phone.trim()) ||
      (c.mobile && c.mobile.trim())
  );
}

export async function countCompaniesWithContactThisMonth(
  userId: string
): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("usage_company_leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("month_key", currentMonthKey());

  return count ?? 0;
}

async function getRecordedOrgnrs(userId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("usage_company_leads")
    .select("orgnr")
    .eq("user_id", userId)
    .eq("month_key", currentMonthKey());

  return new Set((data ?? []).map((r) => r.orgnr));
}

async function recordOrgnrs(userId: string, orgnrs: string[]) {
  if (orgnrs.length === 0) return;
  const supabase = createServiceClient();
  const monthKey = currentMonthKey();
  await supabase.from("usage_company_leads").upsert(
    orgnrs.map((orgnr) => ({
      user_id: userId,
      month_key: monthKey,
      orgnr,
    })),
    { onConflict: "user_id,month_key,orgnr", ignoreDuplicates: true }
  );
}

export type CompanyContactUsage = {
  used: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
  newlyAdded: number;
};

/**
 * NyLead: maks unike firma med tlf/e-post per måned.
 * Allerede viste firma denne måneden vises alltid igjen.
 */
export async function applyCompanyContactLimit<T extends CompanyContactRow>(
  userId: string,
  companies: T[],
  maxPerMonth: number,
  shuffleSeed?: string,
  options?: { preserveOrder?: boolean }
): Promise<{ companies: T[]; usage: CompanyContactUsage }> {
  const existing = await getRecordedOrgnrs(userId);
  const usedBefore = existing.size;

  const ordered =
    shuffleSeed && !options?.preserveOrder
      ? seededShuffle(companies, shuffleSeed)
      : companies;

  const withContact = ordered.filter(hasContactInfo);
  const withoutContact = ordered.filter((c) => !hasContactInfo(c));

  const newWithContact = withContact.filter((c) => !existing.has(c.orgnr));

  const remaining = Math.max(0, maxPerMonth - usedBefore);
  const pool =
    shuffleSeed && newWithContact.length > 1
      ? seededShuffle(newWithContact, `${shuffleSeed}|unlock`)
      : newWithContact;
  const toUnlock = pool.slice(0, remaining);
  await recordOrgnrs(
    userId,
    toUnlock.map((c) => c.orgnr)
  );

  const unlockedOrgnrs = new Set<string>([
    ...Array.from(existing),
    ...toUnlock.map((c) => c.orgnr),
  ]);

  const allowedWithContact = withContact.filter((c) =>
    unlockedOrgnrs.has(c.orgnr)
  );
  const used = unlockedOrgnrs.size;
  const limitReached = used >= maxPerMonth && newWithContact.length > toUnlock.length;

  return {
    companies: [...withoutContact, ...allowedWithContact],
    usage: {
      used,
      limit: maxPerMonth,
      remaining: Math.max(0, maxPerMonth - used),
      limitReached,
      newlyAdded: toUnlock.length,
    },
  };
}
