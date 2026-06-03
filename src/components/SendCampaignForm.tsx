"use client";

import { useEffect, useState } from "react";
import type { Company, EmailTemplate } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { resolveCompanyEmail } from "@/lib/website-scan/resolve-company-email";
import { EmailConnect, providerLabel, useConnectedEmail } from "@/components/EmailConnect";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Mail, Send } from "lucide-react";
import Link from "next/link";
import { legal } from "@/lib/legal";

type SequenceOption = { id: string; name: string; steps: unknown[] };

type Props = {
  selectedCompanies: Company[];
  templates: EmailTemplate[];
  sequences: SequenceOption[];
  onSent: () => void;
  light?: boolean;
  websiteScans?: Map<string, WebsiteScanResult>;
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
  light = true,
  websiteScans,
}: Props) {
  const demo = useDemo();
  const websiteTemplate =
    templates.find((t) => t.name.toLowerCase().includes("nettside")) ??
    templates.find((t) => t.is_default) ??
    templates[0];

  const { accounts, email: connectedEmail, loading: emailLoading } = useConnectedEmail();
  const [mailProvider, setMailProvider] = useState<"google" | "microsoft" | "smtp" | null>(null);
  const [subject, setSubject] = useState(
    websiteTemplate?.subject ?? DEFAULT_WEBSITE_PITCH.subject
  );
  const [subjectB, setSubjectB] = useState("");
  const [useAbTest, setUseAbTest] = useState(false);
  const [body, setBody] = useState(websiteTemplate?.body ?? DEFAULT_WEBSITE_PITCH.body);
  const [selectedTemplateId, setSelectedTemplateId] = useState(websiteTemplate?.id ?? "");
  const [allowPersonal, setAllowPersonal] = useState(false);
  const [legalConfirm, setLegalConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedAccount =
    accounts.find((a) => a.provider === mailProvider) ?? accounts[0] ?? null;
  const sendEmail = selectedAccount?.email ?? connectedEmail;
  const hasMultipleAccounts = accounts.length > 1;

  useEffect(() => {
    if (accounts.length === 0) {
      setMailProvider(null);
      return;
    }
    setMailProvider((prev) =>
      prev && accounts.some((a) => a.provider === prev) ? prev : accounts[0].provider
    );
  }, [accounts]);

  const resolvedRecipients = selectedCompanies
    .map((c) => {
      const resolved = resolveCompanyEmail(c, websiteScans?.get(c.orgnr));
      if (!resolved) return null;
      return { company: c, resolved };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const withEmail = resolvedRecipients.map((r) => r.company);
  const personalCount = resolvedRecipients.filter((r) => r.resolved.isPersonal).length;
  const facebookCount = resolvedRecipients.filter((r) => r.resolved.source === "facebook").length;

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
    if (!legalConfirm) {
      setError("Bekreft at sendingen er lovlig før du sender.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const recipients = resolvedRecipients.map((r) => ({
        orgnr: r.company.orgnr,
        email: r.resolved.email,
        name: r.company.name,
      }));

      if (isDemoMode()) {
        demo.sendCampaignDemo(
          recipients.map((r) => r.orgnr),
          subject
        );
        setResult(`Demo: ${recipients.length} e-poster «sendt» (øvelse)`);
        onSent();
        return;
      }

      if (!sendEmail) {
        setError("Koble Gmail eller Outlook før du sender.");
        return;
      }

      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          subjectB: useAbTest && subjectB.trim() ? subjectB.trim() : undefined,
          body,
          recipients,
          allowPersonal,
          mailProvider: selectedAccount?.provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Sending feilet");
      }

      const from = data.fromEmail ?? sendEmail;
      setResult(
        `Sendt ${data.sent} av ${recipients.length} fra ${from}` +
          (data.failed > 0 ? ` (${data.failed} feilet)` : "")
      );
      if (data.errors?.length) {
        setError(data.errors.slice(0, 3).join(" · "));
      }
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
            {facebookCount > 0 && (
              <>
                {" "}
                · <span className="font-semibold text-blue-700">{facebookCount}</span> fra
                Facebook
              </>
            )}
          </p>
        </div>
      </div>

      <EmailConnect light={light} compact />

      {!isDemoMode() && !emailLoading && !sendEmail && (
        <p className={light ? "text-xs text-amber-800" : "text-xs text-amber-200/90"}>
          Du må{" "}
          <Link href="/app/innstillinger" className="font-semibold underline">
            koble e-post
          </Link>{" "}
          før du kan sende.
        </p>
      )}

      {!isDemoMode() && sendEmail && hasMultipleAccounts && (
        <label className="block text-sm">
          <span className={labelClass}>Send fra</span>
          <select
            value={mailProvider ?? ""}
            onChange={(e) =>
              setMailProvider(e.target.value as "google" | "microsoft" | "smtp")
            }
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.provider} value={a.provider}>
                {providerLabel(a.provider)} — {a.email}
              </option>
            ))}
          </select>
        </label>
      )}

      {!isDemoMode() && sendEmail && !hasMultipleAccounts && (
        <p className={light ? "text-xs text-slate-500" : "text-xs text-white/45"}>
          Sendes fra <strong>{sendEmail}</strong>
        </p>
      )}

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
        <span className={labelClass}>Emne (variant A)</span>
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

      <label
        className={
          light
            ? "flex items-center gap-2 text-sm text-slate-600"
            : "flex items-center gap-2 text-sm text-white/55"
        }
      >
        <input
          type="checkbox"
          checked={useAbTest}
          onChange={(e) => setUseAbTest(e.target.checked)}
        />
        A/B-test: test to emnelinjer (50/50)
      </label>

      {useAbTest && (
        <label className="block text-sm">
          <span className={labelClass}>Emne (variant B)</span>
          <input
            value={subjectB}
            onChange={(e) => setSubjectB(e.target.value)}
            className={inputClass}
            required={useAbTest}
            placeholder="Alternativ emnelinje"
          />
          <p className={light ? "mt-1 text-[11px] text-slate-400" : "mt-1 font-sans text-[11px] text-white/35"}>
            Vi lagrer hvilken variant hver mottaker fikk (åpning/svar kommer senere).
          </p>
        </label>
      )}

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

      <label
        className={
          light
            ? "flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
            : "flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55"
        }
      >
        <input
          type="checkbox"
          checked={legalConfirm}
          onChange={(e) => setLegalConfirm(e.target.checked)}
          className="mt-1"
        />
        <span>
          Jeg bekrefter at denne e-posten er lovlig markedsføring, at jeg har grunnlag for å
          kontakte mottakerne, og at jeg følger{" "}
          <Link href="/vilkar" target="_blank" className="font-semibold underline">
            vilkårene
          </Link>
          . {legal.productName} er ikke ansvarlig for innhold eller misbruk jeg sender.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className={light ? "text-sm text-emerald-600" : "text-sm text-brand-gold"}>{result}</p>
      )}

      <button
        type="submit"
        disabled={
          loading ||
          withEmail.length === 0 ||
          !legalConfirm ||
          (!isDemoMode() && !sendEmail)
        }
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading
          ? "Sender…"
          : sendEmail
            ? `Send til ${withEmail.length} firma fra ${sendEmail.split("@")[0]}@…`
            : `Koble e-post for å sende`}
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
