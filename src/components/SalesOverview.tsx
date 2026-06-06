"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  GraduationCap,
  Mail,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { NextStepBanner } from "@/components/journey/NextStepBanner";
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
          ? "border-sky-400/40 bg-sky-400/15"
          : "border-white/20 bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
          {label}
        </p>
        <Icon className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none text-white sm:text-4xl">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export function SalesOverview({ stats }: { stats: SalesDashboardStats }) {
  const { openOnboarding } = useOnboarding();
  const empty = stats.totalLeads === 0;

  return (
    <div className="app-overview-page w-full max-w-none space-y-4 sm:space-y-5">
      <section className="scan-surface-full overflow-hidden">
        <NextStepBanner pagePhase="overview" variant="hero" />

        <header className="scan-glass-header flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h1 className="scan-glass-title text-xl sm:text-2xl">Oversikt</h1>
            <p className="scan-glass-muted mt-1 text-sm">
              Kommandosenter — se fremdrift og hva du bør gjøre nå
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/app/ko"
              className="scan-btn-primary inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 px-4 text-sm font-semibold sm:w-auto"
            >
              Jobb i køen
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={openOnboarding}
              className="scan-btn-ghost inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 px-4 text-sm font-semibold sm:w-auto"
            >
              <GraduationCap className="h-4 w-4" />
              Veiledning
            </button>
          </div>
        </header>

        {empty ? (
          <div className="border-t border-white/10 px-4 py-10 text-center sm:px-6">
            <p className="text-lg font-semibold text-white">Start her: Skann markedet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
              Én enkel vei: Skann → Kø → Kontakt → Pipeline → Oversikt
            </p>
            <ol className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2 text-xs font-semibold text-slate-300">
              {["1. Skann", "2. Kø", "3. Kontakt", "4. Pipeline", "5. Oversikt"].map((step) => (
                <li
                  key={step}
                  className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5"
                >
                  {step}
                </li>
              ))}
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
          <div className="space-y-5 border-t border-white/10 p-4 sm:p-5">
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

            <section>
              <h2 className="scan-glass-strong mb-3 text-base font-semibold">
                Pipeline-fordeling
              </h2>
              <div className="app-overview-pipeline grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {LEAD_STATUSES.map((s) => {
                  const count = stats.statusCounts[s.id] ?? 0;
                  const pct =
                    stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
                  return (
                    <Link
                      key={s.id}
                      href="/app/pipeline"
                      className="app-overview-pipeline-card flex items-center justify-between rounded-xl border border-white/15 bg-white/6 px-4 py-3 transition hover:border-sky-400/35 hover:bg-white/10"
                    >
                      <span className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                        <span className={cn("h-2 w-2 rounded-full", s.color)} />
                        {s.label}
                      </span>
                      <div className="text-right">
                        <span className="font-display font-bold text-white">{count}</span>
                        <span className="ml-1.5 text-xs font-medium text-slate-400">{pct}%</span>
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
