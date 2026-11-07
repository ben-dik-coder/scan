import Link from "next/link";
import type { AnalyseBundle } from "@/lib/analyse/types";
import { formatPct } from "@/lib/analyse/metrics";
import {
  AnalyseBarList,
  AnalyseFunnel,
  AnalyseHealthCard,
  AnalyseKpiGrid,
  AnalyseMeter,
  AnalysePanel,
  AnalyseSparkBars,
} from "@/components/analyse/AnalyseWidgets";

export function AnalyseOverviewSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseHealthCard
        score={data.healthScore}
        label={data.healthLabel}
        hints={data.healthHints}
      />
      <AnalyseKpiGrid items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysePanel
          title="Pipeline akkurat nå"
          subtitle="Leads per status"
        >
          <AnalyseBarList items={data.pipeline} />
        </AnalysePanel>
        <AnalysePanel
          title="AI-ring siste 7 dager"
          subtitle="Antall startede samtaler"
        >
          <AnalyseSparkBars points={data.calls.last7Days} />
        </AnalysePanel>
      </div>
      <AnalysePanel title="Gå dypere" subtitle="Åpne et analyseverktøy">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/app/analyse/pipeline", label: "Pipeline-funnel" },
            { href: "/app/analyse/ring", label: "Ring & AI" },
            { href: "/app/analyse/kampanjer", label: "E-post" },
            { href: "/app/analyse/kostnader", label: "Kostnader" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              {item.label} →
            </Link>
          ))}
        </div>
      </AnalysePanel>
    </div>
  );
}

export function AnalysePipelineSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "total",
            label: "Leads",
            value: data.prospecting.totalLeads,
          },
          {
            id: "c1",
            label: "Kontaktet av alle",
            value: formatPct(data.conversion.contactedOfTotal),
          },
          {
            id: "c2",
            label: "Svarte av kontaktet",
            value: formatPct(data.conversion.repliedOfContacted),
          },
          {
            id: "c3",
            label: "Møte av svar",
            value: formatPct(data.conversion.meetingOfReplied),
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysePanel title="Statusfordeling">
          <AnalyseBarList items={data.pipeline} />
        </AnalysePanel>
        <AnalysePanel
          title="Konverteringsfunnel"
          subtitle="Andeler mellom stegene"
        >
          <AnalyseFunnel
            steps={[
              {
                label: "Ny → kontaktet+",
                value: data.conversion.contactedOfTotal,
              },
              {
                label: "Kontaktet → svarte",
                value: data.conversion.repliedOfContacted,
              },
              {
                label: "Svar → møte",
                value: data.conversion.meetingOfReplied,
              },
              {
                label: "Møte → vunnet",
                value: data.conversion.wonOfMeeting,
              },
            ]}
          />
        </AnalysePanel>
      </div>
    </div>
  );
}

export function AnalyseRingSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          { id: "t", label: "AI-samtaler", value: data.calls.total },
          {
            id: "c",
            label: "Svarrate",
            value: formatPct(data.calls.connectRate),
            tone: (data.calls.connectRate ?? 0) >= 30 ? "good" : "warn",
          },
          {
            id: "m",
            label: "Møterate",
            value: formatPct(data.calls.meetingRate),
          },
          {
            id: "month",
            label: "Denne måneden",
            value: data.costs.aiCallsThisMonth,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysePanel title="Utfall">
          <AnalyseBarList
            items={data.calls.byOutcome}
            empty="Ingen AI-utfall ennå — start et kall i Ring."
          />
        </AnalysePanel>
        <AnalysePanel title="Status">
          <AnalyseBarList items={data.calls.byStatus} />
        </AnalysePanel>
      </div>
      <AnalysePanel title="Volum siste 7 dager">
        <AnalyseSparkBars points={data.calls.last7Days} />
      </AnalysePanel>
      <p className="text-xs text-zinc-500">
        Se også{" "}
        <Link href="/app/ai-samtaler" className="text-sky-400 hover:underline">
          AI samtaler
        </Link>{" "}
        for transcript og detaljer.
      </p>
    </div>
  );
}

