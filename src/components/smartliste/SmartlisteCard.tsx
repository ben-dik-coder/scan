"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Globe, Mail, Pin, Phone } from "lucide-react";
import { ScoreRing } from "@/components/ui/primitives";
import { readAiSummaryFromCustomFields } from "@/lib/smartliste/ai-summary-shared";
import { labelChipClass } from "@/lib/smartliste/board-config";
import type { SmartListCard } from "@/lib/smartliste/types";
import { cn, formatCompanyName } from "@/lib/utils";

type Props = {
  card: SmartListCard;
  selected: boolean;
  compact?: boolean;
  staticCard?: boolean;
  onSelect: (card: SmartListCard, additive: boolean) => void;
  onOpen: (card: SmartListCard) => void;
  isDragOverlay?: boolean;
};

export function SmartlisteCard({
  card,
  selected,
  compact = false,
  staticCard = false,
  onSelect,
  onOpen,
  isDragOverlay = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: staticCard || isDragOverlay,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const company = card.company;
  const score = card.ai_score ?? 0;
  const phone = company?.mobile ?? company?.phone;
  const aiSummary = readAiSummaryFromCustomFields(card.custom_fields);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("smartliste-card", selected && "selected", isDragging && !isDragOverlay && "opacity-40")}
      {...(staticCard ? {} : listeners)}
      {...(staticCard ? {} : attributes)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(card, e.metaKey || e.ctrlKey || e.shiftKey);
        }}
        onDoubleClick={() => onOpen(card)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2">
          <ScoreRing score={score} size="sm" title={`Score ${score}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {card.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-300" />}
              <p className="truncate font-semibold text-slate-100" title={company?.name}>
                {company ? formatCompanyName(company.name) : card.orgnr}
              </p>
            </div>
            <p className="truncate text-xs text-slate-400">
              {company?.municipality_name ?? "—"}
              {company?.industry_description ? ` · ${company.industry_description}` : ""}
            </p>
          </div>
        </div>

        {aiSummary && !compact && (
          <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-amber-200/80">
            {aiSummary.opportunities[0] ?? aiSummary.summary}
          </p>
        )}

        {card.ai_score_reason && !compact && !aiSummary && (
          <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-400">
            {card.ai_score_reason}
          </p>
        )}

        {card.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.labels.map((label) => (
              <span
                key={label.id}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  labelChipClass(label.color)
                )}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-slate-500">
          {phone && <Phone className="h-3 w-3 text-emerald-400/80" aria-label="Har telefon" />}
          {company?.email && <Mail className="h-3 w-3 text-sky-400/80" aria-label="Har e-post" />}
          {company?.website && <Globe className="h-3 w-3 text-violet-400/80" aria-label="Har nettside" />}
        </div>
      </button>
    </div>
  );
}
