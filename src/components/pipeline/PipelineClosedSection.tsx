"use client";

import { LEAD_STATUSES } from "@/lib/sales/constants";
import type { LeadStatus } from "@/types/database";
import { PipelineCard } from "./PipelineCard";
import type { PipelineItem } from "./types";
import { CLOSED_PIPELINE_STATUSES } from "./types";

type Props = {
  items: PipelineItem[];
  onOpenCard: (item: PipelineItem, section?: "notes") => void;
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
};

export function PipelineClosedSection({ items, onOpenCard, onStatusChange }: Props) {
  const closed = items.filter((i) =>
    (CLOSED_PIPELINE_STATUSES as readonly string[]).includes(i.lead.status)
  );

  if (closed.length === 0) return null;

  return (
    <section className="mt-8 border-t border-white/10 pt-6">
      <h2 className="scan-glass-strong mb-3 text-sm font-semibold">Avsluttet</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {closed.map((item) => (
          <div key={item.lead.orgnr} className="space-y-2">
            <PipelineCard item={item} onOpen={onOpenCard} />
            <label className="block text-xs text-slate-500">
              Flytt tilbake
              <select
                value={item.lead.status}
                onChange={(e) =>
                  onStatusChange(item.lead.orgnr, e.target.value as LeadStatus)
                }
                className="scan-input mt-1 w-full py-1.5 text-xs"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
