"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { CampaignDetailDrawer } from "@/components/campaigns/CampaignDetailDrawer";
import { CampaignList } from "@/components/campaigns/CampaignList";
import { CampaignToolbar } from "@/components/campaigns/CampaignToolbar";
import {
  campaignStats,
  filterCampaigns,
} from "@/components/campaigns/campaign-utils";
import { buildDemoCampaignDetail } from "@/components/campaigns/demo-detail";
import { PageHeader } from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo/store";
import type { CampaignListItem } from "@/types/database";

type Props = {
  initialCampaigns: CampaignListItem[];
  isDemo: boolean;
};

function toListItems(
  campaigns: Array<CampaignListItem & { recipient_count?: number }>
): CampaignListItem[] {
  return campaigns.map((c) => ({
    ...c,
    recipient_count: c.recipient_count ?? c.sent_count + c.failed_count,
  }));
}

export function KampanjerClient({ initialCampaigns, isDemo }: Props) {
  const demo = useDemo();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>(
    toListItems(initialCampaigns)
  );
  const [search, setSearch] = useState("");
  const [hasFailures, setHasFailures] = useState(false);
  const [last30Days, setLast30Days] = useState(false);
  const [selected, setSelected] = useState<CampaignListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemo) return;
    setCampaigns(
      toListItems(
        demo.campaigns.map((c) => ({
          ...c,
          recipient_count: c.sent_count + c.failed_count,
        }))
      )
    );
  }, [isDemo, demo.campaigns]);

  const filtered = useMemo(
    () => filterCampaigns(campaigns, { search, hasFailures, last30Days }),
    [campaigns, search, hasFailures, last30Days]
  );

  const stats = useMemo(() => campaignStats(campaigns), [campaigns]);

  const demoDetail = useMemo(() => {
    if (!isDemo || !selected) return null;
    const orgnrs = demo.campaignRecipients[selected.id];
    return buildDemoCampaignDetail(selected, demo.companies, orgnrs);
  }, [isDemo, selected, demo.companies, demo.campaignRecipients]);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Kunne ikke oppdatere");
      }
      const data = (await res.json()) as CampaignListItem[];
      setCampaigns(toListItems(Array.isArray(data) ? data : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  return (
    <div className="scan-glass-kommand space-y-6 pb-8">
      <PageHeader
        title="Kampanjer"
        description="Historikk over sendte e-poster — klikk en rad for detaljer og mottakere"
      />

      {campaigns.length > 0 && (
        <CampaignToolbar
          campaignCount={stats.count}
          totalSent={stats.totalSent}
          totalFailed={stats.totalFailed}
          visibleCount={filtered.length}
          search={search}
          onSearchChange={setSearch}
          hasFailures={hasFailures}
          onHasFailuresChange={setHasFailures}
          last30Days={last30Days}
          onLast30DaysChange={setLast30Days}
          loading={loading}
          onRefresh={isDemo ? undefined : () => void refresh()}
        />
      )}

      {error && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      )}

      {campaigns.length === 0 ? (
        <div className="campaign-empty rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
          <Send className="mx-auto h-8 w-8 text-brand-gold/60" />
          <p className="scan-glass-strong mt-4 text-sm font-semibold">
            Du har ikke sendt noen kampanjer ennå
          </p>
          <p className="scan-glass-muted mt-2 text-sm">
            Velg firma på Skann og send e-post — historikken dukker opp her.
          </p>
          <Link href="/app" className="btn-primary mt-4 inline-block text-sm">
            Gå til Skann
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="scan-glass-muted text-sm">
          Ingen treff med filteret ditt.{" "}
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setHasFailures(false);
              setLast30Days(false);
            }}
            className="font-semibold text-sky-300 underline"
          >
            Nullstill filter
          </button>
        </p>
      ) : (
        <CampaignList
          campaigns={filtered}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      )}

      <CampaignDetailDrawer
        campaign={selected}
        open={Boolean(selected)}
        isDemo={isDemo}
        demoDetail={demoDetail}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
