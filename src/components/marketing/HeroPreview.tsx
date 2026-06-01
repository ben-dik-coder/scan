"use client";

import { ScoreRing } from "@/components/ui/primitives";

const MOCK_LEADS = [
  { name: "Nordlys Tech AS", score: 92, status: "Ny", city: "Tromsø" },
  { name: "Arctic Solutions", score: 78, status: "Kontaktet", city: "Narvik" },
  { name: "Fjord Digital", score: 85, status: "Ny", city: "Oslo" },
];

export function HeroPreview() {
  return (
    <div className="relative animate-float">
      <div className="relative overflow-hidden rounded-xl border border-white/15 bg-brand-navyLight shadow-card">
        <div className="flex items-center justify-between border-b border-white/10 bg-brand-navy/80 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/20" />
            <span className="h-2 w-2 rounded-sm bg-brand-gold" />
            <span className="h-2 w-2 rounded-sm bg-white/20" />
          </div>
          <span className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 sm:text-[10px]">
            Skann → velg → send
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            {["Narvik", "30 dager", "Kun e-post"].map((chip) => (
              <span
                key={chip}
                className="rounded-md border border-brand-gold/25 bg-brand-gold/10 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-wider text-brand-gold"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            {[
              { label: "Valgt", val: "20" },
              { label: "Klar", val: "18" },
              { label: "Sendt", val: "0" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-md border border-white/10 bg-brand-navy/70 px-2 py-2.5 sm:px-3 sm:py-3"
              >
                <p className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
                  {s.label}
                </p>
                <p className="mt-1 font-display text-xl font-black leading-none text-white sm:text-2xl">
                  {s.val}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-md border border-white/10 bg-brand-navy/50 p-2.5 sm:p-3">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold">
              20 firma huket av
            </p>
            <div className="space-y-0.5">
              {MOCK_LEADS.map((lead) => (
                <div
                  key={lead.name}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 sm:gap-3 sm:px-2 sm:py-2"
                >
                  <input type="checkbox" checked readOnly className="h-3.5 w-3.5 rounded accent-brand-gold" />
                  <ScoreRing score={lead.score} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[11px] font-semibold text-white sm:text-xs">
                      {lead.name}
                    </p>
                    <p className="font-display text-[8px] font-bold uppercase tracking-wider text-white/35 sm:text-[9px]">
                      {lead.city}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-brand-gold/20 bg-brand-gold/5 px-3 py-2">
            <p className="truncate font-sans text-[10px] text-white/50">
              Fra: <span className="text-brand-goldLight">deg@dittbyra.no</span>
            </p>
            <p className="mt-1 truncate font-sans text-[10px] font-medium text-white/70">
              «Hei {'{firmanavn}'} — trenger dere nettside?»
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
