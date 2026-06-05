"use client";

import { SendCampaignForm } from "@/components/SendCampaignForm";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import type { EmailTemplate } from "@/types/database";
import type { QueueItemResponse } from "@/lib/sales/queue-score";
import { queueItemToCompany } from "./queue-utils";

type SequenceOption = { id: string; name: string; steps: unknown[] };

type Props = {
  item: QueueItemResponse | null;
  open: boolean;
  templates: EmailTemplate[];
  sequences: SequenceOption[];
  onClose: () => void;
  onSent: () => void;
};

export function KoSendDrawer({
  item,
  open,
  templates,
  sequences,
  onClose,
  onSent,
}: Props) {
  if (!item) return null;

  const company = queueItemToCompany(item);

  const header = (
    <div className="border-b border-white/10 p-4 pr-14">
      <h2 className="truncate text-lg font-semibold text-white">Send e-post</h2>
      <p className="truncate text-xs text-slate-400">{item.name}</p>
    </div>
  );

  return (
    <AppSideDrawer
      open={open}
      onClose={onClose}
      header={header}
      panelClassName="ko-send-drawer"
    >
      <div className="p-4">
        <SendCampaignForm
          selectedCompanies={[company]}
          templates={templates}
          sequences={sequences}
          onSent={() => {
            onSent();
            onClose();
          }}
          light={false}
          singleRecipient
        />
      </div>
    </AppSideDrawer>
  );
}
