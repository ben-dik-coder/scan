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
  buildListRingCandidates,
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
  ChevronRight,
  Loader2,
  Minus,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

const BATCH_PRESETS = [10, 20, 30, 50] as const;

function isActiveAiStatus(status: string | null | undefined): boolean {
  return status === "queued" || status === "ringing" || status === "in_progress";
}

type RightPanelTab = "manus" | "transcript" | "ai";

/** Norsk 24-timers klokke (HH:MM). Unngår browser type="time" med AM/PM. */
function normalizeNbTime(raw: string): string {
  const t = raw.trim().replace(/\./g, ":").replace(/[^\d:]/g, "");
  if (!t) return "";
  const withColon = t.includes(":")
    ? t
    : t.length >= 3
      ? `${t.slice(0, t.length - 2)}:${t.slice(-2)}`
      : t;
  const m = withColon.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "";
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) {
    return "";
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function draftNbTime(raw: string): string {
  return raw.replace(/\./g, ":").replace(/[^\d:]/g, "").slice(0, 5);
}

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
  const loadSeqRef = useRef(0);
  const autoRingRef = useRef(false);
  // Ferske verdier til auto-ring-timeren (unngår gammel state i closures)
  const dialQueueRef = useRef<QueueItemResponse[]>([]);
  const currentRef = useRef<QueueItemResponse | null>(null);
  const aiCallRef = useRef<AiCall | null>(null);
  const aiHangingUpRef = useRef(false);
  const startingRef = useRef(false);
  const lastStartAtRef = useRef(0);
  const finishedSeenRef = useRef<{ id: string; at: number } | null>(null);
  const conflictCountRef = useRef(0);
  const transcriptStopRef = useRef<() => void>(() => {});
  const autoRingTickRef = useRef<() => void>(() => {});
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
  const [aiHangingUp, setAiHangingUp] = useState(false);
  /** null = hele køen. Ellers låst batch med N første firma. */
  const [batchLimit, setBatchLimit] = useState<number | null>(null);
  const [batchOrgnrs, setBatchOrgnrs] = useState<string[] | null>(null);
  const [batchDraft, setBatchDraft] = useState("20");
  /** HH:MM — stopp nye auto-ring-kall etter dette klokkeslettet (i dag). */
  const [stopAtTime, setStopAtTime] = useState("");
  const [autoRing, setAutoRing] = useState(false);

  const { companies, setLeadStatus } = demo;

  const aiActive =
    aiCall?.status === "queued" ||
    aiCall?.status === "ringing" ||
    aiCall?.status === "in_progress";

  const load = useCallback(
    async (scopeOrgnrs?: string[] | null) => {
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        if (isDemoMode()) {
          if (scopeOrgnrs && scopeOrgnrs.length > 0) {
            const scope = new Set(scopeOrgnrs);
            const pool = companies.filter((c) => scope.has(c.orgnr));
            const leadsByOrgnr = new Map(
              pool.flatMap((c) =>
                c.user_lead ? ([[c.orgnr, c.user_lead]] as const) : []
              )
            );
            if (seq !== loadSeqRef.current) return;
            setItems(
              mapQueueCandidatesToItems(
                buildListRingCandidates(
                  scopeOrgnrs,
                  pool,
                  leadsByOrgnr,
                  new Map()
                )
              )
            );
            return;
          }

          const recent = recentCompaniesLast30Days(companies);
          const leadsByOrgnr = new Map(
            recent
              .filter((c) => c.user_lead?.queued_at)
              .map((c) => [c.orgnr, c.user_lead!])
          );
          const queuedCompanies = recent.filter((c) =>
            leadsByOrgnr.has(c.orgnr)
          );
          if (seq !== loadSeqRef.current) return;
          setItems(
            mapQueueCandidatesToItems(
              buildQueueCandidates(queuedCompanies, leadsByOrgnr, new Map())
            )
          );
          return;
        }

        if (scopeOrgnrs && scopeOrgnrs.length === 0) {
          if (seq !== loadSeqRef.current) return;
          setItems([]);
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let res: Response;
        try {
          res =
            scopeOrgnrs && scopeOrgnrs.length > 0
              ? await fetch("/api/ko", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orgnrs: scopeOrgnrs }),
                  signal: controller.signal,
                })
              : await fetch("/api/ko", { signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        const data = (await res.json()) as {
          items?: QueueItemResponse[];
          error?: string;
          mode?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke laste kø");
        if (seq !== loadSeqRef.current) return;
        setItems(data.items ?? []);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        if (err instanceof Error && err.name === "AbortError") {
          setError("Forespørselen tok for lang tid.");
        } else {
          setError(err instanceof Error ? err.message : "Ukjent feil");
        }
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [companies]
  );

  useEffect(() => {
    // Vent litt hvis URL allerede har liste — så slipper arbeidskø (2 stk) å vinne racet
    const listeInUrl = searchParams.get("liste");
    if (listOrgnrs === null) {
      if (listeInUrl) return;
      void load(null);
      return;
    }
    void load([...listOrgnrs]);
  }, [listOrgnrs, load, searchParams]);

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

  const dialableStatus = (status: string) =>
    status === "ny" || status === "kontaktet" || status === "svarte";

  const availablePool = useMemo(
    () =>
      listScopedItems.filter(
        (item) =>
          dialableStatus(item.status) && Boolean(item.phone?.trim())
      ),
    [listScopedItems]
  );

  const dialQueue = useMemo(() => {
    const pool = availablePool.filter(
      (item) => !skippedOrgnrs.has(item.orgnr)
    );
    if (!batchOrgnrs) return pool;
    const allowed = new Set(batchOrgnrs);
    return pool.filter((item) => allowed.has(item.orgnr));
  }, [availablePool, skippedOrgnrs, batchOrgnrs]);

  const applyBatchLimit = useCallback(
    (limit: number | null) => {
      const pool = availablePool.filter(
        (item) => !skippedOrgnrs.has(item.orgnr)
      );
      if (limit == null || limit >= pool.length) {
        setBatchLimit(null);
        setBatchOrgnrs(null);
        setBatchDraft(String(pool.length || 20));
        setSelectedOrgnr(null);
        return;
      }
      const n = Math.max(1, Math.min(limit, pool.length));
      setBatchLimit(n);
      setBatchOrgnrs(pool.slice(0, n).map((i) => i.orgnr));
      setBatchDraft(String(n));
      setSelectedOrgnr(null);
    },
    [availablePool, skippedOrgnrs]
  );

  // Ny liste → nullstill batch
  useEffect(() => {
    setBatchLimit(null);
    setBatchOrgnrs(null);
    setBatchDraft("20");
    setSkippedOrgnrs(new Set());
    setSelectedOrgnr(null);
  }, [selectedListId]);

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

  function goToNextFirm() {
    if (!current || aiActive) return;
    transcriptState.stop();
    const orgnr = current.orgnr;
    const idx = dialQueue.findIndex((i) => i.orgnr === orgnr);
    const nextOrgnr = dialQueue[idx + 1]?.orgnr ?? null;
    setSkippedOrgnrs((prev) => new Set(prev).add(orgnr));
    setSelectedOrgnr(nextOrgnr);
    setAiCall((prev) => (prev?.orgnr === orgnr ? null : prev));
    return nextOrgnr;
  }

  const hasNextFirm =
    Boolean(current) &&
    !aiActive &&
    currentIndex >= 0 &&
    currentIndex < dialQueue.length - 1;

  const batchRemaining = dialQueue.length;
  const batchTotal = batchOrgnrs?.length ?? availablePool.length;

  useEffect(() => {
    autoRingRef.current = autoRing;
  }, [autoRing]);

  useEffect(() => {
    dialQueueRef.current = dialQueue;
    currentRef.current = current;
    aiCallRef.current = aiCall;
    aiHangingUpRef.current = aiHangingUp;
    transcriptStopRef.current = transcriptState.stop;
  });

  const pastStopAt = useCallback(() => {
    const raw = normalizeNbTime(stopAtTime);
    if (!raw) return false;
    const [hh, mm] = raw.split(":").map((x) => Number.parseInt(x, 10));
    const now = new Date();
    const limit = new Date(now);
    limit.setHours(hh, mm, 0, 0);
    return now.getTime() >= limit.getTime();
  }, [stopAtTime]);

  // Stopp auto-ring når køen er tom eller klokkeslett er passert
  useEffect(() => {
    if (!autoRing) return;
    if (dialQueue.length === 0 || pastStopAt()) {
      stopAutoRingWith("Auto-ring ferdig: ingen flere firma i køen, eller stopp-tiden er nådd.");
    }
  }, [autoRing, dialQueue.length, pastStopAt]);

  const totalWithPhone = useMemo(
    () =>
      listScopedItems.filter(
        (i) => dialableStatus(i.status) && i.phone?.trim()
      ).length,
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
    if (!aiCall?.id) return;

    let cancelled = false;
    let recordedOutcome = false;
    const callId = aiCall.id;
    const startedAt = Date.now();
    const maxMs = 30 * 60_000;
    let timer = 0;

    const poll = async () => {
      try {
        if (Date.now() - startedAt > maxMs) {
          if (timer) window.clearInterval(timer);
          return;
        }
        const res = await fetch(
          `/api/ai-call/active?id=${encodeURIComponent(callId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { call?: AiCall | null };
        if (cancelled || !data.call) return;
        setAiCall(data.call);

        const finished =
          data.call.status === "ended" || data.call.status === "failed";
        if (!recordedOutcome && finished) {
          recordedOutcome = true;
          if (data.call.outcome === "meeting") {
            setSessionStats(recordRingOutcome("meeting"));
            setItems((list) =>
              list.filter((i) => i.orgnr !== data.call!.orgnr)
            );
          } else if (data.call.outcome === "not_interested") {
            setItems((list) =>
              list.filter((i) => i.orgnr !== data.call!.orgnr)
            );
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

        // Stopp når transcript er på plass (eller feilet uten transcript)
        if (
          finished &&
          (data.call.transcript ||
            data.call.status === "failed" ||
            Date.now() - startedAt > 90_000)
        ) {
          if (timer) window.clearInterval(timer);
        }
      } catch {
        // ignore poll errors
      }
    };

    void poll();
    timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [aiCall?.id]);

  async function handleAiRing(
    orgnrOverride?: string
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    const targetOrgnr = orgnrOverride ?? current?.orgnr;
    const activeNow = isActiveAiStatus(aiCallRef.current?.status);
    if (!targetOrgnr || startingRef.current || activeNow) return { ok: false };
    startingRef.current = true;
    lastStartAtRef.current = Date.now();
    setAiStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgnr: targetOrgnr,
          ...(selectedListId ? { listId: selectedListId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        call?: AiCall;
        movedToCalled?: boolean;
      };
      if (!res.ok) {
        const msg = data.error ?? "Kunne ikke starte AI-ring";
        setError(msg);
        return { ok: false, status: res.status, error: msg };
      }
      if (data.call) {
        aiCallRef.current = data.call;
        setAiCall(data.call);
        setSelectedOrgnr(targetOrgnr);
        setRightTab("ai");
        setShowManus(true);
        setSessionStats(recordRingOutcome("dialed"));
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunne ikke starte AI-ring";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      startingRef.current = false;
      lastStartAtRef.current = Date.now();
      setAiStarting(false);
    }
  }

  function startAutoRing() {
    if (isDemoMode() || dialQueue.length === 0) return;
    // Hvis ingen batch er valgt: bruk hele synlige køen (eller foreslå 20)
    if (!batchOrgnrs && availablePool.length > 20) {
      applyBatchLimit(20);
    }
    // Et gammelt, ferdig anrop på første firma skal ikke blokkere start
    if (aiCallRef.current && !isActiveAiStatus(aiCallRef.current.status)) {
      aiCallRef.current = null;
      setAiCall(null);
    }
    finishedSeenRef.current = null;
    conflictCountRef.current = 0;
    lastStartAtRef.current = 0;
    setAutoRing(true);
    setError(null);
    setRightTab("ai");
  }

  function stopAutoRing() {
    setAutoRing(false);
  }

  /** Stopp auto-ring og vis hvorfor, så det aldri stopper i det stille. */
  function stopAutoRingWith(reason: string) {
    setAutoRing(false);
    setError((prev) => prev ?? reason);
  }

  /** Hopp videre til neste firma uten å bruke gammel state (trygt fra timer). */
  function advanceAutoRing(): string | null {
    const cur = currentRef.current;
    if (!cur) {
      stopAutoRingWith("Auto-ring stoppet: ingen firma å ringe.");
      return null;
    }
    const queue = dialQueueRef.current;
    const idx = queue.findIndex((i) => i.orgnr === cur.orgnr);
    const next = queue[idx + 1]?.orgnr ?? null;
    try {
      transcriptStopRef.current();
    } catch {
      /* ignore */
    }
    setSkippedOrgnrs((prev) => new Set(prev).add(cur.orgnr));
    setSelectedOrgnr(next);
    if (aiCallRef.current?.orgnr === cur.orgnr) aiCallRef.current = null;
    setAiCall((prev) => (prev?.orgnr === cur.orgnr ? null : prev));
    finishedSeenRef.current = null;
    // Neste kall starter ca. 1 sekund etter dette
    lastStartAtRef.current = Date.now() - 2200;
    if (!next) stopAutoRingWith("Auto-ring ferdig: alle firma i batchen er ringt.");
    return next;
  }

  async function autoRingStartCurrent(orgnr: string) {
    const result = await handleAiRing(orgnr);
    if (result.ok || !autoRingRef.current) return;
    if (result.status === 409) {
      // Et annet kall er fortsatt aktivt — vent litt, men ikke for evig
      conflictCountRef.current += 1;
      if (conflictCountRef.current >= 6) stopAutoRingWith("Auto-ring stoppet: et annet AI-kall ser ut til å henge.");
      return;
    }
    if (result.status === 400 || result.status === 404) {
      // Dårlig nummer / firma finnes ikke → hopp over og fortsett
      advanceAutoRing();
      return;
    }
    // Konfigurasjon, kreditt, innlogging osv. → stopp helt
    stopAutoRingWith(result.error ?? "Auto-ring stoppet: kunne ikke starte kall.");
  }

  // Auto-ring «hjerte»: sjekker status hvert sekund og går alltid videre.
  function autoRingTick() {
    if (!autoRingRef.current) return;
    if (pastStopAt()) {
      stopAutoRingWith(`Auto-ring ferdig: stopp-tiden kl. ${stopAtTime} er nådd.`);
      return;
    }
    if (startingRef.current || aiHangingUpRef.current) return;
    if (Date.now() - lastStartAtRef.current < 3000) return;

    const cur = currentRef.current;
    if (!cur) {
      stopAutoRingWith("Auto-ring stoppet: ingen firma å ringe.");
      return;
    }

    const ac = aiCallRef.current;
    if (ac && isActiveAiStatus(ac.status)) return; // venter på pågående samtale

    if (ac && ac.orgnr === cur.orgnr) {
      // Ferdig samtale (svar, ingen svar, feilet …) → gå videre etter kort pause
      const seen = finishedSeenRef.current;
      if (!seen || seen.id !== ac.id) {
        finishedSeenRef.current = { id: ac.id, at: Date.now() };
        return;
      }
      if (Date.now() - seen.at < 1600) return;
      conflictCountRef.current = 0;
      advanceAutoRing();
      return;
    }

    void autoRingStartCurrent(cur.orgnr);
  }

  useEffect(() => {
    autoRingTickRef.current = autoRingTick;
  });

  useEffect(() => {
    if (!autoRing) return;
    const timer = window.setInterval(() => autoRingTickRef.current(), 800);
    return () => window.clearInterval(timer);
  }, [autoRing]);

  async function handleAiHangUp() {
    if (!aiCall?.id || aiHangingUp || !aiActive) return;
    setAiHangingUp(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-call/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: aiCall.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        call?: AiCall;
        warnings?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke legge på");
      }
      if (data.call) setAiCall(data.call);
      if (data.warnings?.length) {
        setError(data.warnings.join(" · "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke legge på");
    } finally {
      setAiHangingUp(false);
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
            {batchOrgnrs
              ? `${batchRemaining} igjen av ${batchTotal}`
              : `${dialQueue.length} i kø`}
            {selectedListName ? ` · ${selectedListName}` : ""}
          </span>
          {autoRing ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              Auto
            </span>
          ) : null}
          {aiActive ? (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Live
            </span>
          ) : null}
          {listOrgnrs && listOrgnrs.size > 0 ? (
            <span className="hidden tabular-nums text-[10px] text-zinc-600 lg:inline">
              {availablePool.length}/{listOrgnrs.size} lastet
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
          <label className="hidden items-center gap-1.5 sm:inline-flex" title="Stopp nye auto-ring-anrop etter dette klokkeslettet (24-timers)">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Stopp kl.
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="14:30"
              lang="nb-NO"
              autoComplete="off"
              value={stopAtTime}
              onChange={(e) => setStopAtTime(draftNbTime(e.target.value))}
              onBlur={() => setStopAtTime((v) => normalizeNbTime(v))}
              className="h-8 w-[4.5rem] rounded-md border border-white/[0.08] bg-[#0a0a0a] px-2 text-xs tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40"
            />
          </label>
          {autoRing ? (
            <button
              type="button"
              onClick={stopAutoRing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30 transition hover:bg-amber-500/30"
            >
              <Square className="h-3 w-3 fill-current" />
              Stopp
            </button>
          ) : (
            <button
              type="button"
              onClick={startAutoRing}
              disabled={
                dialQueue.length === 0 || isDemoMode() || aiStarting || loading
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-500 px-2.5 text-xs font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-40"
              title="AI ringer automatisk gjennom batchen"
            >
              <Play className="h-3 w-3 fill-current" />
              Auto-ring
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void load(listOrgnrs ? [...listOrgnrs] : null)
            }
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

      {/* Mobil: batch-styring (kø-sidebar er skjult under md) */}
      {current ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-white/[0.06] bg-[#0f0f0f] px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Batch
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {BATCH_PRESETS.filter((n) => n <= availablePool.length).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applyBatchLimit(n)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium tabular-nums",
                  batchLimit === n
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-zinc-500 hover:bg-white/[0.05]"
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyBatchLimit(null)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                batchOrgnrs == null
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-500 hover:bg-white/[0.05]"
              )}
            >
              Alle
            </button>
          </div>
          <button
            type="button"
            onClick={goToNextFirm}
            disabled={!hasNextFirm}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200",
              !hasNextFirm && "opacity-35"
            )}
          >
            Neste
            <ChevronRight className="h-3 w-3" />
          </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Stopp kl.
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="14:30"
              lang="nb-NO"
              autoComplete="off"
              value={stopAtTime}
              onChange={(e) => setStopAtTime(draftNbTime(e.target.value))}
              onBlur={() => setStopAtTime((v) => normalizeNbTime(v))}
              className="h-7 min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0a0a0a] px-2 text-[11px] tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40"
            />
            {stopAtTime ? (
              <button
                type="button"
                onClick={() => setStopAtTime("")}
                className="shrink-0 text-[10px] text-zinc-500"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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

            <div className="border-b border-white/[0.06] px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Batch
                </p>
                <p className="tabular-nums text-[10px] text-zinc-500">
                  {availablePool.length} totalt
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Færre"
                  disabled={availablePool.length === 0}
                  onClick={() => {
                    const cur = batchLimit ?? availablePool.length;
                    applyBatchLimit(Math.max(1, cur - 5));
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-30"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availablePool.length)}
                  value={batchDraft}
                  onChange={(e) => setBatchDraft(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => {
                    const n = Number.parseInt(batchDraft, 10);
                    if (!Number.isFinite(n) || n <= 0) {
                      applyBatchLimit(null);
                      return;
                    }
                    applyBatchLimit(n);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-7 w-full min-w-0 rounded-md border border-white/[0.08] bg-[#0a0a0a] px-2 text-center text-xs font-medium tabular-nums text-zinc-100 outline-none focus:border-emerald-500/40"
                />
                <button
                  type="button"
                  aria-label="Flere"
                  disabled={availablePool.length === 0}
                  onClick={() => {
                    const cur = batchLimit ?? Math.min(20, availablePool.length);
                    applyBatchLimit(Math.min(availablePool.length, cur + 5));
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-30"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {BATCH_PRESETS.filter((n) => n <= availablePool.length || n === 10).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={n > availablePool.length}
                      onClick={() => applyBatchLimit(n)}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition",
                        batchLimit === n
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300",
                        n > availablePool.length && "opacity-30"
                      )}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => applyBatchLimit(null)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition",
                    batchOrgnrs == null
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
                  )}
                >
                  Alle
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label
                  htmlFor="ring-stop-at"
                  className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-600"
                >
                  Stopp kl.
                </label>
                <input
                  id="ring-stop-at"
                  type="text"
                  inputMode="numeric"
                  placeholder="14:30"
                  lang="nb-NO"
                  autoComplete="off"
                  value={stopAtTime}
                  onChange={(e) => setStopAtTime(draftNbTime(e.target.value))}
                  onBlur={() => setStopAtTime((v) => normalizeNbTime(v))}
                  className="h-7 min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0a0a0a] px-2 text-xs tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40"
                />
                {stopAtTime ? (
                  <button
                    type="button"
                    onClick={() => setStopAtTime("")}
                    className="shrink-0 text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Nullstill
                  </button>
                ) : null}
              </div>
              {stopAtTime ? (
                <p className="mt-1 text-[10px] leading-snug text-amber-500/80">
                  Ingen nye anrop etter kl. {stopAtTime}
                </p>
              ) : null}
              {batchOrgnrs ? (
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">
                  Ringer {batchOrgnrs.length} av {availablePool.length} ·{" "}
                  {batchRemaining} igjen
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">
                  Velg antall for denne økta
                </p>
              )}
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
                  {aiActive ? (
                    <div className="space-y-2">
                      <p className="text-center text-xs font-medium text-emerald-400/90">
                        {autoRing ? "Auto-ring · " : ""}
                        {aiCall ? aiCallStatusLabel(aiCall) : "Aktiv…"}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleAiHangUp()}
                        disabled={aiHangingUp}
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500",
                          aiHangingUp && "opacity-50"
                        )}
                      >
                        {aiHangingUp ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneOff className="h-4 w-4" />
                        )}
                        {aiHangingUp ? "Legger på…" : "Legg på"}
                      </button>
                      {autoRing ? (
                        <button
                          type="button"
                          onClick={stopAutoRing}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          Stopp auto-ring
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => void handleAiRing()}
                        disabled={aiStarting || isDemoMode() || autoRing}
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400",
                          (aiStarting || isDemoMode() || autoRing) && "opacity-50"
                        )}
                      >
                        {aiStarting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                        {aiStarting ? "Starter AI…" : "AI ringer"}
                      </button>
                      {autoRing ? (
                        <button
                          type="button"
                          onClick={stopAutoRing}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-medium text-amber-200"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          Stopp auto-ring
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startAutoRing}
                          disabled={
                            dialQueue.length === 0 ||
                            isDemoMode() ||
                            aiStarting
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-40"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Start auto-ring
                          {batchOrgnrs
                            ? ` (${batchRemaining})`
                            : dialQueue.length > 0
                              ? ` (${Math.min(20, dialQueue.length)})`
                              : ""}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-center text-[10px] leading-snug text-zinc-600">
                    {autoRing
                      ? stopAtTime
                        ? `Auto-ring · stopper nye anrop etter kl. ${stopAtTime}.`
                        : "Auto-ring kjører. Den går videre til neste når samtalen er ferdig."
                      : aiActive
                        ? "Trykk Legg på for å avslutte samtalen med en gang."
                        : "Velg batch → Start auto-ring, eller ring én og én."}
                  </p>
                  {!aiActive ? (
                    <button
                      type="button"
                      onClick={goToNextFirm}
                      disabled={!hasNextFirm}
                      className={cn(
                        "mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.07]",
                        !hasNextFirm && "opacity-35"
                      )}
                    >
                      Neste firma
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                  ) : null}
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
    // ElevenLabs bruker agent/user; Vapi/eldre: AI/Kunde m.m.
    const m = line.match(
      /^(AI|Assistant|Agent|Bot|User|Kunde|Customer)\s*:\s*(.*)$/i
    );
    if (m) {
      const role = /^(user|kunde|customer)$/i.test(m[1]!)
        ? "user"
        : "assistant";
      out.push({ role, text: m[2] ?? "" });
    } else if (out.length) {
      out[out.length - 1]!.text += ` ${line}`;
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
    title = "Ingen ringbare firma i listen";
    description = `Fant ingen firma i ${listLabel} som kan ringes nå (mangler data, eller alle er markert ferdig).`;
  } else if (allSkipped) {
    title = "Du har hoppet over alle i listen";
    description =
      "Start på nytt med de du hoppet over, eller velg en annen liste.";
  } else if (hasQueue && !hasPhoneInQueue) {
    title = listFilterActive
      ? "Ingen i listen har telefon"
      : "Ingen i køen har telefon";
    description = listFilterActive
      ? `Firma i ${listLabel} mangler telefonnummer.`
      : "Legg firma med telefonnummer i arbeidskøen fra Skann — bruk fanen «Med telefon».";
  } else if (listFilterActive && !hasQueue) {
    title = "Ingen ringbare firma i listen";
    description = `Ingen firma i ${listLabel} kan ringes akkurat nå.`;
  } else {
    title = "Køen er tom";
    description =
      "Velg en lagret liste øverst, eller legg leads i arbeidskøen fra Skann.";
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
