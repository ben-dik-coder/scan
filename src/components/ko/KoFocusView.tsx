"use client";

import type { QueueItemResponse } from "@/lib/sales/queue-score";
import { KoQueueCard } from "./KoQueueCard";

type Props = {
  item: QueueItemResponse;
  currentIndex: number;
  totalNy: number;
  contactedCount: number;
  busy: boolean;
  onMarkContacted: () => void;
  onSendEmail: () => void;
  onSkip: () => void;
  onRemoveFromQueue: () => void;
  onRequestDelete: () => void;
};

export function KoFocusView({
  item,
  currentIndex,
  totalNy,
  contactedCount,
  busy,
  onMarkContacted,
  onSendEmail,
  onSkip,
  onRemoveFromQueue,
  onRequestDelete,
}: Props) {
  const done = contactedCount;
  const total = contactedCount + totalNy;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <p className="scan-glass-strong font-semibold">
            Lead {currentIndex} av {totalNy}
            {contactedCount > 0 && (
              <span className="scan-glass-muted ml-2 font-normal">
                · {contactedCount} ferdig i dag
              </span>
            )}
          </p>
          <span className="scan-glass-muted text-xs">{pct}%</span>
        </div>
        <div className="ko-focus-progress mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className="ko-focus-progress-fill h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <KoQueueCard
        item={item}
        rank={currentIndex}
        variant="focus"
        busy={busy}
        onMarkContacted={onMarkContacted}
        onSendEmail={onSendEmail}
        onSkip={onSkip}
        onRemoveFromQueue={onRemoveFromQueue}
        onRequestDelete={onRequestDelete}
      />
    </div>
  );
}
