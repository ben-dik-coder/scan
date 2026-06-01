"use client";

import { useState } from "react";
import { RefreshCw, Database } from "lucide-react";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";
import { PageHeader, StatCard } from "@/components/ui/primitives";

type Props = {
  initialStats: {
    totalCompanies: number;
    withEmail: number;
    syncState: {
      last_sync: string | null;
      metadata: Record<string, unknown> | null;
    } | null;
    topKommuner: Array<{ code: string; name: string; count: number }>;
  };
  demo?: boolean;
};

export function AdminDashboard({ initialStats, demo }: Props) {
  const [stats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSync(bootstrap: boolean) {
    setLoading(true);
    setMessage(null);

    if (demo || isDemoMode()) {
      setTimeout(() => {
        setMessage(
          bootstrap
            ? "Demo: 1 247 firma importert fra Brønnøysund (simulert)"
            : "Demo: 23 nye firma synket (simulert)"
        );
        setLoading(false);
      }, 1200);
      return;
    }

    try {
      const res = await fetch("/api/sync/brreg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap, days: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync feilet");
      setMessage(`${data.mode}: ${data.upserted} firma lagret`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Feil");
    } finally {
      setLoading(false);
    }
  }

  const meta = stats.syncState?.metadata as
    | { mode?: string; processed?: number; upserted?: number }
    | null
    | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        description="Sync og statistikk fra Brønnøysund"
      />

      {(demo || isDemoMode()) && !isBrregLive() && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4 text-sm text-brand-gold">
          <Database className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Backend er ikke koblet til. Knappene under simulerer sync — sett opp Supabase for
            lagring i database.
          </p>
        </div>
      )}
      {isBrregLive() && (demo || isDemoMode()) && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <Database className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Skann-siden henter firma live fra Brønnøysund. Sync-knappene lagrer til Supabase når
            du har database koblet.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Firma i database" value={stats.totalCompanies} />
        <StatCard label="Med e-post" value={stats.withEmail} highlight />
        <StatCard
          label="Siste sync"
          value={
            stats.syncState?.last_sync
              ? new Date(stats.syncState.last_sync).toLocaleString("nb-NO")
              : "Aldri"
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => runSync(false)}
          className="btn-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Kjør daglig sync
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => runSync(true)}
          className="btn-secondary disabled:opacity-50"
        >
          Bootstrap (siste 90 dager)
        </button>
      </div>

      {meta && (
        <p className="text-sm text-white/50">
          Siste kjøring: {meta.mode} — {meta.upserted ?? 0} lagret
        </p>
      )}
      {message && <p className="text-sm text-brand-gold">{message}</p>}

      <section>
        <h2 className="mb-4 font-display text-lg font-bold text-white">Topp kommuner</h2>
        <div className="panel overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-5 py-3.5">Kommune</th>
                <th className="px-5 py-3.5">Antall</th>
              </tr>
            </thead>
            <tbody>
              {stats.topKommuner.map((k) => (
                <tr key={k.code} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3.5 text-white">{k.name}</td>
                  <td className="px-5 py-3.5 text-white/50">{k.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
