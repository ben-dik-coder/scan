"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import Link from "next/link";
import { ArrowRight, Bell, Mail, Sparkles, TrendingUp, Users } from "lucide-react";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { PageHeader, StatCard } from "@/components/ui/primitives";

export function SalesOverview({ stats }: { stats: SalesDashboardStats }) {
  const { canRestart, openOnboarding } = useOnboarding();

  return (
    <div className="app-overview-page space-y-8">
      <PageHeader
        title="Oversikt"
        description="Dine utsendelser og pipeline — finn nye kunder under Skann"
        action={
          <div className="app-overview-actions flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canRestart && (
              <button
                type="button"
                onClick={openOnboarding}
                className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 text-xs sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Sparkles className="h-4 w-4" />
                Kom i gang
              </button>
            )}
            <Link
              href="/app"
              className="btn-primary inline-flex w-full items-center justify-center gap-1.5 text-xs sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Skann markedet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="app-overview-stats grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads totalt" value={stats.totalLeads} icon={Users} />
        <StatCard label="E-poster sendt" value={stats.totalSent} icon={Mail} />
        <StatCard label="Aktive sekvenser" value={stats.activeSequences} icon={TrendingUp} />
        <StatCard
          label="Oppfølging i dag"
          value={stats.dueFollowUps}
          highlight={stats.dueFollowUps > 0}
          icon={Bell}
        />
      </div>

      <section>
        <h2 className="app-section-title">Pipeline-fordeling</h2>
        <div className="app-overview-pipeline grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEAD_STATUSES.map((s) => {
            const count = stats.statusCounts[s.id] ?? 0;
            const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
            return (
              <div
                key={s.id}
                className="panel flex items-center justify-between px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  {s.label}
                </span>
                <div className="text-right">
                  <span className="font-display font-bold text-brand-navy">{count}</span>
                  <span className="ml-1.5 text-xs font-medium text-slate-500">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

