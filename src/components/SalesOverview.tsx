"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Mail,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NextStepBanner } from "@/components/journey/NextStepBanner";
import { OverviewFlowStory } from "@/components/overview/OverviewFlowStory";
import { cn } from "@/lib/utils";

function GlassStatCard({
  label,
  value,
  sub,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "app-overview-stat-card rounded-2xl border p-4 sm:p-5",
        highlight
          ? "border-emerald-400/40 bg-emerald-400/15"
          : "border-white/10 bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <Icon className="h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none text-white sm:text-4xl">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function SalesOverview({ stats }: { stats: SalesDashboardStats }) {
  const empty = stats.totalLeads === 0;
  const queueCount = stats.statusCounts.ny ?? 0;

  return (
    <div className="app-overview-page w-full max-w-none space-y-5 sm:space-y-6">
      <section className="scan-surface-full app-overview-hero-surface">
        <NextStepBanner pagePhase="overview" variant="hero" />

        {!empty ? (
          <div className="app-overview-engine-wrap border-t border-white/10 px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
            <OverviewFlowStory queueCount={queueCount} />
          </div>
        ) : null}

        {empty ? (
          <div className="border-t border-white/10 px-4 py-10 text-center sm:px-6">
            <p className="text-lg font-semibold text-white">Start her: Skann markedet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Én enkel vei: Skann → Kø → Kontakt → Pipeline → Oversikt
            </p>
            <ol className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2 text-xs font-semibold text-zinc-400">
              {["1. Skann", "2. Kø", "3. Kontakt", "4. Pipeline", "5. Oversikt"].map(
                (step) => (
                  <li
                    key={step}
                    className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5"
                  >
                    {step}
                  </li>
                )
              )}
            </ol>
            <Link
              href="/app"
              className="scan-btn-primary mt-6 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold"
            >
              Gå til Skann
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6 border-t border-white/10 p-4 sm:p-5">
            <div className="app-overview-stats grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GlassStatCard
                label="Leads totalt"
                value={stats.totalLeads}
                icon={Users}
                sub="Alle firma du følger opp"
              />
              <GlassStatCard
                label="E-poster sendt"
                value={stats.totalSent}
                icon={Mail}
                sub="Fra arbeidskø og pipeline"
              />
              <GlassStatCard
                label="Aktive sekvenser"
                value={stats.activeSequences}
                icon={TrendingUp}
                sub="Automatisk oppfølging"
              />
              <Link href="/app/pipeline" className="block transition hover:opacity-95">
                <GlassStatCard
                  label="Oppfølging i dag"
                  value={stats.dueFollowUps}
                  highlight={stats.dueFollowUps > 0}
                  icon={Bell}
                  sub="Klikk for å åpne Pipeline"
                />
              </Link>
            </div>

            <section className="app-overview-pipeline-section">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 className="scan-glass-strong text-base font-semibold">
                  Pipeline-fordeling
                </h2>
                <Link
                  href="/app/pipeline"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Åpne pipeline →
                </Link>
              </div>

              <div className="app-overview-pipeline-bar" role="img" aria-label="Pipeline-fordeling">
                {LEAD_STATUSES.map((s) => {
                  const count = stats.statusCounts[s.id] ?? 0;
                  if (count <= 0 || stats.totalLeads <= 0) return null;
                  const pct = (count / stats.totalLeads) * 100;
                  return (
                    <Link
                      key={s.id}
                      href="/app/pipeline"
                      title={`${s.label}: ${count} (${Math.round(pct)}%)`}
                      className={cn("app-overview-pipeline-seg", `is-${s.id}`)}
                      style={{ flexGrow: Math.max(pct, 1.5) }}
                    />
                  );
                })}
              </div>

              <div className="app-overview-pipeline-legend mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {LEAD_STATUSES.map((s) => {
                  const count = stats.statusCounts[s.id] ?? 0;
                  const pct =
                    stats.totalLeads > 0
                      ? Math.round((count / stats.totalLeads) * 100)
                      : 0;
                  return (
                    <Link
                      key={s.id}
                      href="/app/pipeline"
                      className="app-overview-pipeline-card flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <span className={cn("h-2 w-2 rounded-full", s.color)} />
                        {s.label}
                      </span>
                      <div className="text-right tabular-nums">
                        <span className="font-display font-bold text-white">{count}</span>
                        <span className="ml-1.5 text-xs font-medium text-zinc-500">
                          {pct}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
