"use client";

import { X } from "lucide-react";
import { SendCampaignForm } from "@/components/SendCampaignForm";
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
  if (!open || !item) return null;

  const company = queueItemToCompany(item);

  return (
    <>
      <button
        type="button"
        aria-label="Lukk"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="ko-send-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">Send e-post</h2>
            <p className="truncate text-xs text-slate-400">{item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SendCampaignForm
            selectedCompanies={[company]}
            templates={templates}
            sequences={sequences}
            onSent={() => {
              onSent();
              onClose();
            }}
            light={false}
          />
        </div>
      </aside>
    </>
  );
}
