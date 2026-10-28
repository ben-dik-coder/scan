"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Mail, Phone, StickyNote } from "lucide-react";
import {
  cn,
  formatCompanyName,
  formatFollowUpLabel,
  formatRelativeTime,
  isFollowUpOverdue,
} from "@/lib/utils";
import type { PipelineItem } from "./types";

type Props = {
  item: PipelineItem;
  onOpen: (item: PipelineItem, section?: "notes") => void;
  isDragOverlay?: boolean;
};

export function PipelineCard({ item, onOpen, isDragOverlay = false }: Props) {
  const { lead, company } = item;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.orgnr,
    data: { item },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const lastContact = formatRelativeTime(lead.last_contacted_at);
  const followUpLabel = formatFollowUpLabel(lead.next_follow_up_at);
  const followUpOverdue = isFollowUpOverdue(lead.next_follow_up_at);
  const phone = company.mobile ?? company.phone;
  const place = company.municipality_name?.trim() || null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "pipeline-card group relative rounded-lg border border-white/[0.08] bg-[#141414] p-2.5 text-sm transition",
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay && "pipeline-card-dragging border-emerald-400/40 shadow-lg"
      )}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
              lead.score >= 70
                ? "bg-emerald-500/15 text-emerald-300"
                : lead.score >= 40
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-white/5 text-zinc-500"
            )}
            title={`Score ${lead.score}`}
          >
            {lead.score}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-medium text-zinc-100"
              title={formatCompanyName(company.name)}
            >
              {formatCompanyName(company.name)}
            </p>
            {place ? (
              <p className="truncate text-[11px] text-zinc-500">{place}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {followUpLabel ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                followUpOverdue
                  ? "bg-red-500/15 text-red-200"
                  : "bg-amber-500/10 text-amber-200/90"
              )}
            >
              {followUpOverdue ? `Forfalt · ${followUpLabel}` : `Oppfølging ${followUpLabel}`}
            </span>
          ) : lastContact ? (
            <span className="text-zinc-500">Kontaktet {lastContact}</span>
          ) : (
            <span className="text-zinc-600">Ikke kontaktet</span>
          )}
        </div>
      </button>

      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        {company.email ? (
          <a
            href={`mailto:${company.email}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-emerald-300"
            title="Send e-post"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-emerald-300"
            title="Ring"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item, "notes");
          }}
          className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-amber-200"
          title="Notat"
        >
          <StickyNote className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
