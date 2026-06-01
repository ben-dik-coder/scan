"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { EmailCampaign } from "@/types/database";
import Link from "next/link";
import { ArrowRight, Bell, Mail, TrendingUp, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/primitives";

export function SalesOverview({
  stats,
}: {
  stats: {
    totalLeads: number;
    statusCounts: Record<string, number>;
    totalSent: number;
    totalFailed: number;
    activeSequences: number;
    dueFollowUps: number;
    totalActivities: number;
  };
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Oversikt"
        description="Dine utsendelser og pipeline — finn nye kunder under Skann"
        action={
          <Link href="/app" className="btn-primary w-full text-xs sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm">
            Skann markedet
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <h2 className="mb-4 font-display text-lg font-bold text-white">Pipeline-fordeling</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEAD_STATUSES.map((s) => {
            const count = stats.statusCounts[s.id] ?? 0;
            const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
            return (
              <div
                key={s.id}
                className="panel flex items-center justify-between px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-sm text-white/70">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  {s.label}
                </span>
                <div className="text-right">
                  <span className="font-display font-bold text-white">{count}</span>
                  <span className="ml-1.5 text-xs text-white/50">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CampaignsList({ campaigns }: { campaigns: EmailCampaign[] }) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Kampanjer"
        description="Historikk over sendte e-poster"
      />

      <div className="panel overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-5 py-3.5">Dato</th>
              <th className="px-5 py-3.5">Emne</th>
              <th className="px-5 py-3.5">Sendt</th>
              <th className="px-5 py-3.5">Feilet</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5 text-white/50">
                  {new Date(c.created_at).toLocaleString("nb-NO")}
                </td>
                <td className="px-5 py-3.5 font-medium text-white">{c.subject}</td>
                <td className="px-5 py-3.5 font-semibold text-brand-gold">{c.sent_count}</td>
                <td className="px-5 py-3.5 font-semibold text-red-400">{c.failed_count}</td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-white/50">
                  Ingen kampanjer sendt ennå
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
