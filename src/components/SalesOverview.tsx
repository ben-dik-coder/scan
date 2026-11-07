"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { SalesDashboardStats } from "@/lib/sales/dashboard-stats";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  GitBranch,
  ListTodo,
  Loader2,
  Mail,
  PhoneCall,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNextStep } from "@/components/journey/useNextStep";
import { cn } from "@/lib/utils";

function StatCard({
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
        "app-overview-stat-card rounded-lg border px-4 py-3.5",
        highlight
          ? "border-emerald-500/35 bg-emerald-500/[0.08]"
          : "border-white/[0.1] bg-white/[0.03]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            highlight ? "text-emerald-400" : "text-zinc-500"
          )}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function WhatNowPanel() {
  const { step, loading } = useNextStep();

  return (
    <section
      className="app-overview-panel flex h-full flex-col rounded-lg border border-white/[0.1] bg-white/[0.03]"
      aria-label="Hva nå"
    >
      <div className="border-b border-white/[0.08] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Hva nå</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Neste anbefalte handling</p>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finner neste steg…
          </div>
        ) : step ? (
          <>
            <div>
              <p className="text-base font-semibold text-white">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {step.body}
              </p>
              <p className="mt-3 text-[11px] tabular-nums text-zinc-600">
                Steg {Math.max(step.progress.current, 1)} av {step.progress.total}
              </p>
            </div>
            <Link
              href={step.cta.href}
              className="scan-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold"
            >
              {step.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Ingen anbefaling akkurat nå.</p>
        )}
      </div>
    </section>
  );
}

const QUICK_LINKS = [
  { href: "/app", label: "Skann", icon: Building2 },
  { href: "/app/ko", label: "Arbeidskø", icon: ListTodo },
  { href: "/app/ring", label: "Ring", icon: PhoneCall },
  { href: "/app/pipeline", label: "Pipeline", icon: GitBranch },
] as const;

export function SalesOverview({ stats }: { stats: SalesDashboardStats }) {
  const empty = stats.totalLeads === 0;

  return (
    <div className="app-overview-page w-full max-w-none space-y-5">
      <header className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-header-title text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Oversikt
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Status på leads, utsendelser og oppfølging
          </p>
        </div>
        <nav
          className="app-overview-actions flex flex-wrap gap-2"
          aria-label="Hurtigvalg"
        >
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-white/20 hover:bg-white/[0.07]"
            >
              <Icon className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {empty ? (
        <section className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-5 py-10 text-center sm:px-8">
          <p className="text-base font-semibold text-white">Ingen leads ennå</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            Start med å skanne markedet, legg firma i kø og ta kontakt. Oversikten
            fylles når du har leads.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-xs text-zinc-600">
            Skann → Kø → Kontakt → Pipeline → Oversikt
          </p>
          <Link
            href="/app"
            className="scan-btn-primary mt-6 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold"
          >
            Gå til Skann
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <>
          <div className="app-overview-stats grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Leads totalt"
              value={stats.totalLeads}
              icon={Users}
              sub="Alle firma du følger opp"
            />
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
            <Link href="/app/pipeline" className="block hover:opacity-95">
              <StatCard
                label="Oppfølging i dag"
                value={stats.dueFollowUps}
                highlight={stats.dueFollowUps > 0}
                icon={Bell}
                sub="Åpne Pipeline"
              />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
            <section className="app-overview-panel rounded-lg border border-white/[0.1] bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Pipeline-fordeling
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Status på {stats.totalLeads} leads
                  </p>
                </div>
                <Link
                  href="/app/pipeline"
                  className="text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Åpne pipeline →
                </Link>
              </div>

              <div className="divide-y divide-white/[0.06]">
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
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]"
                    >
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", s.color)}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-sm text-zinc-200">
                        {s.label}
                      </span>
                      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08] sm:block">
                        <div
                          className={cn("h-full rounded-full", s.color)}
                          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-white">
                        {count}
                      </span>
                      <span className="w-9 text-right text-xs tabular-nums text-zinc-500">
                        {pct}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <WhatNowPanel />
          </div>
        </>
      )}
    </div>
  );
}
