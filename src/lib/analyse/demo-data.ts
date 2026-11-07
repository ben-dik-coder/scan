import {
  buildHealth,
  buildOverviewKpis,
  callOutcomeLabel,
  callStatusLabel,
  emptyDaySeries,
  pipelineFromStatusCounts,
} from "@/lib/analyse/metrics";
import type { AnalyseBundle } from "@/lib/analyse/types";

export function buildEmptyAnalyseBundle(): AnalyseBundle {
  const statusCounts: Record<string, number> = {
    ny: 0,
    kontaktet: 0,
    svarte: 0,
    moete_booket: 0,
    vunnet: 0,
    tapt: 0,
    ikke_interessert: 0,
  };
  const health = buildHealth({
    totalLeads: 0,
    statusCounts,
    dueFollowUps: 0,
    connectRate: null,
    failRate: null,
    activityLast7: 0,
  });
  return {
    generatedAt: new Date().toISOString(),
    rangeDays: 30,
    healthScore: health.score,
    healthLabel: health.label,
    healthHints: health.hints,
    kpis: buildOverviewKpis({
      totalLeads: 0,
      meetings: 0,
      won: 0,
      dueFollowUps: 0,
      connectRate: null,
      activeSequences: 0,
      aiCalls: 0,
      activityWeek: 0,
    }),
    pipeline: pipelineFromStatusCounts(statusCounts),
    conversion: {
      contactedOfTotal: null,
      repliedOfContacted: null,
      meetingOfReplied: null,
      wonOfMeeting: null,
    },
    calls: {
      total: 0,
      byStatus: [],
      byOutcome: [],
      connectRate: null,
      meetingRate: null,
      last7Days: emptyDaySeries(7),
    },
    email: {
      campaignSent: 0,
      campaignFailed: 0,
      failRate: null,
      enrollmentsByStatus: [],
      activeEnrollments: 0,
    },
    activity: {
      total: 0,
      byType: [],
      last14Days: emptyDaySeries(14),
      smsRelated: 0,
      callRelated: 0,
      emailRelated: 0,
    },
    prospecting: {
      totalLeads: 0,
      queued: 0,
      dueFollowUps: 0,
      contactedShare: null,
      wonShare: null,
    },
    costs: {
      serperUsed: 0,
      serperLimit: 1500,
      serperRemaining: 1500,
      aiCallsThisMonth: 0,
      aiCallsLast30: 0,
    },
  };
}

/** Realistiske tall for demomodus — så Analyse ikke ser tom ut. */
export function buildDemoAnalyseBundle(): AnalyseBundle {
  const statusCounts: Record<string, number> = {
    ny: 42,
    kontaktet: 28,
    svarte: 14,
    moete_booket: 6,
    vunnet: 3,
    tapt: 5,
    ikke_interessert: 8,
  };
  const totalLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const pipeline = pipelineFromStatusCounts(statusCounts);

  const last7 = emptyDaySeries(7).map((p, i) => ({
    ...p,
    count: [2, 5, 3, 8, 4, 6, 7][i] ?? 3,
  }));
  const last14 = emptyDaySeries(14).map((p, i) => ({
    ...p,
    count: 2 + ((i * 3) % 7),
  }));

  const connectRate = 38.5;
  const meetingRate = 12.5;
  const failRate = 4.2;
  const activityWeek = last7.reduce((s, p) => s + p.count, 0);
  const health = buildHealth({
    totalLeads,
    statusCounts,
    dueFollowUps: 4,
    connectRate,
    failRate,
    activityLast7: activityWeek,
  });

  const contacted =
    statusCounts.kontaktet! +
    statusCounts.svarte! +
    statusCounts.moete_booket! +
    statusCounts.vunnet! +
    statusCounts.tapt! +
    statusCounts.ikke_interessert!;

  return {
    generatedAt: new Date().toISOString(),
    rangeDays: 30,
    healthScore: health.score,
    healthLabel: health.label,
    healthHints: health.hints,
    kpis: buildOverviewKpis({
      totalLeads,
      meetings: statusCounts.moete_booket!,
      won: statusCounts.vunnet!,
      dueFollowUps: 4,
      connectRate,
      activeSequences: 11,
      aiCalls: 24,
      activityWeek,
    }),
    pipeline,
    conversion: {
      contactedOfTotal: Math.round((contacted / totalLeads) * 1000) / 10,
      repliedOfContacted:
        Math.round((statusCounts.svarte! / Math.max(1, contacted)) * 1000) / 10,
      meetingOfReplied:
        Math.round(
          (statusCounts.moete_booket! /
            Math.max(1, statusCounts.svarte! + statusCounts.moete_booket!)) *
            1000
        ) / 10,
      wonOfMeeting:
        Math.round(
          (statusCounts.vunnet! /
            Math.max(1, statusCounts.moete_booket! + statusCounts.vunnet!)) *
            1000
        ) / 10,
    },
    calls: {
      total: 24,
      byStatus: [
        { id: "ended", label: callStatusLabel("ended"), count: 18 },
        { id: "failed", label: callStatusLabel("failed"), count: 4 },
        { id: "in_progress", label: callStatusLabel("in_progress"), count: 0 },
        { id: "queued", label: callStatusLabel("queued"), count: 2 },
      ],
      byOutcome: [
        { id: "meeting", label: callOutcomeLabel("meeting"), count: 3 },
        { id: "no_answer", label: callOutcomeLabel("no_answer"), count: 9 },
        {
          id: "not_interested",
          label: callOutcomeLabel("not_interested"),
          count: 4,
        },
        { id: "voicemail", label: callOutcomeLabel("voicemail"), count: 2 },
        { id: "other", label: callOutcomeLabel("other"), count: 0 },
      ],
      connectRate,
      meetingRate,
      last7Days: last7,
    },
    email: {
      campaignSent: 186,
      campaignFailed: 8,
      failRate,
      enrollmentsByStatus: [
        { id: "active", label: "Aktiv", count: 11 },
        { id: "completed", label: "Ferdig", count: 22 },
        { id: "replied", label: "Svart", count: 7 },
        { id: "paused", label: "Pauset", count: 3 },
        { id: "failed", label: "Feilet", count: 2 },
      ],
      activeEnrollments: 11,
    },
    activity: {
      total: 214,
      byType: [
        { id: "status_changed", label: "Status endret", count: 64 },
        { id: "call", label: "Ring", count: 41 },
        { id: "email_sent", label: "E-post sendt", count: 38 },
        { id: "sms_sent", label: "SMS sendt", count: 19 },
        { id: "sequence_sent", label: "Sekvens-steg", count: 28 },
        { id: "note_added", label: "Notat", count: 14 },
        { id: "follow_up_set", label: "Oppfølging satt", count: 10 },
      ],
      last14Days: last14,
      smsRelated: 19,
      callRelated: 41,
      emailRelated: 66,
    },
    prospecting: {
      totalLeads,
      queued: 37,
      dueFollowUps: 4,
      contactedShare: Math.round((contacted / totalLeads) * 1000) / 10,
      wonShare: Math.round((statusCounts.vunnet! / totalLeads) * 1000) / 10,
    },
    costs: {
      serperUsed: 420,
      serperLimit: 1500,
      serperRemaining: 1080,
      aiCallsThisMonth: 24,
      aiCallsLast30: 24,
    },
  };
}
