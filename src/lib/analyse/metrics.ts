import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import type {
  AnalyseDayPoint,
  AnalyseKpi,
  AnalyseNamedCount,
  AnalyseRangeDays,
} from "@/lib/analyse/types";

export function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

export function toNamedCounts(
  counts: Record<string, number>,
  order: readonly string[],
  labelFn: (id: string) => string
): AnalyseNamedCount[] {
  const keys = new Set([...order, ...Object.keys(counts)]);
  return Array.from(keys)
    .map((id) => ({ id, label: labelFn(id), count: counts[id] ?? 0 }))
    .filter((row) => row.count > 0 || order.includes(row.id));
}

export function emptyDaySeries(days: number): AnalyseDayPoint[] {
  const out: AnalyseDayPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      date: iso,
      label: d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
      count: 0,
    });
  }
  return out;
}

export function fillDaySeries(
  days: number,
  rows: Array<{ created_at: string | null }>
): AnalyseDayPoint[] {
  const series = emptyDaySeries(days);
  const index = new Map(series.map((p, i) => [p.date, i]));
  for (const row of rows) {
    if (!row.created_at) continue;
    const key = row.created_at.slice(0, 10);
    const i = index.get(key);
    if (i == null) continue;
    series[i]!.count += 1;
  }
  return series;
}

const ACTIVITY_LABELS: Record<string, string> = {
  email_sent: "E-post sendt",
  status_changed: "Status endret",
  note_added: "Notat",
  call: "Ring",
  sequence_enrolled: "Sekvens startet",
  sequence_sent: "Sekvens-steg",
  sequence_paused: "Sekvens pauset",
  follow_up_set: "Oppfølging satt",
  sms_sent: "SMS sendt",
};

export function activityLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type;
}

const CALL_STATUS_LABELS: Record<string, string> = {
  queued: "I kø",
  ringing: "Ringer",
  in_progress: "Pågår",
  ended: "Avsluttet",
  failed: "Feilet",
};

const CALL_OUTCOME_LABELS: Record<string, string> = {
  meeting: "Møte",
  not_interested: "Ikke interessert",
  no_answer: "Ikke svar",
  voicemail: "Mobilsvar",
  other: "Annet",
};

export function callStatusLabel(id: string): string {
  return CALL_STATUS_LABELS[id] ?? id;
}

export function callOutcomeLabel(id: string): string {
  return CALL_OUTCOME_LABELS[id] ?? id;
}

export function pipelineFromStatusCounts(
  statusCounts: Record<string, number>
): AnalyseNamedCount[] {
  return LEAD_STATUSES.map((s) => ({
    id: s.id,
    label: s.label,
    count: statusCounts[s.id] ?? 0,
  }));
}

export function buildHealth(input: {
  totalLeads: number;
  statusCounts: Record<string, number>;
  dueFollowUps: number;
  connectRate: number | null;
  failRate: number | null;
  activityLast7: number;
}): { score: number; label: string; hints: string[] } {
  let score = 55;
  const hints: string[] = [];

  const won = input.statusCounts.vunnet ?? 0;
  const meeting = input.statusCounts.moete_booket ?? 0;
  const contacted =
    (input.statusCounts.kontaktet ?? 0) +
    (input.statusCounts.svarte ?? 0) +
    meeting +
    won +
    (input.statusCounts.tapt ?? 0) +
    (input.statusCounts.ikke_interessert ?? 0);

  if (input.totalLeads === 0) {
    return {
      score: 20,
      label: "Tom start",
      hints: ["Legg leads i kø fra Skann for å få tall her."],
    };
  }

  const contactShare = pct(contacted, input.totalLeads) ?? 0;
  if (contactShare >= 40) score += 12;
  else if (contactShare < 15) {
    score -= 10;
    hints.push("Få flere leads ut av «Ny» — ring eller send SMS.");
  }

  if (meeting + won > 0) score += 10;
  if (won > 0) score += 8;

  if (input.dueFollowUps > 8) {
    score -= 12;
    hints.push(`${input.dueFollowUps} oppfølginger er forfalt.`);
  } else if (input.dueFollowUps > 0) {
    score -= 4;
    hints.push("Rydd forfalte oppfølginger for bedre tempo.");
  }

  if (input.connectRate != null) {
    if (input.connectRate >= 35) score += 10;
    else if (input.connectRate < 15) {
      score -= 8;
      hints.push("Lav svarrate på AI-ring — sjekk manus og tidspunkt.");
    }
  }

  if (input.failRate != null && input.failRate > 15) {
    score -= 8;
    hints.push("Høy feilrate på e-post — sjekk kobling og lister.");
  }

  if (input.activityLast7 >= 20) score += 8;
  else if (input.activityLast7 < 3) {
    score -= 10;
    hints.push("Lite aktivitet siste 7 dager.");
  }

  score = Math.max(5, Math.min(98, Math.round(score)));

  let label = "Stabil";
  if (score >= 80) label = "Sterk";
  else if (score >= 65) label = "God";
  else if (score >= 45) label = "Moderat";
  else label = "Trenger løft";

  if (hints.length === 0) {
    hints.push("Hold tempoet — pipeline og ring ser sunne ut.");
  }

  return { score, label, hints: hints.slice(0, 4) };
}

export function buildOverviewKpis(bundleParts: {
  totalLeads: number;
  meetings: number;
  won: number;
  dueFollowUps: number;
  connectRate: number | null;
  activeSequences: number;
  aiCalls: number;
  activityWeek: number;
}): AnalyseKpi[] {
  return [
    {
      id: "leads",
      label: "Leads totalt",
      value: bundleParts.totalLeads,
      sub: "I din CRM",
    },
    {
      id: "meetings",
      label: "Møter",
      value: bundleParts.meetings,
      tone: bundleParts.meetings > 0 ? "good" : "default",
      sub: "Status møte booket",
    },
    {
      id: "won",
      label: "Vunnet",
      value: bundleParts.won,
      tone: bundleParts.won > 0 ? "good" : "default",
    },
    {
      id: "followups",
      label: "Forfalt oppfølging",
      value: bundleParts.dueFollowUps,
      tone: bundleParts.dueFollowUps > 0 ? "warn" : "good",
    },
    {
      id: "connect",
      label: "AI svarrate",
      value: formatPct(bundleParts.connectRate),
      sub: "Ended uten no_answer/failed",
    },
    {
      id: "seq",
      label: "Aktive sekvenser",
      value: bundleParts.activeSequences,
    },
    {
      id: "ai",
      label: "AI-ring (periode)",
      value: bundleParts.aiCalls,
    },
    {
      id: "act",
      label: "Aktivitet 7 d",
      value: bundleParts.activityWeek,
    },
  ];
}

export function leadStatusLabel(id: string): string {
  return statusLabel(id);
}

export type { AnalyseRangeDays };
