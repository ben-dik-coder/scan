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
import { cn, formatCompanyName } from "@/lib/utils";
import type { AiCall } from "@/types/database";
import {
  Bot,
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

type RightPanelTab = "manus" | "transcript" | "ai";

function aiCallStatusLabel(call: AiCall): string {
  if (call.status === "queued") return "I kø…";
  if (call.status === "ringing") return "Ringer…";
  if (call.status === "in_progress") return "I samtale…";
  if (call.status === "failed") return "Feilet";
  if (call.outcome === "meeting") return "Møte booket";
  if (call.outcome === "not_interested") return "Ikke interessert";
  if (call.outcome === "no_answer") return "Ikke svar";
  if (call.outcome === "voicemail") return "Telefonsvarer";
  if (call.status === "ended") return "Ferdig";
  return call.status;
}

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
  /** Valgt lead i køen — klikk bytter fokus uten å hoppe over resten. */
  const [selectedOrgnr, setSelectedOrgnr] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listOrgnrs, setListOrgnrs] = useState<Set<string> | null>(null);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [resolvingList, setResolvingList] = useState(false);
  const [manusHtml, setManusHtml] = useState("");
  const [manusTitle, setManusTitle] = useState("Manus");
  const [showManus, setShowManus] = useState(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>("manus");
  const [sessionStats, setSessionStats] = useState(getRingSessionStats);
  const [aiCall, setAiCall] = useState<AiCall | null>(null);
  const [aiStarting, setAiStarting] = useState(false);

  const { companies, setLeadStatus } = demo;

  const aiActive =
    aiCall?.status === "queued" ||
    aiCall?.status === "ringing" ||
    aiCall?.status === "in_progress";

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

  const current = useMemo(() => {
    if (selectedOrgnr) {
      const picked = dialQueue.find((i) => i.orgnr === selectedOrgnr);
      if (picked) return picked;
    }
    return dialQueue[0] ?? null;
  }, [dialQueue, selectedOrgnr]);

  const currentIndex = useMemo(() => {
    if (!current) return -1;
    return dialQueue.findIndex((i) => i.orgnr === current.orgnr);
  }, [dialQueue, current]);

  const transcriptState = useRingTranscript(current?.orgnr ?? null);
  const totalWithPhone = useMemo(
    () =>
      listScopedItems.filter((i) => i.status === "ny" && i.phone?.trim()).length,
    [listScopedItems]
  );
  const personalizedManus = useMemo(() => {
    if (!current || !manusHtml.trim()) {
      return `<p class="text-slate-500">Skriv et manus under Innhold → Manus for å se det her mens du ringer.</p>`;
    }
    return applyManusPlaceholders(manusHtml, current);
  }, [current, manusHtml]);

  // Hvis valgt lead forsvinner fra køen → fall tilbake til første
  useEffect(() => {
    if (!selectedOrgnr) return;
    if (!dialQueue.some((i) => i.orgnr === selectedOrgnr)) {
      setSelectedOrgnr(null);
    }
  }, [dialQueue, selectedOrgnr]);

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

  useEffect(() => {
    if (!aiActive || !aiCall?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/ai-call/active?id=${encodeURIComponent(aiCall.id)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { call?: AiCall | null };
        if (cancelled || !data.call) return;
        setAiCall(data.call);

        if (
          data.call.status === "ended" ||
          data.call.status === "failed"
        ) {
          if (data.call.outcome === "meeting") {
            setSessionStats(recordRingOutcome("meeting"));
            setItems((list) => list.filter((i) => i.orgnr !== data.call!.orgnr));
          } else if (data.call.outcome === "not_interested") {
            setItems((list) => list.filter((i) => i.orgnr !== data.call!.orgnr));
          } else if (
            data.call.outcome === "no_answer" ||
            data.call.outcome === "voicemail"
          ) {
            setSessionStats(recordRingOutcome("dialed"));
          } else {
            setSessionStats(recordRingOutcome("answered"));
          }
          setRightTab("ai");
        }
      } catch {
        // ignore poll errors
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [aiActive, aiCall?.id]);

  async function handleAiRing() {
    if (!current || aiStarting || aiActive) return;
    setAiStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgnr: current.orgnr }),
      });
      const data = (await res.json()) as {
        error?: string;
        call?: AiCall;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke starte AI-ring");
      }
      if (data.call) {
        setAiCall(data.call);
        setRightTab("ai");
        setShowManus(true);
        setSessionStats(recordRingOutcome("dialed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke starte AI-ring");
    } finally {
      setAiStarting(false);
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
    const idx = dialQueue.findIndex((i) => i.orgnr === orgnr);
    const nextOrgnr =
      dialQueue[idx + 1]?.orgnr ?? dialQueue[idx - 1]?.orgnr ?? null;
    try {
      if (type === "no_answer") {
        setSkippedOrgnrs((prev) => new Set(prev).add(orgnr));
        setSelectedOrgnr(nextOrgnr);
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
        setSelectedOrgnr(nextOrgnr);
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
      setSelectedOrgnr(nextOrgnr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre utfall");
    } finally {
      setBusy(false);
    }
  }

  function jumpToQueueItem(orgnr: string) {
    setSelectedOrgnr(orgnr);
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#0a0a0a] text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-400" />
        Laster…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[#0a0a0a] text-zinc-100">
      {/* Slim top bar — Vapi-style */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0f0f0f] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <PhoneCall className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="truncate text-sm font-medium text-white">Ring</span>
          <span className="hidden text-zinc-600 sm:inline">·</span>
          <span className="hidden truncate text-xs text-zinc-500 sm:inline">
            {dialQueue.length} i kø
            {selectedListName ? ` · ${selectedListName}` : ""}
          </span>
          {aiActive ? (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Live
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SavedListPicker
            mode="ring"
            selectedListId={selectedListId}
            onSelect={handleListSelect}
            resolving={resolvingList}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
            title="Oppdater"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <Link
            href="/app/manus"
            className="hidden h-8 items-center rounded-md px-2 text-xs text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 sm:inline-flex"
          >
            Manus
          </Link>
        </div>
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
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_26rem]">
          {/* 1 · Kø */}
          <aside className="hidden min-h-0 flex-col border-r border-white/[0.06] bg-[#0c0c0c] md:flex">
            <div className="flex h-9 items-center justify-between px-3">
              <span className="text-[11px] font-medium text-zinc-500">Kø</span>
              <span className="tabular-nums text-[11px] text-zinc-600">
                {currentIndex >= 0 ? currentIndex + 1 : "–"}/{dialQueue.length || "–"}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {dialQueue.map((item, i) => {
                const active = item.orgnr === current?.orgnr;
                return (
                  <button
                    key={item.orgnr}
                    type="button"
                    onClick={() => jumpToQueueItem(item.orgnr)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                      active
                        ? "bg-emerald-500/10 text-white"
                        : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 text-right text-[10px] tabular-nums",
                        active ? "text-emerald-400" : "text-zinc-700"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate">
                        {formatCompanyName(item.name)}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-[10px]",
                          active ? "text-emerald-400/70" : "text-zinc-600"
                        )}
                      >
                        {[item.phone, item.municipalityName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/[0.06] px-3 py-2 text-[10px] text-zinc-600">
              {sessionStats.meetings} møter · {sessionStats.answered} svar
            </div>
          </aside>

          {/* 2 · Lead workspace — one card */}
          <main className="flex min-h-0 min-w-0 flex-col overflow-y-auto bg-[#0a0a0a] p-3 sm:p-4">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-start gap-3 pt-1 sm:pt-2">
              {/* Card: lead + actions */}
              <section className="rounded-xl border border-white/[0.08] bg-[#111]">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Lead
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-semibold text-white">
                      {formatCompanyName(current.name)}
                    </h2>
                  </div>
                  {aiCall && (aiCall.orgnr === current.orgnr || aiActive) ? (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold",
                        aiActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : aiCall.status === "failed"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-white/[0.06] text-zinc-300"
                      )}
                    >
                      {aiActive ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      ) : null}
                      {aiCallStatusLabel(aiCall)}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-500">
                      Klar
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
                  <dt className="text-zinc-600">Telefon</dt>
                  <dd className="font-mono text-base font-medium text-zinc-100">
                    {current.phone}
                  </dd>
                  <dt className="text-zinc-600">Kontakt</dt>
                  <dd className="truncate text-zinc-300">
                    {current.dagligLeder ?? "—"}
                  </dd>
                  <dt className="text-zinc-600">Sted</dt>
                  <dd className="truncate text-zinc-300">
                    {current.municipalityName || "—"}
                  </dd>
                </dl>

                <div className="border-t border-white/[0.06] p-3">
                  <button
                    type="button"
                    onClick={() => void handleAiRing()}
                    disabled={aiStarting || aiActive || isDemoMode()}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400",
                      (aiStarting || isDemoMode()) && "opacity-50"
                    )}
                  >
                    {aiStarting || aiActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    {aiActive
                      ? aiCallStatusLabel(aiCall!)
                      : aiStarting
                        ? "Starter AI…"
                        : "AI ringer"}
                  </button>
                  <p className="mt-2 text-center text-[10px] leading-snug text-zinc-600">
                    AI-samtale logges som tekst hos oss (ikke lydopptak).
                  </p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <a
                      href={phoneTelHref(current.phone!)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Ring selv
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
                        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2.5 text-xs hover:bg-white/[0.04]",
                        transcriptState.isListening
                          ? "border-red-500/30 text-red-300"
                          : "text-zinc-400 hover:text-zinc-200",
                        !transcriptState.supported && "opacity-40"
                      )}
                    >
                      <Captions className="h-3.5 w-3.5" />
                      {transcriptState.isListening ? "Stopp" : "Lytt"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRightTab("manus");
                        setShowManus(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2.5 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                      Manus
                    </button>
                  </div>
                </div>

                {aiCall &&
                aiCall.orgnr === current.orgnr &&
                (aiActive || aiCall.transcript || aiCall.summary) ? (
                  <div className="border-t border-white/[0.06] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                        {aiActive ? "Status" : "Etter samtale"}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRightTab("ai");
                          setShowManus(true);
                        }}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        Åpne AI-panel →
                      </button>
                    </div>
                    {aiActive ? (
                      <p className="text-sm text-emerald-300/90">
                        {aiCallStatusLabel(aiCall)} — transcript kommer når
                        samtalen er ferdig.
                      </p>
                    ) : aiCall.summary ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300">
                        {aiCall.summary}
                      </p>
                    ) : aiCall.transcript ? (
                      <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                        {aiCall.transcript}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {aiCallStatusLabel(aiCall)}
                      </p>
                    )}
                  </div>
                ) : null}

                {error || transcriptState.error ? (
                  <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-amber-300">
                    {error || transcriptState.error}
                  </p>
                ) : null}
              </section>

              {/* Card: outcome — segmented */}
              <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]">
                <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Utfall
                </p>
                <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-y-0">
                  {(
                    [
                      ["no_answer", "Ikke svar", PhoneOff],
                      ["answered", "Svarte", ThumbsUp],
                      ["meeting", "Møte", CalendarCheck],
                      ["not_interested", "Nei", ThumbsDown],
                    ] as const
                  ).map(([type, label, Icon]) => (
                    <button
                      key={type}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleOutcome(type)}
                      className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-zinc-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </main>

          {/* 3 · Transcript — always visible on xl */}
          <aside
            className={cn(
              "flex min-h-0 flex-col border-t border-white/[0.06] bg-[#0f0f0f] md:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0",
              !showManus && "hidden xl:flex"
            )}
          >
            <div className="flex h-9 shrink-0 items-stretch border-b border-white/[0.06]">
              {(
                [
                  ["ai", "AI"],
                  ["transcript", "Lytt"],
                  ["manus", "Manus"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRightTab(id)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 text-[11px] font-medium transition",
                    rightTab === id
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {label}
                  {id === "ai" && aiActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ) : null}
                  {id === "transcript" && transcriptState.isListening ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  ) : null}
                  {rightTab === id ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400" />
                  ) : null}
                </button>
              ))}
            </div>

            {rightTab === "manus" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="border-b border-white/[0.06] px-4 py-2 text-[11px] text-zinc-600">
                  {manusTitle}
                </p>
                <div
                  className="manus-editor min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-zinc-300 [&_a]:text-emerald-400 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"
                  dangerouslySetInnerHTML={{ __html: personalizedManus }}
                />
                <Link
                  href="/app/manus"
                  className="border-t border-white/[0.06] px-4 py-2 text-xs text-zinc-500 hover:text-emerald-400"
                >
                  Rediger manus →
                </Link>
              </div>
            ) : rightTab === "ai" ? (
              <AiCallPanel call={aiCall} companyName={formatCompanyName(current.name)} />
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
          </aside>
        </div>
      )}
    </div>
  );
}

function parseTranscriptBubbles(transcript: string): { role: "assistant" | "user"; text: string }[] {
  const lines = transcript.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: { role: "assistant" | "user"; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^(AI|Assistant|Bot|User|Kunde|Customer)\s*:\s*(.*)$/i);
    if (m) {
      const role = /^(user|kunde|customer)$/i.test(m[1]) ? "user" : "assistant";
      out.push({ role, text: m[2] });
    } else if (out.length) {
      out[out.length - 1].text += ` ${line}`;
    } else {
      out.push({ role: "assistant", text: line });
    }
  }
  return out;
}

function AiCallPanel({
  call,
  companyName,
}: {
  call: AiCall | null;
  companyName: string;
}) {
  if (!call) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center text-sm text-zinc-500">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
          <Bot className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-zinc-300">
          Trykk <span className="text-emerald-400">AI ringer</span> for å starte
          samtale med {companyName}.
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Etter samtalen kommer tekst-transcript hit. Samtalen logges som tekst
          (ikke lyd).
        </p>
      </div>
    );
  }

  const bubbles = call.transcript ? parseTranscriptBubbles(call.transcript) : [];
  const ended =
    call.status === "ended" || call.status === "failed" || Boolean(call.outcome);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {bubbles.length > 0 ? (
          bubbles.map((b, i) => (
            <div
              key={`${b.role}-${i}`}
              className={cn("flex flex-col gap-1", b.role === "user" && "items-end")}
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  b.role === "assistant" ? "text-emerald-400" : "text-orange-300"
                )}
              >
                {b.role === "assistant" ? "AI" : "Kunde"}
              </span>
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  b.role === "assistant"
                    ? "rounded-tl-md bg-[#1a2e28] text-zinc-100"
                    : "rounded-tr-md bg-[#2a241c] text-zinc-100"
                )}
              >
                {b.text}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-500">
            {ended
              ? "Ingen transcript mottatt ennå."
              : "I samtale… transcript kommer når den er ferdig."}
          </p>
        )}
        {call.summary ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Oppsummering
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{call.summary}</p>
          </div>
        ) : null}
      </div>
      {ended ? (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 ring-1 ring-red-500/25">
            <PhoneOff className="h-3.5 w-3.5" />
            {aiCallStatusLabel(call)}
          </div>
        </div>
      ) : null}
    </div>
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
