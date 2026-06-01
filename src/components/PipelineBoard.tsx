"use client";

import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import { ScoreRing } from "@/components/ui/primitives";
import type { Company, LeadStatus, UserLead } from "@/types/database";

type PipelineItem = { lead: UserLead; company: Company };

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
            <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-3">
              <span className={`h-2 w-2 rounded-full ${col.color}`} />
              <h3 className="font-display font-bold text-white">{col.label}</h3>
              <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-white/50">
                {colItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {colItems.map(({ lead, company }) => (
                <div
                  key={lead.orgnr}
                  className="rounded-xl border border-white/[0.06] bg-brand-navyDark p-3 text-sm transition hover:border-brand-gold/20"
                >
                  <div className="flex items-start gap-3">
                    <ScoreRing score={lead.score} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{company.name}</p>
                      <p className="text-xs text-white/50">{company.municipality_name}</p>
                    </div>
                  </div>
                  {company.email && (
                    <p className="mt-2 truncate text-xs text-brand-gold">{company.email}</p>
                  )}
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      onStatusChange(lead.orgnr, e.target.value as LeadStatus)
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-brand-navyDark px-2 py-1.5 text-xs text-white"
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
                <p className="py-8 text-center text-xs text-white/40">Ingen leads</p>
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
      <h2 className="mb-4 font-display text-lg font-bold text-white">Avsluttet</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {closed.map(({ lead, company }) => (
          <div key={lead.orgnr} className="panel p-3 text-sm">
            <p className="font-semibold text-white">{company.name}</p>
            <p className="text-xs text-white/50">{statusLabel(lead.status)}</p>
            <select
              value={lead.status}
              onChange={(e) =>
                onStatusChange(lead.orgnr, e.target.value as LeadStatus)
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-brand-navyDark px-2 py-1.5 text-xs text-white"
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