export function AnalyseSmsSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "sms",
            label: "SMS-relatert aktivitet",
            value: data.activity.smsRelated,
            sub: `Siste ${data.rangeDays} dager`,
          },
          {
            id: "call",
            label: "Ring-aktivitet",
            value: data.activity.callRelated,
          },
          {
            id: "mail",
            label: "E-post-aktivitet",
            value: data.activity.emailRelated,
          },
          {
            id: "all",
            label: "All aktivitet",
            value: data.activity.total,
          },
        ]}
      />
      <AnalysePanel
        title="Kanal-mix"
        subtitle="Basert på aktivitetslogg (SMS telles når beskrivelsen matcher)"
      >
        <AnalyseBarList
          items={[
            { id: "sms", label: "SMS", count: data.activity.smsRelated },
            { id: "call", label: "Ring", count: data.activity.callRelated },
            { id: "email", label: "E-post", count: data.activity.emailRelated },
          ]}
        />
      </AnalysePanel>
      <p className="text-sm text-zinc-500">
        Tips: bruk{" "}
        <Link href="/app/sms" className="text-sky-400 hover:underline">
          SMS-modus
        </Link>{" "}
        — da dukker mer opp her over tid.
      </p>
    </div>
  );
}

export function AnalyseKampanjerSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "sent",
            label: "E-post sendt",
            value: data.email.campaignSent,
          },
          {
            id: "fail",
            label: "Feilet",
            value: data.email.campaignFailed,
            tone: data.email.campaignFailed > 0 ? "warn" : "good",
          },
          {
            id: "fr",
            label: "Feilrate",
            value: formatPct(data.email.failRate),
          },
          {
            id: "active",
            label: "Aktive sekvenser",
            value: data.email.activeEnrollments,
          },
        ]}
      />
      <AnalysePanel title="Sekvens-status">
        <AnalyseBarList items={data.email.enrollmentsByStatus} />
      </AnalysePanel>
    </div>
  );
}

export function AnalyseProspekteringSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "leads",
            label: "Leads totalt",
            value: data.prospecting.totalLeads,
          },
          {
            id: "q",
            label: "I arbeidskø",
            value: data.prospecting.queued,
          },
          {
            id: "due",
            label: "Forfalt oppfølging",
            value: data.prospecting.dueFollowUps,
            tone: data.prospecting.dueFollowUps > 0 ? "warn" : "good",
          },
          {
            id: "won",
            label: "Vunnet-andel",
            value: formatPct(data.prospecting.wonShare),
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysePanel title="Dekning">
          <AnalyseBarList
            items={[
              {
                id: "queued",
                label: "I kø",
                count: data.prospecting.queued,
              },
              {
                id: "rest",
                label: "Utenfor kø",
                count: Math.max(
                  0,
                  data.prospecting.totalLeads - data.prospecting.queued
                ),
              },
            ]}
          />
        </AnalysePanel>
        <AnalysePanel title="Kontaktandel">
          <p className="text-4xl font-semibold tabular-nums text-white">
            {formatPct(data.prospecting.contactedShare)}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Andel leads som er kommet forbi status «Ny».
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            >
              Skann flere
            </Link>
            <Link
              href="/app/ko"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            >
              Åpne kø
            </Link>
          </div>
        </AnalysePanel>
      </div>
    </div>
  );
}

export function AnalyseAktivitetSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "tot",
            label: `Aktiviteter (${data.rangeDays} d)`,
            value: data.activity.total,
          },
          {
            id: "top",
            label: "Vanligste handling",
            value: data.activity.byType[0]?.label ?? "—",
            sub: data.activity.byType[0]
              ? `${data.activity.byType[0].count} ganger`
              : undefined,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysePanel title="Typer">
          <AnalyseBarList
            items={data.activity.byType}
            empty="Ingen aktivitet i perioden."
          />
        </AnalysePanel>
        <AnalysePanel title="Siste 14 dager">
          <AnalyseSparkBars points={data.activity.last14Days} />
        </AnalysePanel>
      </div>
    </div>
  );
}

export function AnalyseKostnaderSection({ data }: { data: AnalyseBundle }) {
  return (
    <div className="space-y-4">
      <AnalyseKpiGrid
        items={[
          {
            id: "serper",
            label: "Serper igjen",
            value: data.costs.serperRemaining,
            sub: `av ${data.costs.serperLimit} / mnd`,
            tone:
              data.costs.serperRemaining < 100
                ? "warn"
                : data.costs.serperRemaining < 30
                  ? "bad"
                  : "good",
          },
          {
            id: "ai-m",
            label: "AI-ring denne mnd",
            value: data.costs.aiCallsThisMonth,
          },
          {
            id: "ai-30",
            label: "AI-ring siste 30 d",
            value: data.costs.aiCallsLast30,
          },
        ]}
      />
      <AnalysePanel title="Kvote denne måneden">
        <div className="space-y-5">
          <AnalyseMeter
            label="Serper (nettsøk / enrich)"
            used={data.costs.serperUsed}
            limit={data.costs.serperLimit}
          />
          <p className="text-xs text-zinc-500">
            AI-ring faktureres via ElevenLabs/Twilio utenfor denne måleren — her
            ser du volum.
          </p>
        </div>
      </AnalysePanel>
    </div>
  );
}
