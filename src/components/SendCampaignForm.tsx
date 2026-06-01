"use client";

import { useState } from "react";
import type { Company, EmailTemplate } from "@/types/database";
import { isPersonalEmail } from "@/lib/brreg/map-company";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Mail, Send } from "lucide-react";

type SequenceOption = { id: string; name: string; steps: unknown[] };

type Props = {
  selectedCompanies: Company[];
  templates: EmailTemplate[];
  sequences: SequenceOption[];
  onSent: () => void;
  light?: boolean;
};

const DEFAULT_WEBSITE_PITCH = {
  subject: "Gratulerer med oppstart, {firmanavn}!",
  body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og lager nettsider for nye bedrifter i [ditt område]. Mange starter uten nettside — jeg hjelper med en enkel, profesjonell side til en fornuftig pris.

Har dere tenkt på nettside ennå? Jeg tar gjerne en uforpliktende prat.

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
};

export function SendCampaignForm({
  selectedCompanies,
  templates,
  sequences,
  onSent,
  light = false,
}: Props) {
  const demo = useDemo();
  const websiteTemplate =
    templates.find((t) => t.name.toLowerCase().includes("nettside")) ??
    templates.find((t) => t.is_default) ??
    templates[0];

  const [senderEmail, setSenderEmail] = useState("deg@dittbyra.no");
  const [subject, setSubject] = useState(
    websiteTemplate?.subject ?? DEFAULT_WEBSITE_PITCH.subject
  );
  const [body, setBody] = useState(websiteTemplate?.body ?? DEFAULT_WEBSITE_PITCH.body);
  const [selectedTemplateId, setSelectedTemplateId] = useState(websiteTemplate?.id ?? "");
  const [allowPersonal, setAllowPersonal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const withEmail = selectedCompanies.filter((c) => c.has_email && c.email);
  const personalCount = withEmail.filter((c) =>
    c.email ? isPersonalEmail(c.email) : false
  ).length;

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (withEmail.length === 0) return;
    if (personalCount > 0 && !allowPersonal) {
      setError("Du har valgt personlige e-postadresser. Kryss av for å tillate, eller fjern dem.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const orgnrs = withEmail.map((c) => c.orgnr);
      demo.sendCampaignDemo(orgnrs, subject);
      setResult(
        isDemoMode()
          ? `Demo: ${orgnrs.length} e-poster «sendt» fra ${senderEmail}`
          : `Sendt til ${orgnrs.length} firma fra ${senderEmail}`
      );
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  if (selectedCompanies.length === 0) {
    return (
      <div
        className={
          light
            ? "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center"
            : "rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center"
        }
      >
        <Mail className={light ? "mx-auto h-8 w-8 text-slate-300" : "mx-auto h-8 w-8 text-white/25"} />
        <p
          className={
            light
              ? "mt-4 text-sm font-semibold text-slate-700"
              : "mt-4 font-display text-sm font-bold uppercase tracking-[0.12em] text-white/70"
          }
        >
          Huk av firma først
        </p>
        <p className={light ? "mt-2 text-sm text-slate-500" : "mt-2 font-sans text-sm text-white/45"}>
          Velg firma i listen over — f.eks. 20 stk — så kan du skrive én felles melding her.
        </p>
      </div>
    );
  }

  const inputClass = light ? "scan-input mt-1.5" : "input-dark mt-1.5 py-2.5";
  const labelClass = light ? "font-medium text-slate-600" : "font-semibold text-white/70";

  return (
    <form onSubmit={handleSend} className={light ? "space-y-5" : "panel space-y-5 p-5 sm:p-6"}>
      <div
        className={
          light
            ? "flex items-start gap-3 border-b border-slate-100 pb-5"
            : "flex items-start gap-3 border-b border-white/10 pb-5"
        }
      >
        <div
          className={
            light
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-gold/15"
          }
        >
          <Send className="h-5 w-5 text-brand-gold" />
        </div>
        <div>
          <h3
            className={
              light
                ? "text-lg font-semibold text-slate-900"
                : "font-display text-lg font-bold uppercase tracking-wide text-white"
            }
          >
            Send tilbud til valgte
          </h3>
          <p className={light ? "mt-1 text-sm text-slate-500" : "mt-1 font-sans text-sm text-white/50"}>
            Én melding til{" "}
            <span className={light ? "font-semibold text-brand-navy" : "font-semibold text-brand-gold"}>
              {withEmail.length}
            </span>{" "}
            firma
            {withEmail.length !== selectedCompanies.length &&
              ` (${selectedCompanies.length - withEmail.length} uten e-post hoppes over)`}
          </p>
        </div>
      </div>

      <div
        className={
          light
            ? "rounded-xl border border-amber-100 bg-amber-50/80 p-4"
            : "rounded-lg border border-brand-gold/25 bg-brand-gold/5 p-4"
        }
      >
        <label className="block text-sm">
          <span className={light ? "scan-label" : "font-display text-[10px] font-bold uppercase tracking-[0.12em] text-brand-gold"}>
            Sendes fra din e-post
          </span>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="deg@dittbyra.no"
            className={light ? "scan-input mt-2" : "input-dark mt-2 py-2.5 text-sm"}
          />
        </label>
        {isDemoMode() ? (
          <p className={light ? "mt-2 text-xs text-slate-500" : "mt-2 font-sans text-xs text-white/45"}>
            Demo: Gmail/Outlook kobles på når backend er klar. Da sendes mailen fra kontoen din — ikke
            fra oss.
          </p>
        ) : (
          <p className={light ? "mt-2 text-xs text-slate-500" : "mt-2 font-sans text-xs text-white/45"}>
            Koble til Gmail eller Outlook i innstillinger for å sende fra din egen konto.
          </p>
        )}
      </div>

      {templates.length > 0 && (
        <label className="block text-sm">
          <span className={labelClass}>Bruk mal (valgfritt)</span>
          <select
            value={selectedTemplateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className={inputClass}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className={labelClass}>Emne</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          required
        />
        <p className={light ? "mt-1 text-[11px] text-slate-400" : "mt-1 font-sans text-[11px] text-white/35"}>
          {'{firmanavn}'} byttes ut med hvert firmanavn
        </p>
      </label>

      <label className="block text-sm">
        <span className={labelClass}>Melding (samme til alle)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className={cn(inputClass, "leading-relaxed")}
          required
        />
      </label>

      {personalCount > 0 && (
        <label
          className={
            light
              ? "flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              : "flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          }
        >
          <input
            type="checkbox"
            checked={allowPersonal}
            onChange={(e) => setAllowPersonal(e.target.checked)}
            className="mt-1"
          />
          <span>
            {personalCount} personlige adresser valgt (f.eks. fornavn.etternavn@). Krever samtykke —
            huk av for å sende likevel.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className={light ? "text-sm text-emerald-600" : "text-sm text-brand-gold"}>{result}</p>
      )}

      <button
        type="submit"
        disabled={loading || withEmail.length === 0}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading
          ? "Sender…"
          : `Send til ${withEmail.length} firma fra ${senderEmail.split("@")[0]}@…`}
      </button>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={
          light
            ? "w-full text-center text-xs text-slate-400 underline"
            : "w-full text-center font-sans text-xs text-white/40 underline"
        }
      >
        {showAdvanced ? "Skjul" : "Vis"} avansert (sekvenser)
      </button>

      {showAdvanced && sequences.length > 0 && (
        <p
          className={
            light
              ? "rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500"
              : "rounded-lg border border-white/10 bg-white/[0.02] p-3 font-sans text-xs text-white/45"
          }
        >
          Automatisk oppfølging (dag 3, 7) finner du under Sekvenser i menyen. Hovedflyten er
          «velg firma → send én gang».
        </p>
      )}
    </form>
  );
}
