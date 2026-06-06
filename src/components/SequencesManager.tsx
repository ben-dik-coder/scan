"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Clock, Mail, Send, Workflow } from "lucide-react";
import { isDemoMode } from "@/lib/demo/config";
import { PageHeader } from "@/components/ui/primitives";

type Step = { step_order: number; delay_days: number; subject: string; body: string };
type Sequence = { id: string; name: string; active: boolean; steps: Step[] };

const HOW_TO_STEPS = [
  {
    n: 1,
    title: "Tilpass teksten",
    body: "Bytt ut [ditt navn], [ditt firma], [telefon] og [e-post]. {firmanavn} fylles inn automatisk for hvert firma.",
  },
  {
    n: 2,
    title: "Send første e-post fra Skann",
    body: "Velg firma i Skann eller arbeidskøen, skriv meldingen og send. Det er steg 1 i sekvensen.",
  },
  {
    n: 3,
    title: "Kryss av for automatisk oppfølging",
    body: "Når du sender, huk av «Start automatisk oppfølging». Da sender vi steg 2–6 for deg på dag 2, 5, 10, 16 og 25.",
  },
] as const;

function stepPreview(body: string) {
  const line = body.split("\n").find((l) => l.trim().length > 0) ?? body;
  return line.length > 90 ? `${line.slice(0, 90)}…` : line;
}

function SequenceStepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-sky-300">
            Steg {step.step_order + 1} — dag {step.delay_days}
          </p>
          <p className="mt-1 font-medium text-white/90">{step.subject}</p>
          {!open && (
            <p className="mt-1 text-xs text-white/45">{stepPreview(step.body)}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
        )}
      </button>
      {open && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-t border-white/10 pt-3 text-xs text-white/55">
          {step.body}
        </pre>
      )}
    </li>
  );
}

export function SequencesManager({
  sequences,
  loading = false,
  error = null,
  isDemo = false,
  onProcessed,
}: {
  sequences: Sequence[];
  loading?: boolean;
  error?: string | null;
  isDemo?: boolean;
  onProcessed?: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function processDue() {
    setProcessing(true);
    setResult(null);
    if (isDemo || isDemoMode()) {
      setTimeout(() => {
        setResult("Demo: 2 oppfølgings-e-poster ville blitt sendt nå (øvelse)");
        setProcessing(false);
      }, 800);
      return;
    }
    const res = await fetch("/api/sequences/process", { method: "POST" });
    const data = await res.json();
    setResult(res.ok ? `Sendt ${data.sent} oppfølgings-e-poster` : data.error);
    setProcessing(false);
    if (res.ok) onProcessed?.();
  }

  const activeSequence = sequences.find((s) => s.active) ?? sequences[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-postsekvenser"
        description="Automatisk oppfølging etter første e-post — 6 steg over 25 dager"
      />

      <section className="scan-surface-full overflow-hidden">
        <div className="scan-glass-header border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h2 className="scan-glass-strong text-base font-semibold">Hva skal du gjøre her?</h2>
              <p className="scan-glass-muted mt-1 text-sm">
                Denne siden viser oppfølgings-e-postene dine. Du starter sekvensen fra{" "}
                <strong className="text-white/80">Skann</strong> eller{" "}
                <strong className="text-white/80">arbeidskøen</strong> — ikke her.
              </p>
            </div>
          </div>
        </div>

        <ol className="space-y-3 p-4 sm:p-5">
          {HOW_TO_STEPS.map((step) => (
            <li
              key={step.n}
              className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/25 text-xs font-bold text-sky-200">
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-white/55">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row sm:p-5">
          <Link
            href="/app"
            className="scan-btn-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold"
          >
            <Send className="h-4 w-4" />
            Gå til Skann og send
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/app/ko"
            className="scan-btn-ghost inline-flex min-h-[44px] items-center justify-center gap-2 px-4 text-sm font-semibold"
          >
            Eller bruk arbeidskøen
          </Link>
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
        <p className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <span>
            <strong className="text-white/80">«Send forfalte steg nå»</strong> trenger du bare hvis
            du vil sende manuelt. Ellers går oppfølgingen automatisk på riktig dag.
          </span>
        </p>
        <p className="mt-3 flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <span>
            <code className="text-sky-200">{"{firmanavn}"}</code> = fylles inn automatisk.{" "}
            <code className="text-sky-200">[ditt navn]</code> osv. = tekst du må bytte ut selv.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="scan-glass-strong text-base font-semibold">Dine sekvenser</h2>
        <button
          type="button"
          onClick={processDue}
          disabled={processing}
          className="scan-btn-ghost text-sm disabled:opacity-50"
        >
          {processing ? "Kjører…" : "Send forfalte steg nå"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && <p className="text-sm text-sky-300">{result}</p>}

      {sequences.length === 0 && !loading && (
        <p className="scan-glass-muted text-sm">
          Laster standard sekvenser… Oppdater siden om et øyeblikk.
        </p>
      )}

      <div className="space-y-4">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            className="scan-surface-full overflow-hidden"
          >
            <div className="scan-glass-header flex flex-wrap items-center gap-3 border-b border-white/10 p-4 sm:p-5">
              <h3 className="scan-glass-strong text-lg font-bold">{seq.name}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  seq.active
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/10 text-white/45"
                }`}
              >
                {seq.active ? "Aktiv" : "Inaktiv"}
              </span>
              {seq.id === activeSequence?.id && (
                <span className="text-xs text-white/45">
                  — brukes når du krysser av «Automatisk oppfølging» ved sending
                </span>
              )}
            </div>
            <ol className="space-y-3 p-4 sm:p-5">
              {seq.steps.map((step, i) => (
                <SequenceStepCard key={i} step={step} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
