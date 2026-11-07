import { buildDemoAnalyseBundle } from "@/lib/analyse/demo-data";
import {
  activityLabel,
  buildHealth,
  buildOverviewKpis,
  callOutcomeLabel,
  callStatusLabel,
  fillDaySeries,
  pct,
  pipelineFromStatusCounts,
  toNamedCounts,
} from "@/lib/analyse/metrics";
import type { AnalyseBundle, AnalyseRangeDays } from "@/lib/analyse/types";
import { SERPER_MONTHLY_LIMIT } from "@/lib/billing/serper-usage";
import { isDemoMode } from "@/lib/demo/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMonthKey } from "@/lib/shuffle/seeded-shuffle";

function sinceIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function countBy(
  rows: Array<Record<string, unknown>>,
  key: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const raw = row[key];
    if (raw == null || raw === "") continue;
    const id = String(raw);
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export async function fetchAnalyseBundle(
  userId: string,
  rangeDays: AnalyseRangeDays = 30
): Promise<AnalyseBundle> {
  if (isDemoMode()) {
    return buildDemoAnalyseBundle();
  }

  const supabase = await createClient();
  const since = sinceIso(rangeDays);
  const since7 = sinceIso(7);
  const since14 = sinceIso(14);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    leadsRes,
    queuedRes,
    followUpsRes,
    campaignsRes,
    enrollmentsRes,
    activitiesRes,
    activitiesRecentRes,
    callsRes,
    callsMonthRes,
  ] = await Promise.all([
    supabase.from("user_leads").select("status, queued_at").eq("user_id", userId),
    supabase
      .from("user_leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("queued_at", "is", null),
    supabase
      .from("user_leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", new Date().toISOString()),
    supabase
      .from("email_campaigns")
      .select("sent_count, failed_count")
      .eq("user_id", userId),
    supabase
      .from("sequence_enrollments")
      .select("status")
      .eq("user_id", userId),
    supabase
      .from("lead_activities")
      .select("activity_type, description, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("lead_activities")
      .select("activity_type, description, created_at")
      .eq("user_id", userId)
      .gte("created_at", since14)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("ai_calls")
      .select("status, outcome, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("ai_calls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  let serperUsed = 0;
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("usage_monthly")
      .select("serper_api_calls")
      .eq("user_id", userId)
      .eq("month_key", currentMonthKey())
      .maybeSingle();
    serperUsed = data?.serper_api_calls ?? 0;
  } catch {
    serperUsed = 0;
  }

  const statusCounts: Record<string, number> = {};
  for (const row of leadsRes.data ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }
  const totalLeads = (leadsRes.data ?? []).length;
  const pipeline = pipelineFromStatusCounts(statusCounts);

  const campaignSent = (campaignsRes.data ?? []).reduce(
    (sum, c) => sum + (c.sent_count ?? 0),
    0
  );
  const campaignFailed = (campaignsRes.data ?? []).reduce(
    (sum, c) => sum + (c.failed_count ?? 0),
    0
  );
  const failRate = pct(campaignFailed, campaignSent + campaignFailed);

  const enrollCounts = countBy(enrollmentsRes.data ?? [], "status");
  const enrollmentsByStatus = toNamedCounts(
    enrollCounts,
    ["active", "completed", "replied", "paused", "unsubscribed", "failed"],
    (id) => {
      const map: Record<string, string> = {
        active: "Aktiv",
        completed: "Ferdig",
        replied: "Svart",
        paused: "Pauset",
        unsubscribed: "Avmeldt",
        failed: "Feilet",
      };
      return map[id] ?? id;
    }
  );
  const activeEnrollments = enrollCounts.active ?? 0;

  const callRows = callsRes.data ?? [];
  const callStatusCounts = countBy(callRows, "status");
  const callOutcomeCounts = countBy(callRows, "outcome");
  const ended = callStatusCounts.ended ?? 0;
  const noAnswer = callOutcomeCounts.no_answer ?? 0;
  const meetings = callOutcomeCounts.meeting ?? 0;
  const connectRate =
    ended > 0 ? pct(Math.max(0, ended - noAnswer), ended) : null;
  const meetingRate = ended > 0 ? pct(meetings, ended) : null;

  const activityRows = activitiesRes.data ?? [];
  const activityRecent = activitiesRecentRes.data ?? [];
  const typeCounts = countBy(activityRows, "activity_type");
  const byType = toNamedCounts(
    typeCounts,
    Object.keys(typeCounts),
    activityLabel
  ).sort((a, b) => b.count - a.count);

  const smsCount = activityRows.filter((r) =>
    /sms/i.test(`${r.activity_type ?? ""} ${r.description ?? ""}`)
  ).length;
  const callRelated = typeCounts.call ?? 0;
  const emailRelated =
    (typeCounts.email_sent ?? 0) + (typeCounts.sequence_sent ?? 0);

  const activityWeekRows = activityRecent.filter(
    (r) => r.created_at && r.created_at >= since7
  );
  const activityWeek = activityWeekRows.length;

  const dueFollowUps = followUpsRes.count ?? 0;
  const health = buildHealth({
    totalLeads,
    statusCounts,
    dueFollowUps,
    connectRate,
    failRate,
    activityLast7: activityWeek,
  });

  const contacted =
    (statusCounts.kontaktet ?? 0) +
    (statusCounts.svarte ?? 0) +
    (statusCounts.moete_booket ?? 0) +
    (statusCounts.vunnet ?? 0) +
    (statusCounts.tapt ?? 0) +
    (statusCounts.ikke_interessert ?? 0);

  const repliedBucket =
    (statusCounts.svarte ?? 0) + (statusCounts.moete_booket ?? 0);
  const meetingBucket =
    (statusCounts.moete_booket ?? 0) + (statusCounts.vunnet ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    rangeDays,
    healthScore: health.score,
    healthLabel: health.label,
    healthHints: health.hints,
    kpis: buildOverviewKpis({
      totalLeads,
      meetings: statusCounts.moete_booket ?? 0,
      won: statusCounts.vunnet ?? 0,
      dueFollowUps,
      connectRate,
      activeSequences: activeEnrollments,
      aiCalls: callRows.length,
      activityWeek,
    }),
    pipeline,
    conversion: {
      contactedOfTotal: pct(contacted, totalLeads),
      repliedOfContacted: pct(statusCounts.svarte ?? 0, Math.max(1, contacted)),
      meetingOfReplied: pct(statusCounts.moete_booket ?? 0, Math.max(1, repliedBucket)),
      wonOfMeeting: pct(statusCounts.vunnet ?? 0, Math.max(1, meetingBucket)),
    },
    calls: {
      total: callRows.length,
      byStatus: toNamedCounts(
        callStatusCounts,
        ["queued", "ringing", "in_progress", "ended", "failed"],
        callStatusLabel
      ),
      byOutcome: toNamedCounts(
        callOutcomeCounts,
        ["meeting", "not_interested", "no_answer", "voicemail", "other"],
        callOutcomeLabel
      ),
      connectRate,
      meetingRate,
      last7Days: fillDaySeries(7, callRows),
    },
    email: {
      campaignSent,
      campaignFailed,
      failRate,
      enrollmentsByStatus,
      activeEnrollments,
    },
    activity: {
      total: activityRows.length,
      byType,
      last14Days: fillDaySeries(14, activityRecent),
      smsRelated: smsCount,
      callRelated,
      emailRelated,
    },
    prospecting: {
      totalLeads,
      queued: queuedRes.count ?? 0,
      dueFollowUps,
      contactedShare: pct(contacted, totalLeads),
      wonShare: pct(statusCounts.vunnet ?? 0, totalLeads),
    },
    costs: {
      serperUsed,
      serperLimit: SERPER_MONTHLY_LIMIT,
      serperRemaining: Math.max(0, SERPER_MONTHLY_LIMIT - serperUsed),
      aiCallsThisMonth: callsMonthRes.count ?? 0,
      aiCallsLast30: callRows.length,
    },
  };
}
