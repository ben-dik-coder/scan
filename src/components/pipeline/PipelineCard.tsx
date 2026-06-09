"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Mail, MoreHorizontal, Phone, StickyNote } from "lucide-react";
import { ScoreRing } from "@/components/ui/primitives";
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
  const followUpOverdue = isFollowUpOverdue(lead.next_follow_up_at);
  const phone = company.mobile ?? company.phone;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "pipeline-card group relative rounded-lg border p-3 text-sm transition",
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay && "pipeline-card-dragging shadow-lg"
      )}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2.5">
          <ScoreRing score={lead.score} size="sm" title={`Score ${lead.score}`} />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-semibold text-slate-100"
              title={formatCompanyName(company.name)}
            >
              {formatCompanyName(company.name)}
            </p>
            <p className="truncate text-xs text-slate-400">
              {company.municipality_name ?? "—"}
              {company.industry_description
                ? ` · ${company.industry_description}`
                : company.industry_code
                  ? ` · ${company.industry_code}`
                  : ""}
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-1 text-xs">
          {lastContact && (
            <p className="text-slate-400">Kontaktet {lastContact}</p>
          )}
          {lead.next_follow_up_at && (
            <p
              className={cn(
                "inline-flex rounded px-1.5 py-0.5 font-medium",
                followUpOverdue
                  ? "bg-red-500/20 text-red-200"
                  : "bg-amber-500/15 text-amber-200"
              )}
            >
              Oppfølging {formatFollowUpLabel(lead.next_follow_up_at)}
            </p>
          )}
          <p className={cn("truncate", company.email ? "text-sky-300/90" : "text-slate-500")}>
            {company.email ?? "Ingen e-post"}
          </p>
        </div>
      </button>

      <div className="pointer-events-none absolute right-2 top-2 flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-hover:pointer-events-auto">
        {company.email && (
          <a
            href={`mailto:${company.email}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-sky-300"
            title="Send e-post"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-emerald-300"
            title="Ring"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item, "notes");
          }}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-amber-200"
          title="Notat"
        >
          <StickyNote className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          title="Detaljer"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
