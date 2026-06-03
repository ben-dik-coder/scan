import { createClient } from "@/lib/supabase/server";
import { computeLeadScore } from "@/lib/sales/lead-score";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import type { Company, CompanyWithLead, UserLead } from "@/types/database";

export type CompanyFilters = {
  municipalityCode?: string;
  days?: number;
  hasEmail?: boolean;
  genericEmailOnly?: boolean;
  minScore?: number;
  status?: string;
  limit?: number;
};

export async function ensureUserLeads(userId: string, companies: Company[]) {
  if (companies.length === 0) return;

  const supabase = await createClient();
  const orgnrs = companies.map((c) => c.orgnr);

  const { data: existing } = await supabase
    .from("user_leads")
    .select("orgnr")
    .eq("user_id", userId)
    .in("orgnr", orgnrs);

  const existingSet = new Set((existing ?? []).map((e) => e.orgnr));
  const toInsert = companies
    .filter((c) => !existingSet.has(c.orgnr))
    .map((c) => ({
      user_id: userId,
      orgnr: c.orgnr,
      status: "ny" as const,
      score: computeLeadScore(c),
    }));

  if (toInsert.length > 0) {
    await supabase.from("user_leads").insert(toInsert);
  }

  const scoreUpdates = companies
    .filter((c) => existingSet.has(c.orgnr))
    .map((c) => ({
      user_id: userId,
      orgnr: c.orgnr,
      score: computeLeadScore(c),
    }));

  for (const update of scoreUpdates) {
    await supabase
      .from("user_leads")
      .update({ score: update.score })
      .eq("user_id", userId)
      .eq("orgnr", update.orgnr);
  }
}

export async function fetchCompaniesWithLeads(
  userId: string,
  filters: CompanyFilters = {}
): Promise<{ companies: CompanyWithLead[]; total: number; withEmail: number }> {
  const supabase = await createClient();
  const allTime = filters.days === 0;
  const days = filters.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .order("registered_at", { ascending: false })
    .limit(filters.limit ?? (allTime ? 2000 : 200));

  if (!allTime) {
    query = query.gte("registered_at", sinceStr);
  }

  if (filters.municipalityCode) {
    query = query.eq("municipality_code", filters.municipalityCode);
  }
  if (filters.hasEmail) {
    query = query.eq("has_email", true);
  }
  if (filters.genericEmailOnly) {
    query = query.eq("email_is_generic", true);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const companies = (data ?? []) as Company[];
  await ensureUserLeads(userId, companies);

  const orgnrs = companies.map((c) => c.orgnr);
  const { data: leads } = await supabase
    .from("user_leads")
    .select("*")
    .eq("user_id", userId)
    .in("orgnr", orgnrs);

  const leadMap = new Map((leads ?? []).map((l) => [l.orgnr, l as UserLead]));

  let result: CompanyWithLead[] = companies.map((c) => ({
    ...c,
    user_lead: leadMap.get(c.orgnr) ?? null,
  }));

  if (filters.minScore !== undefined) {
    result = result.filter(
      (c) => (c.user_lead?.score ?? 0) >= (filters.minScore ?? 0)
    );
  }

  if (filters.status) {
    result = result.filter((c) => c.user_lead?.status === filters.status);
  }

  const withEmail = result.filter((c) => c.has_email).length;

  return {
    companies: result,
    total: count ?? result.length,
    withEmail,
  };
}

export async function fetchPipelineLeads(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_leads")
    .select(
      `
      *,
      companies (*)
    `
    )
    .eq("user_id", userId)
    .order("score", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    lead: row as UserLead,
    company: row.companies as Company,
  }));
}

