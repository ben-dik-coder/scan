"use client";

import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import { ScoreRing } from "@/components/ui/primitives";
import type { Company, LeadStatus, UserLead } from "@/types/database";

type PipelineItem = { lead: UserLead; company: Company };

const selectClass =
  "mt-2 w-full rounded-[10px] border border-brand-border bg-white px-2 py-1.5 text-xs text-brand-navy focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/20";

export function PipelineBoard({
  items,
  onStatusChange,
}: {
  items: PipelineItem[];
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
}) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:px-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 xl:grid-cols-4">
      {LEAD_STATUSES.filter((s) =>
        ["ny", "kontaktet", "svarte", "moete_booket"].includes(s.id)
      ).map((col) => {
        const colItems = items.filter((i) => i.lead.status === col.id);
        return (
          <div key={col.id} className="panel w-[85vw] max-w-[300px] shrink-0 snap-center p-3 sm:w-[320px] md:w-auto md:max-w-none md:shrink">
            <div className="mb-3 flex items-center gap-2 border-b border-brand-border pb-3">
              <span className={`h-2 w-2 rounded-full ${col.color}`} />
              <h3 className="font-display font-bold text-brand-navy">{col.label}</h3>
              <span className="ml-auto rounded-full bg-brand-surface px-2 py-0.5 text-xs font-semibold text-slate-600">
                {colItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {colItems.map(({ lead, company }) => (
                <div
                  key={lead.orgnr}
                  className="rounded-xl border border-brand-border bg-brand-surface p-3 text-sm transition hover:border-brand-gold/30"
                >
                  <div className="flex items-start gap-3">
                    <ScoreRing score={lead.score} size="sm" light />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-navy">{company.name}</p>
                      <p className="text-xs text-slate-500">{company.municipality_name}</p>
                    </div>
                  </div>
                  {company.email && (
                    <p className="mt-2 truncate text-xs font-medium text-brand-gold">{company.email}</p>
                  )}
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      onStatusChange(lead.orgnr, e.target.value as LeadStatus)
                    }
                    className={selectClass}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {colItems.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">Ingen leads</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PipelineClosed({
  items,
  onStatusChange,
}: {
  items: PipelineItem[];
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
}) {
  const closed = items.filter((i) =>
    ["vunnet", "tapt", "ikke_interessert"].includes(i.lead.status)
  );
  if (closed.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="app-section-title">Avsluttet</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {closed.map(({ lead, company }) => (
          <div key={lead.orgnr} className="panel p-3 text-sm">
            <p className="font-semibold text-brand-navy">{company.name}</p>
            <p className="text-xs text-slate-500">{statusLabel(lead.status)}</p>
            <select
              value={lead.status}
              onChange={(e) =>
                onStatusChange(lead.orgnr, e.target.value as LeadStatus)
              }
              className={selectClass}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
