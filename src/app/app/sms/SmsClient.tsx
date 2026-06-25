"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
  type QueueItemResponse,
} from "@/lib/sales/queue-score";
import {
  applySmsPlaceholders,
  loadSmsTemplate,
  saveSmsTemplate,
  smsHref,
  smsSegmentCount,
} from "@/lib/sms/sms-template";
import { getSmsSessionStats, recordSmsOutcome } from "@/lib/sms/sms-session";
import { displayPhone } from "@/lib/sms/normalize-phone";
import { cn, formatCompanyName, formatRegisteredDate } from "@/lib/utils";
import {
  CalendarCheck,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  SkipForward,
  Smartphone,
  ThumbsDown,
} from "lucide-react";

const FETCH_TIMEOUT_MS = 30_000;

function recentCompaniesLast30Days<T extends { registered_at: string | null }>(
  companies: T[]
): T[] {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  return companies.filter((c) => c.registered_at && c.registered_at >= sinceStr);
}

export function SmsClient() {
  const { companies, setLeadStatus } = useDemo();
  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skippedOrgnrs, setSkippedOrgnrs] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [smsConfigured, setSmsConfigured] = useState<boolean | null>(null);
  const [sessionStats, setSessionStats] = useState(getSmsSessionStats);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isDemoMode()) {
        const recent = recentCompaniesLast30Days(companies);
        const leadsByOrgnr = new Map(
          recent
            .filter((c) => c.user_lead?.queued_at)
            .map((c) => [c.orgnr, c.user_lead!])
        );
        const queuedCompanies = recent.filter((c) => leadsByOrgnr.has(c.orgnr));
        const candidates = buildQueueCandidates(queuedCompanies, leadsByOrgnr, new Map());
        setItems(mapQueueCandidatesToItems(candidates));
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/ko", { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data = (await res.json()) as { items?: QueueItemResponse[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste kø");
      setItems(data.items ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Forespørselen tok for lang tid.");
      } else {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      }
    } finally {
      setLoading(false);
    }
  }, [companies]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTemplate(loadSmsTemplate());
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      setSmsConfigured(true);
      return;
    }
    void fetch("/api/sms")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => setSmsConfigured(Boolean(data.configured)))
      .catch(() => setSmsConfigured(false));
  }, []);

  const smsQueue = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ny" &&
          Boolean(item.phone?.trim()) &&
          !skippedOrgnrs.has(item.orgnr)
      ),
    [items, skippedOrgnrs]
  );

  const current = smsQueue[0] ?? null;
  const totalWithPhone = useMemo(
    () => items.filter((i) => i.status === "ny" && i.phone?.trim()).length,
    [items]
  );
  const doneCount = totalWithPhone - smsQueue.length;
  const progressPct =
    totalWithPhone > 0 ? Math.round((doneCount / totalWithPhone) * 100) : 0;

  useEffect(() => {
    if (!current) {
      setMessage("");
      return;
    }
    setMessage(applySmsPlaceholders(template, current));
  }, [current, template]);

  async function postStatus(
    orgnr: string,
    status: string,
    extra?: { unqueue?: boolean }
  ) {
    const res = await fetch("/api/leads/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgnr, status, ...extra }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Kunne ikke oppdatere");
    }
  }

  async function handleSend() {
    if (!current?.phone?.trim() || !message.trim()) return;
    setBusy(true);
    setError(null);
    const orgnr = current.orgnr;
    const phone = current.phone;

    try {
      if (isDemoMode()) {
        setLeadStatus(orgnr, "kontaktet");
        setSessionStats(recordSmsOutcome("sent"));
        setItems((list) => list.filter((i) => i.orgnr !== orgnr));
        return;
      }

      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, message, orgnr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke sende SMS");

      setSessionStats(recordSmsOutcome("sent"));
      setItems((list) => list.filter((i) => i.orgnr !== orgnr));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke sende SMS");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (!current) return;
    setSkippedOrgnrs((prev) => new Set(prev).add(current.orgnr));
    setSessionStats(recordSmsOutcome("skipped"));
  }

  async function handleOutcome(type: "meeting" | "not_interested") {
    if (!current) return;
    setBusy(true);
    setError(null);
    const orgnr = current.orgnr;

    try {
      if (isDemoMode()) {
        if (type === "meeting") {
          setLeadStatus(orgnr, "moete_booket", { unqueue: true });
          setSessionStats(recordSmsOutcome("meeting"));
        } else {
          setLeadStatus(orgnr, "ikke_interessert", { unqueue: true });
        }
        setItems((list) => list.filter((i) => i.orgnr !== orgnr));
        return;
      }

      if (type === "meeting") {
        await postStatus(orgnr, "moete_booket", { unqueue: true });
        setSessionStats(recordSmsOutcome("meeting"));
      } else {
        await postStatus(orgnr, "ikke_interessert", { unqueue: true });
      }
      setItems((list) => list.filter((i) => i.orgnr !== orgnr));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre utfall");
    } finally {
      setBusy(false);
    }
  }

  function handleSaveTemplate() {
    saveSmsTemplate(template);
  }

  const segments = smsSegmentCount(message);
  const charCount = message.length;

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#141416] text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Laster SMS-kø…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#141416] text-slate-100">
      <header className="border-b border-white/10 bg-[#1c1c1e]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-400">
              <MessageSquare className="h-4 w-4" />
              SMS-modus
            </p>
            <h1 className="mt-1 text-lg font-bold sm:text-xl">
              {smsQueue.length > 0
                ? `${smsQueue.length} igjen med telefon`
                : "Ingen flere å sende SMS til nå"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Oppdater
          </button>
        </div>

        {totalWithPhone > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
              <span>
                Lead {doneCount + 1} av {totalWithPhone}
              </span>
              <span>{progressPct}% ferdig i dag</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}

        {smsConfigured === false && !isDemoMode() ? (
          <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            SMS-API er ikke satt opp ennå. Du kan fortsatt skrive meldinger og åpne i
            telefonens Meldinger-app. For å sende fra nettsiden: sett{" "}
            <code className="text-amber-200">SVEVE_USER</code> /{" "}
            <code className="text-amber-200">SVEVE_PASSWORD</code> eller Twilio i miljøvariabler.
          </p>
        ) : null}
      </header>

      {!current ? (
        <EmptySmsState
          hasQueue={items.length > 0}
          hasPhoneInQueue={totalWithPhone > 0}
          allSkipped={totalWithPhone > 0 && smsQueue.length === 0}
          onResetSkipped={() => setSkippedOrgnrs(new Set())}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-0 flex-1 flex-col border-b border-white/10 p-4 lg:border-b-0 lg:border-r lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Nå sender du SMS til</p>
                <h2 className="truncate text-2xl font-bold sm:text-3xl">
                  {formatCompanyName(current.name)}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {current.municipalityName ?? "—"}
                  {current.registeredAt &&
                    ` · ${formatRegisteredDate(current.registeredAt)}`}
                </p>
                {current.dagligLeder ? (
                  <p className="mt-2 text-sm text-slate-300">{current.dagligLeder}</p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-violet-500/15 px-3 py-1 text-sm font-bold text-violet-200 ring-1 ring-violet-400/30">
                {current.queueScore} poeng
              </span>
            </div>

            <p className="mb-3 text-2xl font-mono font-semibold tracking-wide text-white">
              {displayPhone(current.phone!)}
            </p>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Melding
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="mb-2 w-full resize-y rounded-2xl border border-white/10 bg-[#1c1c1e] px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Skriv SMS her…"
            />
            <p className="mb-4 text-[11px] text-slate-500">
              {charCount} tegn · {segments} SMS-del{segments === 1 ? "" : "er"}
            </p>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy || !message.trim() || smsConfigured === false}
                onClick={() => void handleSend()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                Send SMS
              </button>
              <a
                href={smsHref(current.phone!, message)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <Smartphone className="h-5 w-5" />
                Åpne i telefon
              </a>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Eller hopp over / marker utfall
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ActionButton
                icon={SkipForward}
                label="Hopp over"
                tone="muted"
                disabled={busy}
                onClick={() => void handleSkip()}
              />
              <ActionButton
                icon={CalendarCheck}
                label="Møte booket"
                tone="emerald"
                disabled={busy}
                onClick={() => void handleOutcome("meeting")}
              />
              <ActionButton
                icon={ThumbsDown}
                label="Ikke interessert"
                tone="red"
                disabled={busy}
                onClick={() => void handleOutcome("not_interested")}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[#18181a] lg:max-w-md">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SMS-mal
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Placeholders: {"{{firma}}"}, {"{{kontakt}}"}, {"{{telefon}}"}, {"{{dato}}"}
              </p>
            </div>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={8}
              className="min-h-[10rem] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed text-slate-200 focus:outline-none"
            />
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Lagre mal
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#1c1c1e]/90 px-4 py-2 text-[11px] text-slate-400">
        <div className="flex flex-wrap gap-3">
          <span>{sessionStats.sent} sendt i dag</span>
          <span>{sessionStats.skipped} hoppet over</span>
          <span>{sessionStats.meetings} møter</span>
        </div>
        {error ? <span className="text-amber-300">{error}</span> : null}
        <Link href="/app/ko" className="text-sky-400 hover:underline">
          Administrer arbeidskø →
        </Link>
      </footer>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof SkipForward;
  label: string;
  tone: "muted" | "emerald" | "red";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition disabled:opacity-50",
        tone === "muted" && "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
        tone === "emerald" &&
          "border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
        tone === "red" && "border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function EmptySmsState({
  hasQueue,
  hasPhoneInQueue,
  allSkipped,
  onResetSkipped,
}: {
  hasQueue: boolean;
  hasPhoneInQueue: boolean;
  allSkipped: boolean;
  onResetSkipped: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <MessageSquare className="mb-4 h-12 w-12 text-slate-600" />
      <h2 className="text-xl font-bold text-white">
        {allSkipped
          ? "Du har hoppet over alle i listen"
          : hasQueue && !hasPhoneInQueue
            ? "Ingen i køen har telefon"
            : "Køen er tom"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {allSkipped
          ? "Start på nytt med de du hoppet over, eller gå tilbake til arbeidskøen."
          : hasQueue && !hasPhoneInQueue
            ? "Legg firma med telefonnummer i arbeidskøen fra Skann."
            : "Legg leads i arbeidskøen fra Skann — de dukker opp her én og én, som i ringemodus."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {allSkipped ? (
          <button
            type="button"
            onClick={onResetSkipped}
            className="scan-btn-primary px-4 py-2.5 text-sm font-semibold"
          >
            Vis hoppet over igjen
          </button>
        ) : null}
        <Link href="/app" className="scan-btn-ghost px-4 py-2.5 text-sm">
          Gå til Skann
        </Link>
        <Link href="/app/ko" className="scan-btn-ghost px-4 py-2.5 text-sm">
          Arbeidskø
        </Link>
      </div>
    </div>
  );
}
