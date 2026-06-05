"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import type { CampaignDetail, CampaignListItem } from "@/types/database";
import { CampaignRecipientList } from "./CampaignRecipientList";
import { formatCampaignDate } from "./campaign-utils";

type Props = {
  campaign: CampaignListItem | null;
  open: boolean;
  isDemo: boolean;
  demoDetail: CampaignDetail | null;
  onClose: () => void;
};

export function CampaignDetailDrawer({
  campaign,
  open,
  isDemo,
  demoDetail,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !campaign) {
      setDetail(null);
      setError(null);
      return;
    }

    if (isDemo) {
      setDetail(demoDetail);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente kampanje");
        setDetail(data as CampaignDetail);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Ukjent feil");
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [open, campaign, isDemo, demoDetail]);

  if (!campaign) return null;

  const activeDetail = isDemo ? demoDetail : detail;

  const header = (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 pr-14">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{formatCampaignDate(campaign.created_at)}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{campaign.subject}</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-200">
            {campaign.sent_count} sendt
          </span>
          {campaign.failed_count > 0 && (
            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 font-semibold text-red-200">
              {campaign.failed_count} feilet
            </span>
          )}
          {campaign.subject_b && (
            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-200">
              A/B-test
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AppSideDrawer
      open={open}
      onClose={onClose}
      header={header}
      panelClassName="campaign-drawer"
    >
      <div className="space-y-5 p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Laster detaljer…
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {activeDetail && (
          <>
            {activeDetail.campaign.subject_b && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Emne B
                </h3>
                <p className="text-sm text-slate-300">{activeDetail.campaign.subject_b}</p>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Melding
              </h3>
              <div className="campaign-preview rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                {activeDetail.campaign.body || "Ingen meldingstekst lagret."}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mottakere ({activeDetail.recipients.length})
              </h3>
              <CampaignRecipientList recipients={activeDetail.recipients} />
            </section>
          </>
        )}
      </div>
    </AppSideDrawer>
  );
}
