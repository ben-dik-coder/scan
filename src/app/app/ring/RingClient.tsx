"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RingTranscriptPanel } from "@/components/ring/RingTranscriptPanel";
import { SavedListPicker } from "@/components/saved-lists/SavedListPicker";
import { useRingTranscript } from "@/hooks/useRingTranscript";
import {
  applyManusPlaceholders,
  phoneTelHref,
} from "@/lib/ring/apply-manus-placeholders";
import {
  getRingSessionStats,
  recordRingOutcome,
} from "@/lib/ring/ring-session";
import { loadLocalManus } from "@/lib/manus/manus-storage";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { resolveListOrgnrs } from "@/lib/saved-lists/resolve-list-orgnrs";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
  type QueueItemResponse,
} from "@/lib/sales/queue-score";
import { cn, formatCompanyName, formatRegisteredDate } from "@/lib/utils";
import {
  CalendarCheck,
  Captions,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

type RightPanelTab = "manus" | "transcript";

const FETCH_TIMEOUT_MS = 30_000;

function recentCompaniesLast30Days<T extends { registered_at: string | null }>(
  companies: T[]
): T[] {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  return companies.filter((c) => c.registered_at && c.registered_at >= sinceStr);
}

export function RingClient() {
  const demo = useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadedListIdRef = useRef<string | null>(null);
  /** Unngår at URL-effekt tømmer filter mens router.replace pågår. */
  const pendingListeRef = useRef<string | null | undefined>(undefined);
  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skippedOrgnrs, setSkippedOrgnrs] = useState<Set<string>>(new Set());
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listOrgnrs, setListOrgnrs] = useState<Set<string> | null>(null);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [resolvingList, setResolvingList] = useState(false);
  const [manusHtml, setManusHtml] = useState("");
  const [manusTitle, setManusTitle] = useState("Manus");
  const [showManus, setShowManus] = useState(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>("manus");
  const [sessionStats, setSessionStats] = useState(getRingSessionStats);

  const { companies, setLeadStatus } = demo;

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
    const listId = searchParams.get("liste");
    if (!listId) {
      if (pendingListeRef.current === null) {
        pendingListeRef.current = undefined;
        return;
      }
      if (pendingListeRef.current !== undefined) {
        return;
      }
      if (loadedListIdRef.current !== null) {
        loadedListIdRef.current = null;
        setSelectedListId(null);
        setListOrgnrs(null);
        setSelectedListName(null);
      }
      return;
    }

    if (pendingListeRef.current === listId) {
      pendingListeRef.current = undefined;
      if (loadedListIdRef.current === listId) return;
    }

    if (loadedListIdRef.current === listId) return;

    setResolvingList(true);
    void resolveListOrgnrs(listId, { demoLists: demo.savedLists, shuffle: true })
      .then((resolved) => {
        if (!resolved) {
          loadedListIdRef.current = null;
          setSelectedListId(null);
          setListOrgnrs(null);
          setSelectedListName(null);
          return;
        }
        loadedListIdRef.current = listId;
        setSelectedListId(listId);
        setSelectedListName(resolved.name);
        setListOrgnrs(resolved.orgnrs.length > 0 ? new Set(resolved.orgnrs) : new Set());
      })
      .finally(() => setResolvingList(false));
  }, [searchParams, demo.savedLists]);

  const handleListSelect = useCallback(
    (selection: {
      listId: string | null;
      orgnrs: string[] | null;
      listName: string | null;
    }) => {
      pendingListeRef.current = selection.listId;
      setSelectedListId(selection.listId);
      setSelectedListName(selection.listName);
      setListOrgnrs(
        selection.orgnrs && selection.orgnrs.length > 0
          ? new Set(selection.orgnrs)
          : selection.listId
            ? new Set<string>()
            : null
      );
      loadedListIdRef.current = selection.listId;

      const params = new URLSearchParams(searchParams.toString());
      if (selection.listId) {
        params.set("liste", selection.listId);
      } else {
        params.delete("liste");
      }
      const qs = params.toString();
      router.replace(qs ? `/app/ring?${qs}` : "/app/ring");
    },
    [router, searchParams]
  );

  useEffect(() => {
    async function loadManus() {
      const local = loadLocalManus();
      if (isDemoMode()) {
        if (local) {
          setManusTitle(local.title);
          setManusHtml(local.bodyHtml);
        }
        return;
      }
      try {
        const res = await fetch("/api/manus");
        const data = await res.json();
        if (res.ok) {
          setManusTitle(data.title ?? "Manus");
          setManusHtml(data.bodyHtml ?? local?.bodyHtml ?? "");
          return;
        }
      } catch {
        /* fall through */
      }
      if (local) {
        setManusTitle(local.title);
        setManusHtml(local.bodyHtml);
      }
    }
    void loadManus();
  }, []);

  const listScopedItems = useMemo(() => {
    if (!listOrgnrs) return items;
    return items.filter((item) => listOrgnrs.has(item.orgnr));
  }, [items, listOrgnrs]);

  const dialQueue = useMemo(
    () =>
      listScopedItems.filter(
        (item) =>
          item.status === "ny" &&
          Boolean(item.phone?.trim()) &&
          !skippedOrgnrs.has(item.orgnr)
      ),
    [listScopedItems, skippedOrgnrs]
  );

  const current = dialQueue[0] ?? null;
  const transcriptState = useRingTranscript(current?.orgnr ?? null);
  const totalWithPhone = useMemo(
    () =>
      listScopedItems.filter((i) => i.status === "ny" && i.phone?.trim()).length,
    [listScopedItems]
  );
  const doneCount = totalWithPhone - dialQueue.length;
  const progressPct =
    totalWithPhone > 0 ? Math.round((doneCount / totalWithPhone) * 100) : 0;

  const personalizedManus = useMemo(() => {
    if (!current || !manusHtml.trim()) {
      return `<p class="text-slate-500">Skriv et manus under Innhold → Manus for å se det her mens du ringer.</p>`;
    }
    return applyManusPlaceholders(manusHtml, current);
  }, [current, manusHtml]);

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

  async function handleOutcome(
    type: "no_answer" | "answered" | "meeting" | "not_interested"
  ) {
    if (!current) return;
    transcriptState.stop();
    setBusy(true);
    setError(null);
    const orgnr = current.orgnr;
    try {
      if (type === "no_answer") {
        setSkippedOrgnrs((prev) => new Set(prev).add(orgnr));
        setSessionStats(recordRingOutcome("dialed"));
        return;
      }

      if (isDemoMode()) {
        if (type === "answered") {
          setLeadStatus(orgnr, "svarte");
          setSessionStats(recordRingOutcome("answered"));
        } else if (type === "meeting") {
          setLeadStatus(orgnr, "moete_booket", { unqueue: true });
          setSessionStats(recordRingOutcome("meeting"));
        } else {
          setLeadStatus(orgnr, "ikke_interessert", { unqueue: true });
        }
        setItems((list) => list.filter((i) => i.orgnr !== orgnr));
        return;
      }

      if (type === "answered") {
        await postStatus(orgnr, "svarte");
        setSessionStats(recordRingOutcome("answered"));
        setItems((list) =>
          list.map((i) => (i.orgnr === orgnr ? { ...i, status: "svarte" } : i))
        );
      } else if (type === "meeting") {
        await postStatus(orgnr, "moete_booket", { unqueue: true });
        setSessionStats(recordRingOutcome("meeting"));
        setItems((list) => list.filter((i) => i.orgnr !== orgnr));
      } else {
        await postStatus(orgnr, "ikke_interessert", { unqueue: true });
        setItems((list) => list.filter((i) => i.orgnr !== orgnr));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre utfall");
    } finally {
      setBusy(false);
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#141416] text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Laster ringeliste…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#141416] text-slate-100">
      <header className="relative z-40 overflow-visible border-b border-white/10 bg-[#1c1c1e]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <PhoneCall className="h-4 w-4" />
              Ringemodus
            </p>
            <h1 className="mt-1 text-lg font-bold sm:text-xl">
              {dialQueue.length > 0
                ? `${dialQueue.length} igjen med telefon`
                : "Ingen flere å ringe nå"}
            </h1>
            {selectedListName ? (
              <p className="mt-0.5 text-xs text-slate-400">
                Fra listen {selectedListName}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SavedListPicker
              mode="ring"
              selectedListId={selectedListId}
              onSelect={handleListSelect}
              resolving={resolvingList}
            />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Oppdater
            </button>
            <Link
              href="/app/manus"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/10"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Rediger manus
            </Link>
          </div>
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
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      {!current ? (
        <EmptyRingState
          hasQueue={items.length > 0}
          hasPhoneInQueue={totalWithPhone > 0}
          allSkipped={totalWithPhone > 0 && dialQueue.length === 0}
          listFilterActive={listOrgnrs !== null}
          selectedListName={selectedListName}
          listIsEmpty={listOrgnrs !== null && listOrgnrs.size === 0}
          listHasNoQueueOverlap={
            listOrgnrs !== null &&
            listOrgnrs.size > 0 &&
            listScopedItems.length === 0
          }
          onResetSkipped={() => setSkippedOrgnrs(new Set())}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-0 flex-1 flex-col border-b border-white/10 p-4 lg:border-b-0 lg:border-r lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Nå ringer du</p>
                <h2 className="truncate text-2xl font-bold sm:text-3xl">
                  {formatCompanyName(current.name)}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {current.municipalityName ?? "—"}
                  {current.registeredAt &&
                    ` · ${formatRegisteredDate(current.registeredAt)}`}
                </p>
                {current.dagligLeder ? (
                  <p className="mt-2 text-sm text-slate-300">
                    {current.dagligLeder}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/30">
                {current.queueScore} poeng
              </span>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-[10px]">
              {current.hasWebsite === false ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
                  Uten nettside
                </span>
              ) : null}
              {current.email ? (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200">
                  {current.email}
                </span>
              ) : null}
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={phoneTelHref(current.phone!)}
                className="inline-flex flex-1 items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-5 text-lg font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 sm:text-xl"
              >
                <Phone className="h-6 w-6" />
                Ring {current.phone}
              </a>
              <button
                type="button"
                onClick={() => {
                  const started = transcriptState.toggle();
                  if (started) {
                    setRightTab("transcript");
                    setShowManus(true);
                  }
                }}
                disabled={!transcriptState.supported}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-semibold transition sm:min-w-[8.5rem] sm:flex-col sm:py-5",
                  transcriptState.isListening
                    ? "border-red-400/40 bg-red-500/15 text-red-100"
                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
                  !transcriptState.supported && "opacity-50"
                )}
                title={
                  transcriptState.supported
                    ? transcriptState.isListening
                      ? "Stopp transkripsjon"
                      : "Start transkripsjon"
                    : "Transkripsjon krever Chrome/Edge"
                }
              >
                <Captions className="h-6 w-6" />
                <span className="sm:text-xs">
                  {transcriptState.isListening ? "Stopp" : "Transkript"}
                </span>
              </button>
            </div>

            {transcriptState.error ? (
              <p className="mb-4 text-xs text-amber-300">{transcriptState.error}</p>
            ) : null}

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Hva skjedde?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OutcomeButton
                icon={PhoneOff}
                label="Ikke svar"
                tone="muted"
                disabled={busy}
                onClick={() => void handleOutcome("no_answer")}
              />
              <OutcomeButton
                icon={ThumbsUp}
                label="Svarte"
                tone="sky"
                disabled={busy}
                onClick={() => void handleOutcome("answered")}
              />
              <OutcomeButton
                icon={CalendarCheck}
                label="Møte booket"
                tone="emerald"
                disabled={busy}
                onClick={() => void handleOutcome("meeting")}
              />
              <OutcomeButton
                icon={ThumbsDown}
                label="Ikke interessert"
                tone="red"
                disabled={busy}
                onClick={() => void handleOutcome("not_interested")}
              />
            </div>
          </section>

          <section
            className={cn(
              "flex min-h-0 flex-col bg-[#18181a]",
              showManus ? "flex-1 lg:max-w-xl" : "hidden lg:flex lg:flex-1 lg:max-w-xl"
            )}
          >
            <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
              <button
                type="button"
                onClick={() => setRightTab("manus")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  rightTab === "manus"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ScrollText className="h-3.5 w-3.5" />
                  Manus
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab("transcript")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  rightTab === "transcript"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Captions className="h-3.5 w-3.5" />
                  Transkript
                  {transcriptState.isListening ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowManus((v) => !v)}
                className="ml-auto rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 lg:hidden"
              >
                {showManus ? "Skjul" : "Vis"}
              </button>
            </div>

            {rightTab === "manus" ? (
              <div className={cn("flex min-h-0 flex-1 flex-col", !showManus && "hidden lg:flex")}>
                <p className="border-b border-white/5 px-4 py-2 text-xs text-slate-500">{manusTitle}</p>
                <div
                  className="manus-editor min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-200 [&_a]:text-sky-400 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"
                  dangerouslySetInnerHTML={{ __html: personalizedManus }}
                />
              </div>
            ) : (
              <RingTranscriptPanel
                isListening={transcriptState.isListening}
                isProcessing={transcriptState.isProcessing}
                engine={transcriptState.engine}
                whisperAvailable={transcriptState.whisperAvailable}
                displayText={transcriptState.displayText}
                transcript={transcriptState.transcript}
                interim={transcriptState.interim}
                supported={transcriptState.supported}
                error={transcriptState.error}
                onToggle={transcriptState.toggle}
                onClear={transcriptState.clear}
                onEdit={transcriptState.updateTranscript}
                companyName={formatCompanyName(current.name)}
              />
            )}
          </section>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#1c1c1e]/90 px-4 py-2 text-[11px] text-slate-400">
        <div className="flex flex-wrap gap-3">
          <span>{sessionStats.dialed} ringt i dag</span>
          <span>{sessionStats.answered} svarte</span>
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

function OutcomeButton({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof PhoneOff;
  label: string;
  tone: "muted" | "sky" | "emerald" | "red";
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
        tone === "sky" && "border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20",
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

function EmptyRingState({
  hasQueue,
  hasPhoneInQueue,
  allSkipped,
  listFilterActive,
  selectedListName,
  listIsEmpty,
  listHasNoQueueOverlap,
  onResetSkipped,
}: {
  hasQueue: boolean;
  hasPhoneInQueue: boolean;
  allSkipped: boolean;
  listFilterActive: boolean;
  selectedListName: string | null;
  listIsEmpty: boolean;
  listHasNoQueueOverlap: boolean;
  onResetSkipped: () => void;
}) {
  const listLabel = selectedListName ? `«${selectedListName}»` : "listen";

  let title: string;
  let description: string;

  if (listIsEmpty) {
    title = "Listen er tom";
    description = `${listLabel} har ingen firma ennå. Legg til firma fra Skann eller Smartliste.`;
  } else if (listHasNoQueueOverlap) {
    title = "Ingen fra listen er i køen";
    description = `Firma i ${listLabel} er ikke lagt i arbeidskøen ennå. Legg dem i kø fra Skann, Smartliste eller arbeidskøen.`;
  } else if (allSkipped) {
    title = "Du har hoppet over alle i listen";
    description =
      "Start på nytt med de du hoppet over, eller velg en annen liste.";
  } else if (hasQueue && !hasPhoneInQueue) {
    title = listFilterActive
      ? "Ingen i listen har telefon i køen"
      : "Ingen i køen har telefon";
    description = listFilterActive
      ? `Firma fra ${listLabel} i arbeidskøen mangler telefonnummer.`
      : "Legg firma med telefonnummer i arbeidskøen fra Skann — bruk fanen «Med telefon».";
  } else if (listFilterActive && !hasQueue) {
    title = "Ingen fra listen er i køen";
    description = `Legg firma fra ${listLabel} i arbeidskøen, så dukker de opp her.`;
  } else {
    title = "Køen er tom";
    description = "Legg leads i arbeidskøen fra Skann, så dukker de opp her automatisk.";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <PhoneCall className="mb-4 h-12 w-12 text-slate-600" />
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
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
