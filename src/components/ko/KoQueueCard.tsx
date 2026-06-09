"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Phone,
  Trash2,
  UserMinus,
} from "lucide-react";
import { statusLabel } from "@/lib/sales/constants";
import type { QueueItemResponse } from "@/lib/sales/queue-score";
import { cn, formatCompanyName, formatRegisteredDate } from "@/lib/utils";
import { useState } from "react";

type Props = {
  item: QueueItemResponse;
  rank?: number;
  variant?: "focus" | "compact";
  busy?: boolean;
  onMarkContacted: () => void;
  onSendEmail?: () => void;
  onSkip?: () => void;
  onRemoveFromQueue: () => void;
  onRequestDelete: () => void;
};

export function KoQueueCard({
  item,
  rank,
  variant = "compact",
  busy = false,
  onMarkContacted,
  onSendEmail,
  onSkip,
  onRemoveFromQueue,
  onRequestDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isFocus = variant === "focus";
  const isContacted = item.status === "kontaktet";

  return (
    <article
      className={cn(
        "ko-queue-card rounded-xl border border-white/10 text-sm",
        isFocus ? "ko-focus-card p-6 sm:p-8" : "p-4"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {rank != null && (
            <p className="text-xs font-semibold text-slate-400">#{rank}</p>
          )}
          <h2
            className={cn(
              "truncate font-semibold tracking-tight text-slate-100",
              isFocus ? "text-xl sm:text-2xl" : "text-base"
            )}
            title={formatCompanyName(item.name)}
          >
            {formatCompanyName(item.name)}
          </h2>
          <p className={cn("text-slate-400", isFocus ? "mt-1 text-sm" : "text-xs")}>
            {item.municipalityName ?? "—"}
            {item.registeredAt && ` · ${formatRegisteredDate(item.registeredAt)}`}
            {item.daysSinceRegistration != null &&
              ` · ${item.daysSinceRegistration} d siden`}
          </p>
          {item.dagligLeder && (
            <p className={cn("text-slate-300", isFocus ? "mt-2 text-sm" : "mt-0.5 text-xs")}>
              Daglig leder: {item.dagligLeder}
            </p>
          )}
          {item.email && (
            <p className={cn("text-sky-300/90", isFocus ? "mt-2 text-sm" : "mt-1 text-xs")}>
              {item.email}
            </p>
          )}
          {item.phone && (
            <p className={cn("text-slate-300", isFocus ? "mt-1 text-sm" : "text-xs")}>
              {item.phone}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full font-bold tabular-nums ring-1 ring-inset",
            isFocus ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
            item.queueScore >= 80
              ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
              : item.queueScore >= 50
                ? "bg-amber-500/15 text-amber-200 ring-amber-400/30"
                : "bg-white/[0.06] text-slate-300 ring-white/15"
          )}
        >
          {item.queueScore} kø-poeng
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        {item.hasWebsite === false && (
          <span className="ko-queue-badge ko-queue-badge--amber">Uten nettside</span>
        )}
        {item.phone && (
          <span className="ko-queue-badge ko-queue-badge--emerald">Har tlf</span>
        )}
        {item.email && (
          <span className="ko-queue-badge ko-queue-badge--email">Har e-post</span>
        )}
        <span className="ko-queue-badge ko-queue-badge--status">
          {statusLabel(item.status)}
        </span>
      </div>

      <div className={cn("flex flex-wrap gap-2", isFocus ? "mt-6" : "mt-3")}>
        {!isContacted && (
          <div className="flex w-full flex-col gap-1.5">
            <button
              type="button"
              onClick={onMarkContacted}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg bg-sky-600 font-semibold text-white hover:bg-sky-700 disabled:opacity-50",
                isFocus ? "px-5 py-3 text-sm" : "px-3 py-1.5 text-xs"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? "Lagrer…" : "Ferdig — kontaktet"}
            </button>
            {isFocus && (
              <p className="text-xs text-slate-500">
                Neste etter dette: marker kontaktet → Pipeline
              </p>
            )}
          </div>
        )}

        {item.email && onSendEmail && (
          <button
            type="button"
            onClick={onSendEmail}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-white/15 font-semibold text-slate-200 hover:bg-white/8",
              isFocus ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Send e-post
          </button>
        )}

        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-white/15 font-semibold text-slate-200 hover:bg-white/8",
              isFocus ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"
            )}
          >
            <Phone className="h-3.5 w-3.5" />
            Ring
          </a>
        )}

        {!isContacted && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className={cn(
              "rounded-lg border border-white/15 font-semibold text-slate-400 hover:bg-white/8",
              isFocus ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs"
            )}
          >
            Hopp over
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/8"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            Mer
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-white/15 bg-slate-900 py-1 shadow-lg">
              <Link
                href="/app/pipeline"
                className="block px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => setMenuOpen(false)}
              >
                Åpne i Pipeline
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemoveFromQueue();
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10"
              >
                <UserMinus className="h-3.5 w-3.5" />
                Fjern fra kø
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRequestDelete();
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Slett lead
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
