"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company, EmailTemplate } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { resolveCompanyEmail } from "@/lib/website-scan/resolve-company-email";
import { EmailConnect, useConnectedEmail } from "@/components/EmailConnect";
import { CampaignPreviewPanel } from "@/components/campaign/CampaignPreviewPanel";
import { CampaignRecipientsPanel } from "@/components/campaign/CampaignRecipientsPanel";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Mail, Send } from "lucide-react";
import Link from "next/link";
import { legal } from "@/lib/legal";

type SequenceOption = { id: string; name: string; active?: boolean; steps: unknown[] };

type Props = {
  selectedCompanies: Company[];
  templates: EmailTemplate[];
  sequences: SequenceOption[];
  onSent: () => void;
  light?: boolean;
  websiteScans?: Map<string, WebsiteScanResult>;
  /** Én mottaker (kø/pipeline) — enklere layout og tittel. */
  singleRecipient?: boolean;
};

const DEFAULT_WEBSITE_PITCH = {
  subject: "Gratulerer med oppstart, {firmanavn}!",
  body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og jobber med [din tjeneste] for nye bedrifter i [ditt område]. Mange i oppstartsfasen bruker mye tid på det som må gjøres — og lite på det som gjør at nye kunder faktisk finner dem.

Vi hjelper firma som dere med [kort verdi] uten at det blir komplisert eller dyrt.

Har dere 15 minutter til en uforpliktende prat denne eller neste uke?

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
};

