"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatRegisteredDate } from "@/lib/utils";
import {
  Mail,
  Phone,
  CheckCircle2,
  ListTodo,
  RefreshCw,
  ChevronDown,
  X,
  Trash2,
  UserMinus,
} from "lucide-react";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { statusLabel } from "@/lib/sales/constants";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
  type QueueItemResponse,
} from "@/lib/sales/queue-score";

type QueueItem = QueueItemResponse;

const FETCH_TIMEOUT_MS = 30_000;

function recentCompaniesLast30Days<T extends { registered_at: string | null }>(
  companies: T[]
): T[] {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  return companies.filter((c) => c.registered_at && c.registered_at >= sinceStr);
}

type QueueCardProps = {
  item: QueueItem;
  rank?: number;
  compact?: boolean;
  busyOrgnr: string | null;
  actionOrgnr: string | null;
  onMarkContacted: (orgnr: string) => void;
  onRemoveFromQueue: (orgnr: string) => void;
  onRequestDelete: (item: QueueItem) => void;
};

function QueueCard({
  item,
  rank,
  compact,
  busyOrgnr,
  actionOrgnr,
  onMarkContacted,
  onRemoveFromQueue,
  onRequestDelete,
}: QueueCardProps) {
  const isBusy = busyOrgnr === item.orgnr || actionOrgnr === item.orgnr;
  const isContacted = item.status === "kontaktet";

  return (
    <li className="ko-queue-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {rank != null && (
            <p className="text-xs font-semibold text-slate-400">#{rank}</p>
          )}
          <h2 className="font-semibold text-slate-900">{item.name}</h2>
          <p className="text-xs text-slate-500">
            {item.municipalityName ?? "—"}
            {item.registeredAt && ` · ${formatRegisteredDate(item.registeredAt)}`}
            {item.daysSinceRegistration != null &&
              ` · ${item.daysSinceRegistration} d siden`}
          </p>
          {item.dagligLeder && (
            <p className="mt-0.5 text-xs text-slate-600">
              Daglig leder: {item.dagligLeder}
            </p>
          )}
        </div>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
          {item.queueScore} poeng
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        {item.hasWebsite === false && (
          <span className="ko-queue-badge ko-queue-badge--amber">Uten nettside</span>
        )}
        {item.phone && (
          <span className="ko-queue-badge ko-queue-badge--emerald">Har tlf</span>
        )}
        {item.email && (
          <span className="ko-queue-badge ko-queue-badge--email">Har e-post</span>
        )}
        <span className="ko-queue-badge ko-queue-badge--status">
          {statusLabel(item.status)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Mail className="h-3.5 w-3.5" />
            E-post
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Phone className="h-3.5 w-3.5" />
            Ring
          </a>
        )}
        {!compact && !isContacted && (
          <button
            type="button"
            onClick={() => onMarkContacted(item.orgnr)}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busyOrgnr === item.orgnr ? "Lagrer…" : "Markert kontaktet"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemoveFromQueue(item.orgnr)}
          disabled={isBusy}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <UserMinus className="h-3.5 w-3.5" />
          {actionOrgnr === item.orgnr ? "Lagrer…" : "Fjern fra kø"}
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(item)}
          disabled={isBusy}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Slett
        </button>
      </div>
    </li>
  );
}

