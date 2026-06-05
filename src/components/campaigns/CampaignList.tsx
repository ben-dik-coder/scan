"use client";

import { ChevronRight, Mail } from "lucide-react";
import type { CampaignListItem } from "@/types/database";
import { formatCampaignDate } from "./campaign-utils";
import { cn } from "@/lib/utils";

type Props = {
  campaigns: CampaignListItem[];
  selectedId: string | null;
  onSelect: (campaign: CampaignListItem) => void;
};

export function CampaignList({ campaigns, selectedId, onSelect }: Props) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {campaigns.map((campaign) => (
        <li key={campaign.id}>
          <button
            type="button"
            onClick={() => onSelect(campaign)}
            className={cn(
              "campaign-row flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
              selectedId === campaign.id
                ? "border-brand-gold/40 bg-brand-gold/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60">
              <Mail className="h-4 w-4 text-brand-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">
                {campaign.subject}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatCampaignDate(campaign.created_at)}
                {campaign.subject_b && " · A/B-test"}
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-sm font-semibold text-brand-gold">{campaign.sent_count} sendt</p>
              {campaign.failed_count > 0 ? (
                <p className="text-xs font-semibold text-red-400">
                  {campaign.failed_count} feilet
                </p>
              ) : (
                <p className="text-xs text-slate-500">{campaign.recipient_count} mottakere</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          </button>
        </li>
      ))}
    </ul>
  );
}