export function SendCampaignForm({
  selectedCompanies,
  templates,
  sequences,
  onSent,
  light = true,
  websiteScans,
  singleRecipient = false,
}: Props) {
  const demo = useDemo();
  const websiteTemplate =
    templates.find((t) => t.name.toLowerCase().includes("nettside")) ??
    templates.find((t) => t.is_default) ??
    templates[0];

  const {
    accounts,
    defaultAccountId,
    email: connectedEmail,
    loading: emailLoading,
  } = useConnectedEmail();
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
  const [previewOrgnr, setPreviewOrgnr] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const activeSequences = useMemo(
    () => sequences.filter((s) => s.active !== false),
    [sequences]
  );
  const defaultSequenceId = activeSequences[0]?.id ?? "";
  const [useSequence, setUseSequence] = useState(activeSequences.length > 0);
  const [selectedSequenceId, setSelectedSequenceId] = useState(defaultSequenceId);

  const selectedAccount =
    accounts.find((a) => a.id === defaultAccountId) ?? accounts[0] ?? null;
  const sendEmail = selectedAccount?.email ?? connectedEmail;

  useEffect(() => {
    if (activeSequences.length === 0) {
      setUseSequence(false);
      setSelectedSequenceId("");
      return;
    }
    setSelectedSequenceId((prev) =>
      prev && activeSequences.some((s) => s.id === prev) ? prev : activeSequences[0].id
    );
  }, [activeSequences]);

  const resolvedRecipients = selectedCompanies
    .map((c) => {
      const resolved = resolveCompanyEmail(c, websiteScans?.get(c.orgnr));
      if (!resolved) return null;
      return { company: c, resolved };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const withEmail = resolvedRecipients.map((r) => r.company);
  const skippedCompanies = selectedCompanies.filter(
    (c) => !resolvedRecipients.some((r) => r.company.orgnr === c.orgnr)
  );
  const personalCount = resolvedRecipients.filter((r) => r.resolved.isPersonal).length;
  const facebookCount = resolvedRecipients.filter((r) => r.resolved.source === "facebook").length;

  useEffect(() => {
    if (withEmail.length > 0 && !previewOrgnr) {
      setPreviewOrgnr(withEmail[0].orgnr);
    } else if (
      withEmail.length > 0 &&
      !withEmail.some((c) => c.orgnr === previewOrgnr)
    ) {
      setPreviewOrgnr(withEmail[0].orgnr);
    }
  }, [withEmail, previewOrgnr]);

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  async function handleSendTest() {
    if (!subject.trim() || !body.trim() || !previewOrgnr) return;

    setTestLoading(true);
    setTestResult(null);
    setTestError(null);

    try {
      if (isDemoMode()) {
        setTestResult("Demo: test-e-post «sendt» til deg selv (øvelse)");
        return;
      }

      if (!sendEmail) {
        setTestError("Koble e-post under Innstillinger først.");
        return;
      }

      const res = await fetch("/api/campaigns/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          previewOrgnr,
          mailAccountId: selectedAccount?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Test-sending feilet");
      }
      setTestResult(`Test sendt til ${data.to}`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setTestLoading(false);
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
        const orgnrs = recipients.map((r) => r.orgnr);
        demo.sendCampaignDemo(orgnrs, subject);
        if (useSequence && selectedSequenceId) {
          demo.enrollSequenceDemo(selectedSequenceId, orgnrs);
        }
        const followUp =
          useSequence && selectedSequenceId
            ? " Automatisk oppfølging er startet (steg 2–6)."
            : "";
        setResult(`Demo: ${recipients.length} e-poster «sendt» (øvelse).${followUp}`);
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
          mailAccountId: selectedAccount?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Sending feilet");
      }

      const sentOrgnrs = (data.sentOrgnrs as string[] | undefined) ??
        recipients.map((r) => r.orgnr);

      if (useSequence && selectedSequenceId && sentOrgnrs.length > 0) {
        const enrollRes = await fetch("/api/sequences/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sequenceId: selectedSequenceId,
            orgnrs: sentOrgnrs,
            skipFirstStep: true,
          }),
        });
        const enrollData = await enrollRes.json();
        if (!enrollRes.ok) {
          throw new Error(enrollData.error ?? "Kunne ikke starte automatisk oppfølging");
        }
      }

      const from = data.fromEmail ?? sendEmail;
      const followUp =
        useSequence && selectedSequenceId
          ? ` Oppfølging startet for ${sentOrgnrs.length} firma (steg 2–6).`
          : "";
      setResult(
        `Sendt ${data.sent} av ${recipients.length} fra ${from}` +
          (data.failed > 0 ? ` (${data.failed} feilet)` : "") +
          followUp
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
  const isSingle = singleRecipient || selectedCompanies.length === 1;
  const singleName = selectedCompanies[0]?.name;
  const zoneClass = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

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
            {isSingle && singleName ? `Send til ${singleName}` : "Send tilbud til valgte"}
          </h3>
          {!isSingle && (
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
          )}
        </div>
      </div>

      {!isDemoMode() && !emailLoading && !sendEmail && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Koble e-post først —{" "}
          <Link href="/app/innstillinger" className="font-semibold underline">
            gå til innstillinger
          </Link>
        </div>
      )}

      {isSingle ? (
        <section className="space-y-2">
          <h4 className={zoneClass}>Mottaker</h4>
          {withEmail.length > 0 ? (
            <p className={light ? "text-sm text-slate-700" : "text-sm text-slate-200"}>
              {resolvedRecipients[0]?.resolved.email ?? selectedCompanies[0]?.email ?? "—"}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Ingen e-post funnet for dette firmaet.</p>
          )}
        </section>
      ) : (
        withEmail.length > 0 && (
          <CampaignRecipientsPanel
            recipients={resolvedRecipients}
            skipped={skippedCompanies}
            light={light}
          />
        )
      )}

      {sendEmail && <EmailConnect light={light} compact />}

      <section className="space-y-3">
        {isSingle && <h4 className={zoneClass}>Melding</h4>}

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

      </section>

      <section className="space-y-3">
        {isSingle && <h4 className={zoneClass}>Send</h4>}

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
            ? isSingle && singleName
              ? `Send til ${singleName}`
              : `Send til ${withEmail.length} firma fra ${sendEmail.split("@")[0]}@…`
            : `Koble e-post for å sende`}
      </button>

      </section>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={
          light
            ? "w-full text-center text-xs text-slate-400 underline"
            : "w-full text-center font-sans text-xs text-white/40 underline"
        }
      >
        {showAdvanced ? "Skjul" : "Vis"} forhåndsvisning og test
      </button>

      {showAdvanced && (
        <div className="space-y-4">
          <CampaignPreviewPanel
            companies={withEmail}
            previewOrgnr={previewOrgnr}
            onPreviewOrgnrChange={setPreviewOrgnr}
            subject={subject}
            body={body}
            light={light}
            testLoading={testLoading}
            testResult={testResult}
            testError={testError}
            onSendTest={handleSendTest}
            canSendTest={Boolean(sendEmail) && withEmail.length > 0}
          />

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

          {activeSequences.length > 0 && (
            <div
              className={
                light
                  ? "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  : "space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
              }
            >
              <label
                className={
                  light
                    ? "flex items-start gap-2 text-sm text-slate-700"
                    : "flex items-start gap-2 text-sm text-white/75"
                }
              >
                <input
                  type="checkbox"
                  checked={useSequence}
                  onChange={(e) => setUseSequence(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>Start automatisk oppfølging</strong> etter denne e-posten (steg 2–6 på dag
                  2, 5, 10, 16 og 25)
                </span>
              </label>
              {useSequence && (
                <label className="block text-sm">
                  <span className={labelClass}>Velg sekvens</span>
                  <select
                    value={selectedSequenceId}
                    onChange={(e) => setSelectedSequenceId(e.target.value)}
                    className={inputClass}
                  >
                    {activeSequences.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p
                    className={
                      light
                        ? "mt-1 text-[11px] text-slate-400"
                        : "mt-1 font-sans text-[11px] text-white/35"
                    }
                  >
                    Steg 1 er den e-posten du sender nå. Resten går automatisk.{" "}
                    <Link href="/app/sekvenser" className="underline">
                      Se alle steg
                    </Link>
                  </p>
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