export function KoClient() {
  const { companies, setLeadStatus, deleteLead } = useDemo();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [actionOrgnr, setActionOrgnr] = useState<string | null>(null);
  const [contactedOpen, setContactedOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isDemoMode()) {
        const recent = recentCompaniesLast30Days(companies);
        const leadsByOrgnr = new Map(
          recent
            .filter((c) => c.user_lead)
            .map((c) => [c.orgnr, c.user_lead!])
        );
        const candidates = buildQueueCandidates(recent, leadsByOrgnr, new Map());
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

      let data: { items?: QueueItem[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("Ugyldig svar fra server");
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke laste kø");
      }

      setItems(data.items ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Forespørselen tok for lang tid. Prøv «Oppdater».");
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

  const nyItems = useMemo(
    () => items.filter((i) => i.status === "ny"),
    [items]
  );
  const contactedItems = useMemo(
    () => items.filter((i) => i.status === "kontaktet"),
    [items]
  );

  async function postStatus(orgnr: string, status: string) {
    const res = await fetch("/api/leads/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgnr, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Kunne ikke oppdatere");
    }
  }

  async function markContacted(orgnr: string) {
    setMarking(orgnr);
    setError(null);
    const prev = items;
    setItems((list) =>
      list.map((i) => (i.orgnr === orgnr ? { ...i, status: "kontaktet" } : i))
    );
    try {
      if (isDemoMode()) {
        setLeadStatus(orgnr, "kontaktet");
        return;
      }
      await postStatus(orgnr, "kontaktet");
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Feil ved oppdatering");
    } finally {
      setMarking(null);
    }
  }

  async function removeFromQueue(orgnr: string) {
    const item = items.find((i) => i.orgnr === orgnr);
    if (!item) return;
    if (
      !window.confirm(
        `Fjern ${item.name} fra daglig kø?\n\nFirma finnes fortsatt under Skann og Pipeline.`
      )
    ) {
      return;
    }

    setActionOrgnr(orgnr);
    setError(null);
    const prev = items;
    setItems((list) => list.filter((i) => i.orgnr !== orgnr));
    try {
      if (isDemoMode()) {
        setLeadStatus(orgnr, "ikke_interessert");
        return;
      }
      await postStatus(orgnr, "ikke_interessert");
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne fra kø");
    } finally {
      setActionOrgnr(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const orgnr = deleteTarget.orgnr;
    setActionOrgnr(orgnr);
    setError(null);
    const prev = items;
    setItems((list) => list.filter((i) => i.orgnr !== orgnr));
    setDeleteTarget(null);
    try {
      if (isDemoMode()) {
        deleteLead(orgnr);
        return;
      }
      const res = await fetch(`/api/leads/${encodeURIComponent(orgnr)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Kunne ikke slette");
      }
    } catch (err) {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Kunne ikke slette lead");
    } finally {
      setActionOrgnr(null);
    }
  }

  const showInitialLoading = loading && items.length === 0 && !error;
  const hasAnyItems = nyItems.length > 0 || contactedItems.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-brand-gold">
          <ListTodo className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Arbeidskø</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
          Ring / send i dag
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Alle firma i køen, rangert etter score, hvor nye de er, telefon og nettside-sjekk.
          Start her hver morgen.
        </p>
        {!loading && hasAnyItems && (
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {nyItems.length} firma å ringe
            {contactedItems.length > 0 &&
              ` · ${contactedItems.length} kontaktet i dag`}
          </p>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Oppdater
        </button>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      )}

      {showInitialLoading ? (
        <p className="text-sm text-slate-500">Laster arbeidskø…</p>
      ) : !loading && !hasAnyItems ? (
        <p className="text-sm text-slate-500">
          Ingen leads i køen akkurat nå.{" "}
          <Link href="/app" className="font-semibold text-sky-700 underline">
            Skann markedet
          </Link>
        </p>
      ) : (
        <div className="space-y-6">
          {nyItems.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ingen nye firma å ringe nå. Se kontaktede under, eller{" "}
              <Link href="/app" className="font-semibold text-sky-700 underline">
                skann markedet
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {nyItems.map((item, index) => (
                <QueueCard
                  key={item.orgnr}
                  item={item}
                  rank={index + 1}
                  busyOrgnr={marking}
                  actionOrgnr={actionOrgnr}
                  onMarkContacted={markContacted}
                  onRemoveFromQueue={removeFromQueue}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </ul>
          )}

          {contactedItems.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setContactedOpen((o) => !o)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm font-semibold text-slate-800"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition",
                    contactedOpen && "rotate-180"
                  )}
                />
                Kontaktet i dag ({contactedItems.length})
              </button>
              {contactedOpen && (
                <ul className="mt-2 space-y-2">
                  {contactedItems.map((item) => (
                    <QueueCard
                      key={item.orgnr}
                      item={item}
                      compact
                      busyOrgnr={marking}
                      actionOrgnr={actionOrgnr}
                      onMarkContacted={markContacted}
                      onRemoveFromQueue={removeFromQueue}
                      onRequestDelete={setDeleteTarget}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-lead-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="delete-lead-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                Slette lead?
              </h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{deleteTarget.name}</span>{" "}
              fjernes fra dine leads. Firma kan dukke opp som nytt i kø uten tidligere
              status.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={actionOrgnr === deleteTarget.orgnr}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {actionOrgnr === deleteTarget.orgnr ? "Sletter…" : "Ja, slett"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
