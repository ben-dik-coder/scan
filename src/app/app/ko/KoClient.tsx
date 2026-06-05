"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListTodo, Trash2, X } from "lucide-react";
import { NextStepBanner } from "@/components/journey/NextStepBanner";
import { KoFocusView } from "@/components/ko/KoFocusView";
import { KoListView } from "@/components/ko/KoListView";
import { KoSendDrawer } from "@/components/ko/KoSendDrawer";
import { KoToolbar } from "@/components/ko/KoToolbar";
import { filterQueueItems } from "@/components/ko/queue-utils";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import type { EmailTemplate } from "@/types/database";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
  type QueueItemResponse,
} from "@/lib/sales/queue-score";

type QueueItem = QueueItemResponse;
type ViewMode = "focus" | "list";

const FETCH_TIMEOUT_MS = 30_000;

function recentCompaniesLast30Days<T extends { registered_at: string | null }>(
  companies: T[]
): T[] {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  return companies.filter((c) => c.registered_at && c.registered_at >= sinceStr);
}

export function KoClient() {
  const { companies, templates, sequences, setLeadStatus, deleteLead } = useDemo();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [actionOrgnr, setActionOrgnr] = useState<string | null>(null);
  const [contactedOpen, setContactedOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<QueueItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [search, setSearch] = useState("");
  const [noWebsite, setNoWebsite] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [skippedOrgnrs, setSkippedOrgnrs] = useState<Set<string>>(new Set());
  const [sendTarget, setSendTarget] = useState<QueueItem | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(templates);
  const [queueToast, setQueueToast] = useState<string | null>(null);
  const [contactedHint, setContactedHint] = useState<string | null>(null);

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
        setEmailTemplates(templates);
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

      const data = (await res.json()) as { items?: QueueItem[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke laste kø");
      }

      setItems(data.items ?? []);

      const tplRes = await fetch("/api/templates");
      if (tplRes.ok) {
        const tplData = (await tplRes.json()) as EmailTemplate[];
        setEmailTemplates(Array.isArray(tplData) ? tplData : []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Forespørselen tok for lang tid. Prøv «Oppdater».");
      } else {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      }
    } finally {
      setLoading(false);
    }
  }, [companies, templates]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("nylead-queue-toast");
      if (msg) {
        setQueueToast(msg);
        sessionStorage.removeItem("nylead-queue-toast");
        const t = setTimeout(() => setQueueToast(null), 6000);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const filteredItems = useMemo(
    () =>
      filterQueueItems(items, {
        search,
        noWebsite,
        hasPhone,
        skippedOrgnrs: viewMode === "focus" ? skippedOrgnrs : undefined,
      }),
    [items, search, noWebsite, hasPhone, skippedOrgnrs, viewMode]
  );

  const nyItems = useMemo(
    () => filteredItems.filter((i) => i.status === "ny"),
    [filteredItems]
  );
  const contactedItems = useMemo(
    () => items.filter((i) => i.status === "kontaktet"),
    [items]
  );

  const focusItem = nyItems[0] ?? null;

  async function postStatus(
    orgnr: string,
    status: string,
    extra?: { queue?: boolean; unqueue?: boolean }
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

  async function markContacted(orgnr: string) {
    setMarking(orgnr);
    setError(null);
    const prev = items;
    setItems((list) =>
      list.map((i) => (i.orgnr === orgnr ? { ...i, status: "kontaktet" } : i))
    );
    setSkippedOrgnrs((s) => {
      const next = new Set(s);
      next.delete(orgnr);
      return next;
    });
    const name = prev.find((i) => i.orgnr === orgnr)?.name;
    try {
      if (isDemoMode()) {
        setLeadStatus(orgnr, "kontaktet");
      } else {
        await postStatus(orgnr, "kontaktet");
      }
      setContactedHint(
        name
          ? `${name} flyttet til Pipeline som kontaktet`
          : "Lead flyttet til Pipeline som kontaktet"
      );
      setTimeout(() => setContactedHint(null), 5000);
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
        `Fjern ${item.name} fra arbeidskøen?\n\nFirma finnes fortsatt under Skann og Pipeline.`
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
        setLeadStatus(orgnr, "ikke_interessert", { unqueue: true });
        return;
      }
      await postStatus(orgnr, "ikke_interessert", { unqueue: true });
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

  function skipFocusItem(orgnr: string) {
    setSkippedOrgnrs((prev) => new Set(prev).add(orgnr));
  }

  const showInitialLoading = loading && items.length === 0 && !error;
  const hasAnyItems = items.length > 0;
  const allNyDone = hasAnyItems && nyItems.length === 0 && contactedItems.length > 0;

  return (
    <div className="scan-glass-kommand space-y-6 pb-8">
      <header>
        <div className="flex items-center gap-2 text-brand-gold">
          <ListTodo className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Arbeidskø</span>
        </div>
        <h1 className="scan-glass-strong mt-2 font-display text-2xl font-bold">
          Ring / send i dag
        </h1>
        <p className="scan-glass-muted mt-2 max-w-xl text-sm">
          Bare firma du har lagt i kø fra Skann. Jobb én og én i fokusmodus — eller se hele
          listen.
        </p>
      </header>

      <NextStepBanner pagePhase="work_queue" />

      {queueToast && (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {queueToast}
        </p>
      )}

      {contactedHint && (
        <p className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-100">
          {contactedHint}
        </p>
      )}

      {hasAnyItems && (
        <KoToolbar
          nyCount={items.filter((i) => i.status === "ny").length}
          contactedCount={contactedItems.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          search={search}
          onSearchChange={setSearch}
          noWebsite={noWebsite}
          onNoWebsiteChange={setNoWebsite}
          hasPhone={hasPhone}
          onHasPhoneChange={setHasPhone}
          loading={loading}
          onRefresh={() => void load()}
        />
      )}

      {error && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      )}

      {showInitialLoading ? (
        <p className="scan-glass-muted text-sm">Laster arbeidskø…</p>
      ) : !loading && !hasAnyItems ? (
        <div className="ko-empty rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="scan-glass-strong text-sm font-semibold">
            Du har ingen firma i køen ennå
          </p>
          <p className="scan-glass-muted mt-2 text-sm">
            Gå til Skann, velg firma og legg dem i kø. Etterpå tar du kontakt her — én og én.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app" className="btn-primary text-sm">
              Gå til Skann
            </Link>
            <Link href="/app/pipeline" className="scan-btn-ghost text-sm">
              Sjekk Pipeline
            </Link>
          </div>
        </div>
      ) : viewMode === "focus" ? (
        focusItem ? (
          <KoFocusView
            item={focusItem}
            currentIndex={items.filter((i) => i.status === "ny").length - nyItems.length + 1}
            totalNy={items.filter((i) => i.status === "ny").length}
            contactedCount={contactedItems.length}
            busy={marking === focusItem.orgnr}
            onMarkContacted={() => void markContacted(focusItem.orgnr)}
            onSendEmail={() => setSendTarget(focusItem)}
            onSkip={() => skipFocusItem(focusItem.orgnr)}
            onRemoveFromQueue={() => void removeFromQueue(focusItem.orgnr)}
            onRequestDelete={() => setDeleteTarget(focusItem)}
          />
        ) : allNyDone ? (
          <div className="ko-empty rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-emerald-100">
              Bra jobba! Alle i køen er kontaktet i dag.
            </p>
            <p className="mt-2 text-sm text-emerald-200/80">
              Du er ferdig med køen i dag — sjekk Pipeline for oppfølging.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/app" className="scan-btn-ghost text-sm">
                Fra Skann
              </Link>
              <Link href="/app/pipeline" className="scan-btn-ghost text-sm">
                Pipeline
              </Link>
            </div>
          </div>
        ) : (
          <p className="scan-glass-muted text-sm">
            Ingen treff med filteret ditt.{" "}
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setNoWebsite(false);
                setHasPhone(false);
                setSkippedOrgnrs(new Set());
              }}
              className="font-semibold text-sky-300 underline"
            >
              Nullstill filter
            </button>
          </p>
        )
      ) : (
        <KoListView
          nyItems={nyItems}
          contactedItems={contactedItems}
          contactedOpen={contactedOpen}
          onContactedOpenChange={setContactedOpen}
          busyOrgnr={marking}
          actionOrgnr={actionOrgnr}
          onMarkContacted={(orgnr) => void markContacted(orgnr)}
          onSendEmail={setSendTarget}
          onRemoveFromQueue={(orgnr) => void removeFromQueue(orgnr)}
          onRequestDelete={setDeleteTarget}
        />
      )}

      {viewMode === "focus" && contactedItems.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setContactedOpen((o) => !o)}
            className="ko-queue-section-toggle flex w-full items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-left text-sm font-semibold text-slate-200"
          >
            Kontaktet i dag ({contactedItems.length})
          </button>
          {contactedOpen && (
            <ul className="mt-2 space-y-2">
              {contactedItems.map((item) => (
                <li
                  key={item.orgnr}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
                >
                  {item.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <KoSendDrawer
        item={sendTarget}
        open={Boolean(sendTarget)}
        templates={emailTemplates}
        sequences={sequences}
        onClose={() => setSendTarget(null)}
        onSent={() => {
          if (sendTarget) void markContacted(sendTarget.orgnr);
        }}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Slette lead?</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">{deleteTarget.name}</span>{" "}
              fjernes fra dine leads.
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
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
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
