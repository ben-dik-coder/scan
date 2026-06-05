"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import Link from "next/link";
import { ArrowRight, Bell, Mail, Sparkles, TrendingUp, Users } from "lucide-react";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { NextStepBanner } from "@/components/journey/NextStepBanner";
import { PageHeader, StatCard } from "@/components/ui/primitives";

export function SalesOverview({ stats }: { stats: SalesDashboardStats }) {
  const { openOnboarding } = useOnboarding();

  const empty = stats.totalLeads === 0;

  return (
    <div className="app-overview-page space-y-8">
      <NextStepBanner pagePhase="overview" variant="hero" />

      <PageHeader
        title="Oversikt"
        description="Kommandosenter — se fremdrift og hva du bør gjøre nå"
        action={
          <button
            type="button"
            onClick={openOnboarding}
            className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 text-xs sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <Sparkles className="h-4 w-4" />
            Kom i gang
          </button>
        }
      />

      {empty ? (
        <div className="panel px-6 py-10 text-center">
          <p className="text-lg font-semibold text-brand-navy">Start her: Skann markedet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Én enkel vei: Skann → Kø → Kontakt → Pipeline → Oversikt
          </p>
          <ol className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2 text-xs font-semibold text-slate-600">
            {["1. Skann", "2. Kø", "3. Kontakt", "4. Pipeline", "5. Oversikt"].map((step) => (
              <li key={step} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                {step}
              </li>
            ))}
          </ol>
          <Link
            href="/app"
            className="btn-primary mt-6 inline-flex items-center gap-1.5 text-sm"
          >
            Gå til Skann
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="app-overview-stats grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Leads totalt" value={stats.totalLeads} icon={Users} sub="Alle firma du følger opp" />
            <StatCard
              label="E-poster sendt"
              value={stats.totalSent}
              icon={Mail}
              sub="Fra arbeidskø og pipeline"
            />
            <StatCard
              label="Aktive sekvenser"
              value={stats.activeSequences}
              icon={TrendingUp}
              sub="Automatisk oppfølging"
            />
            <Link href="/app/pipeline" className="block">
              <StatCard
                label="Oppfølging i dag"
                value={stats.dueFollowUps}
                highlight={stats.dueFollowUps > 0}
                icon={Bell}
                sub="Klikk for å åpne Pipeline"
              />
            </Link>
          </div>

          <section>
            <h2 className="app-section-title">Pipeline-fordeling</h2>
            <div className="app-overview-pipeline grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LEAD_STATUSES.map((s) => {
                const count = stats.statusCounts[s.id] ?? 0;
                const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
                return (
                  <Link
                    key={s.id}
                    href="/app/pipeline"
                    className="panel flex items-center justify-between px-4 py-3 transition hover:border-brand-gold/30 hover:ring-1 hover:ring-brand-gold/15"
                  >
                    <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      {s.label}
                    </span>
                    <div className="text-right">
                      <span className="font-display font-bold text-brand-navy">{count}</span>
                      <span className="ml-1.5 text-xs font-medium text-slate-500">{pct}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

