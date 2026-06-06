"use client";

import { useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { PageHeader } from "@/components/ui/primitives";

type Step = { step_order: number; delay_days: number; subject: string; body: string };
type Sequence = { id: string; name: string; active: boolean; steps: Step[] };

export function SequencesManager({ sequences }: { sequences: Sequence[] }) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function processDue() {
    setProcessing(true);
    if (isDemoMode()) {
      setTimeout(() => {
        setResult("Demo: 2 e-poster ville blitt sendt nå (backend kobles på senere)");
        setProcessing(false);
      }, 800);
      return;
    }
    const res = await fetch("/api/sequences/process", { method: "POST" });
    const data = await res.json();
    setResult(res.ok ? `Sendt ${data.sent} steg` : data.error);
    setProcessing(false);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="E-postsekvenser"
        description="Automatisk oppfølging — 6 steg over 25 dager"
        action={
          <button
            type="button"
            onClick={processDue}
            disabled={processing}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {processing ? "Kjører…" : "Send forfalte steg nå"}
          </button>
        }
      />

      {result && <p className="text-sm text-brand-gold">{result}</p>}

      <div className="space-y-4">
        {sequences.map((seq) => (
          <div key={seq.id} className="panel p-5">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg font-bold text-brand-navy">{seq.name}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  seq.active
                    ? "bg-brand-goldPale text-brand-gold"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {seq.active ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
            <ol className="mt-4 space-y-3">
              {seq.steps.map((step, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-brand-border bg-brand-surface p-3 text-sm"
                >
                  <p className="font-semibold text-brand-gold">
                    Steg {step.step_order + 1} — dag {step.delay_days}
                  </p>
                  <p className="mt-1 font-medium text-slate-700">{step.subject}</p>
                  <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-xs text-slate-500">
                    {step.body}
                  </pre>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