export async function fetchSalesDashboard(
  userId: string
): Promise<SalesDashboardStats> {
  const supabase = await createClient();

  const [leadsRes, campaignsRes, enrollmentsRes, followUpsRes, activitiesRes] =
    await Promise.all([
      supabase
        .from("user_leads")
        .select("status", { count: "exact" })
        .eq("user_id", userId),
      supabase
        .from("email_campaigns")
        .select("sent_count, failed_count")
        .eq("user_id", userId),
      supabase
        .from("sequence_enrollments")
        .select("status")
        .eq("user_id", userId),
      supabase
        .from("user_leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", new Date().toISOString()),
      supabase
        .from("lead_activities")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const statusCounts: Record<string, number> = {};
  for (const row of leadsRes.data ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  const totalSent = (campaignsRes.data ?? []).reduce(
    (sum, c) => sum + (c.sent_count ?? 0),
    0
  );
  const totalFailed = (campaignsRes.data ?? []).reduce(
    (sum, c) => sum + (c.failed_count ?? 0),
    0
  );

  const activeSequences = (enrollmentsRes.data ?? []).filter(
    (e) => e.status === "active"
  ).length;

  return {
    totalLeads: leadsRes.count ?? 0,
    statusCounts,
    totalSent,
    totalFailed,
    activeSequences,
    dueFollowUps: followUpsRes.count ?? 0,
    totalActivities: activitiesRes.count ?? 0,
  };
}

export async function fetchMunicipalitiesFromDb(): Promise<
  Array<{ code: string; name: string; count: number }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("municipality_code, municipality_name");

  if (error) throw new Error(error.message);

  const map = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    if (!row.municipality_code) continue;
    const existing = map.get(row.municipality_code);
    if (existing) existing.count += 1;
    else
      map.set(row.municipality_code, {
        name: row.municipality_name ?? row.municipality_code,
        count: 1,
      });
  }

  return Array.from(map.entries())
    .map(([code, { name, count }]) => ({ code, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function fetchAdminStats() {
  const supabase = await createClient();

  const [totalRes, emailRes, syncRes, kommuneRes] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("has_email", true),
    supabase.from("sync_state").select("*").eq("key", "brreg_enheter").maybeSingle(),
    supabase
      .from("companies")
      .select("municipality_code, municipality_name")
      .not("municipality_code", "is", null),
  ]);

  const kommuneMap = new Map<string, { name: string; count: number }>();
  for (const row of kommuneRes.data ?? []) {
    if (!row.municipality_code) continue;
    const e = kommuneMap.get(row.municipality_code);
    if (e) e.count += 1;
    else
      kommuneMap.set(row.municipality_code, {
        name: row.municipality_name ?? row.municipality_code,
        count: 1,
      });
  }

  const topKommuner = Array.from(kommuneMap.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCompanies: totalRes.count ?? 0,
    withEmail: emailRes.count ?? 0,
    syncState: syncRes.data,
    topKommuner,
  };
}

export async function fetchCampaigns(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchTemplates(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSequencesWithSteps(userId: string) {
  const supabase = await createClient();
  const { data: sequences, error } = await supabase
    .from("email_sequences")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const result = [];
  for (const seq of sequences ?? []) {
    const { data: steps } = await supabase
      .from("email_sequence_steps")
      .select("*")
      .eq("sequence_id", seq.id)
      .order("step_order", { ascending: true });
    result.push({ ...seq, steps: steps ?? [] });
  }
  return result;
}

export async function fetchSavedLists(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchLeadActivities(userId: string, orgnr: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("user_id", userId)
    .eq("orgnr", orgnr)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Legacy export for backward compat
export async function fetchCompanies(filters: CompanyFilters = {}) {
  const supabase = await createClient();
  const allTime = filters.days === 0;
  const days = filters.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .order("registered_at", { ascending: false })
    .limit(filters.limit ?? (allTime ? 2000 : 200));

  if (!allTime) {
    query = query.gte("registered_at", sinceStr);
  }

  if (filters.municipalityCode) {
    query = query.eq("municipality_code", filters.municipalityCode);
  }
  if (filters.hasEmail) query = query.eq("has_email", true);
  if (filters.genericEmailOnly) query = query.eq("email_is_generic", true);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const companies = (data ?? []) as Company[];
  return {
    companies,
    total: count ?? companies.length,
    withEmail: companies.filter((c) => c.has_email).length,
  };
}
