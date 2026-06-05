"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CampaignRecipientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  sent: "Sendt",
  failed: "Feilet",
  pending: "Venter",
  blocked: "Blokkert",
  unsubscribed: "Avmeldt",
};

type Props = {
  recipients: CampaignRecipientDetail[];
  showFailedFirst?: boolean;
};

export function CampaignRecipientList({ recipients, showFailedFirst = true }: Props) {
  const failed = recipients.filter((r) => r.status === "failed");
  const others = recipients.filter((r) => r.status !== "failed");

  const ordered = showFailedFirst ? [...failed, ...others] : recipients;

  if (recipients.length === 0) {
    return <p className="text-sm text-slate-500">Ingen mottakere registrert.</p>;
  }

  return (
    <div className="space-y-4">
      {showFailedFirst && failed.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            Feilet ({failed.length})
          </h4>
          <ul className="space-y-2">
            {failed.map((r) => (
              <RecipientRow key={r.id} recipient={r} highlight />
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          {showFailedFirst && failed.length > 0 && (
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Alle mottakere ({recipients.length})
            </h4>
          )}
          <ul className="space-y-2">
            {(showFailedFirst ? others : ordered).map((r) => (
              <RecipientRow key={r.id} recipient={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecipientRow({
  recipient,
  highlight = false,
}: {
  recipient: CampaignRecipientDetail;
  highlight?: boolean;
}) {
  return (
    <li
      className={cn(
        "campaign-recipient-row rounded-lg border px-3 py-2.5",
        highlight
          ? "border-red-400/30 bg-red-500/10"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">
            {recipient.companyName}
          </p>
          <p className="truncate text-xs text-slate-400">{recipient.email}</p>
          {recipient.error_message && (
            <p className="mt-1 text-xs text-red-300">{recipient.error_message}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={recipient.status} />
          {recipient.ab_variant && (
            <span className="text-[10px] text-slate-500">Variant {recipient.ab_variant.toUpperCase()}</span>
          )}
        </div>
      </div>
      <Link
        href="/app/pipeline"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
      >
        <ExternalLink className="h-3 w-3" />
        Åpne i Pipeline
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "campaign-recipient-status rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        status === "sent" && "campaign-recipient-status--sent",
        status === "failed" && "campaign-recipient-status--failed",
        status === "blocked" && "campaign-recipient-status--blocked",
        status === "pending" && "campaign-recipient-status--pending",
        status === "unsubscribed" && "campaign-recipient-status--pending"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
