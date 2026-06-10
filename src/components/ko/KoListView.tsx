"use client";

import { useState } from "react";
import type { QueueItemResponse } from "@/lib/sales/queue-score";
import { KoQueueCard } from "./KoQueueCard";

const LIST_PREVIEW = 10;

type Props = {
  nyItems: QueueItemResponse[];
  contactedItems: QueueItemResponse[];
  contactedOpen: boolean;
  onContactedOpenChange: (open: boolean) => void;
  busyOrgnr: string | null;
  actionOrgnr: string | null;
  onMarkContacted: (orgnr: string) => void;
  onSendEmail: (item: QueueItemResponse) => void;
  onRemoveFromQueue: (orgnr: string) => void;
  onRequestDelete: (item: QueueItemResponse) => void;
};

export function KoListView({
  nyItems,
  contactedItems,
  contactedOpen,
  onContactedOpenChange,
  busyOrgnr,
  actionOrgnr,
  onMarkContacted,
  onSendEmail,
  onRemoveFromQueue,
  onRequestDelete,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleNy = showAll ? nyItems : nyItems.slice(0, LIST_PREVIEW);

  return (
    <div className="space-y-6">
      {nyItems.length === 0 ? (
        <p className="scan-glass-muted text-sm">
          Ingen nye firma igjen i køen akkurat nå.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleNy.map((item, index) => (
            <li key={item.orgnr}>
              <KoQueueCard
                item={item}
                rank={index + 1}
                variant="compact"
                busy={busyOrgnr === item.orgnr || actionOrgnr === item.orgnr}
                onMarkContacted={() => onMarkContacted(item.orgnr)}
                onSendEmail={() => onSendEmail(item)}
                onRemoveFromQueue={() => onRemoveFromQueue(item.orgnr)}
                onRequestDelete={() => onRequestDelete(item)}
              />
            </li>
          ))}
        </ul>
      )}

      {nyItems.length > LIST_PREVIEW && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-semibold text-sky-300 underline hover:text-sky-200"
        >
          Vis alle {nyItems.length} i køen
        </button>
      )}

      {contactedItems.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => onContactedOpenChange(!contactedOpen)}
            className="ko-queue-section-toggle flex w-full items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-left text-sm font-semibold text-slate-200"
          >
            Kontaktet i dag ({contactedItems.length})
          </button>
          {contactedOpen && (
            <ul className="mt-2 space-y-2">
              {contactedItems.map((item) => (
                <li key={item.orgnr}>
                  <KoQueueCard
                    item={item}
                    variant="compact"
                    busy={actionOrgnr === item.orgnr}
                    onMarkContacted={() => onMarkContacted(item.orgnr)}
                    onSendEmail={() => onSendEmail(item)}
                    onRemoveFromQueue={() => onRemoveFromQueue(item.orgnr)}
                    onRequestDelete={() => onRequestDelete(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
