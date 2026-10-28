"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Kanban } from "lucide-react";
import { shuffledAgentOrgnrsFromFilters } from "@/lib/agent/saved-list-filters";
import { KoSendDrawer } from "@/components/ko/KoSendDrawer";
import { pipelineItemToQueueItem } from "@/components/ko/queue-utils";
import { LeadDetailDrawer } from "@/components/pipeline/LeadDetailDrawer";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineToolbar } from "@/components/pipeline/PipelineToolbar";
import type { PipelineItem } from "@/components/pipeline/types";
import { ACTIVE_PIPELINE_STATUSES } from "@/components/pipeline/types";
import { useDemo } from "@/lib/demo/store";
import type { EmailTemplate, LeadStatus } from "@/types/database";
import { isFollowUpOverdue } from "@/lib/utils";

type Props = {
  initialItems: PipelineItem[];
  isDemo: boolean;
};

function isFollowUpToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function PipelineClient({ initialItems, isDemo }: Props) {
  const demo = useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadedListIdRef = useRef<string | null>(null);
  const [items, setItems] = useState<PipelineItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [followUpToday, setFollowUpToday] = useState(false);
  const [score70Plus, setScore70Plus] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listOrgnrs, setListOrgnrs] = useState<Set<string> | null>(null);
  const [drawerItem, setDrawerItem] = useState<PipelineItem | null>(null);
  const [drawerFocusNotes, setDrawerFocusNotes] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<PipelineItem | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailSequences, setEmailSequences] = useState<
    { id: string; name: string; steps: unknown[] }[]
  >([]);
  const [showNyColumn, setShowNyColumn] = useState(false);

  useEffect(() => {
    if (!isDemo) return;
    const demoItems = demo.companies
      .filter((c) => c.user_lead)
      .map((c) => ({ lead: c.user_lead!, company: c }));
    setItems(demoItems);
    setEmailTemplates(demo.templates);
    setEmailSequences(demo.sequences);
  }, [isDemo, demo.companies, demo.templates, demo.sequences]);

  useEffect(() => {
    if (isDemo) return;
    void (async () => {
      const [tplRes, seqRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/sequences"),
      ]);
      if (tplRes.ok) {
        const tplData = (await tplRes.json()) as EmailTemplate[];
        setEmailTemplates(Array.isArray(tplData) ? tplData : []);
      }
      if (seqRes.ok) {
        const seqData = (await seqRes.json()) as {
          id: string;
          name: string;
          steps: unknown[];
        }[];
        setEmailSequences(Array.isArray(seqData) ? seqData : []);
      }
    })();
  }, [isDemo]);

  useEffect(() => {
    const listId = searchParams.get("liste");
    if (!listId) {
      loadedListIdRef.current = null;
      setSelectedListId(null);
      setListOrgnrs(null);
      return;
    }

    if (loadedListIdRef.current === listId) return;

    if (isDemo) {
      const row = demo.savedLists.find((l) => l.id === listId);
      if (!row) {
        loadedListIdRef.current = null;
        setSelectedListId(null);
        setListOrgnrs(null);
        return;
      }
      const orgnrs = shuffledAgentOrgnrsFromFilters(row.filters);
      loadedListIdRef.current = listId;
      setSelectedListId(listId);
      setListOrgnrs(orgnrs.length > 0 ? new Set(orgnrs) : null);
      return;
    }

    fetch(`/api/saved-lists?id=${encodeURIComponent(listId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row: { filters?: Record<string, unknown> } | null) => {
        if (!row) {
          loadedListIdRef.current = null;
          setSelectedListId(null);
          setListOrgnrs(null);
          return;
        }
        const orgnrs = shuffledAgentOrgnrsFromFilters(row.filters);
        loadedListIdRef.current = listId;
        setSelectedListId(listId);
        setListOrgnrs(orgnrs.length > 0 ? new Set(orgnrs) : null);
      })
      .catch(() => undefined);
  }, [searchParams, isDemo, demo.savedLists]);

  const handleListSelect = useCallback(
    (selection: {
      listId: string | null;
      orgnrs: string[] | null;
      listName: string | null;
    }) => {
      setSelectedListId(selection.listId);
      setListOrgnrs(
        selection.orgnrs && selection.orgnrs.length > 0
          ? new Set(selection.orgnrs)
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
      router.replace(qs ? `/app/pipeline?${qs}` : "/app/pipeline");
    },
    [router, searchParams]
  );

  const activeItems = useMemo(
    () =>
      items.filter((i) =>
        (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(i.lead.status)
      ),
    [items]
  );

  const listScopedActiveItems = useMemo(() => {
    if (!listOrgnrs) return activeItems;
    return activeItems.filter((i) => listOrgnrs.has(i.lead.orgnr));
  }, [activeItems, listOrgnrs]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (listOrgnrs && !listOrgnrs.has(item.lead.orgnr)) return false;
      if (q && !item.company.name.toLowerCase().includes(q)) return false;
      if (followUpToday && !isFollowUpToday(item.lead.next_follow_up_at)) return false;
      if (score70Plus && item.lead.score < 70) return false;
      return true;
    });
  }, [items, search, followUpToday, score70Plus, listOrgnrs]);

  const nyCount = useMemo(
    () => filteredItems.filter((i) => i.lead.status === "ny").length,
    [filteredItems]
  );

  const updateItem = useCallback((orgnr: string, patch: Partial<PipelineItem["lead"]>) => {
    setItems((prev) =>
      prev.map((i) =>
        i.lead.orgnr === orgnr ? { ...i, lead: { ...i.lead, ...patch } } : i
      )
    );
    setDrawerItem((prev) =>
      prev?.lead.orgnr === orgnr ? { ...prev, lead: { ...prev.lead, ...patch } } : prev
    );
  }, []);

  const handleStatusChange = useCallback(
    async (orgnr: string, status: LeadStatus) => {
      setStatusError(null);
      const prev = items.find((i) => i.lead.orgnr === orgnr);
      if (!prev || prev.lead.status === status) return;

      const now = new Date().toISOString();
      const optimistic = {
        status,
        updated_at: now,
        last_contacted_at:
          status === "kontaktet" ? now : prev.lead.last_contacted_at,
      };

      updateItem(orgnr, optimistic);

      if (isDemo) {
        demo.updateLeadStatus(orgnr, status);
        return;
      }

      try {
        const res = await fetch("/api/leads/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgnr, status }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          updateItem(orgnr, {
            status: prev.lead.status,
            updated_at: prev.lead.updated_at,
            last_contacted_at: prev.lead.last_contacted_at,
          });
          setStatusError(data.error ?? "Kunne ikke oppdatere status");
        }
      } catch {
        updateItem(orgnr, {
          status: prev.lead.status,
          updated_at: prev.lead.updated_at,
          last_contacted_at: prev.lead.last_contacted_at,
        });
        setStatusError("Kunne ikke oppdatere status");
      }
    },
    [items, isDemo, demo, updateItem]
  );

  const handleLeadPatch = useCallback(
    async (
      orgnr: string,
      patch: { notes?: string; next_follow_up_at?: string | null }
    ) => {
      const prev = items.find((i) => i.lead.orgnr === orgnr);
      if (!prev) return;

      const optimistic = {
        notes: patch.notes !== undefined ? patch.notes : prev.lead.notes,
        next_follow_up_at:
          patch.next_follow_up_at !== undefined
            ? patch.next_follow_up_at
            : prev.lead.next_follow_up_at,
        updated_at: new Date().toISOString(),
      };
      updateItem(orgnr, optimistic);

      if (isDemo) return;

      const res = await fetch(`/api/leads/${orgnr}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        updateItem(orgnr, {
          notes: prev.lead.notes,
          next_follow_up_at: prev.lead.next_follow_up_at,
        });
        throw new Error(data.error ?? "Lagring feilet");
      }
    },
    [items, isDemo, updateItem]
  );

  function openCard(item: PipelineItem, section?: "notes") {
    setDrawerItem(item);
    setDrawerFocusNotes(section === "notes");
  }

  const overdueCount = items.filter((i) =>
    isFollowUpOverdue(i.lead.next_follow_up_at)
  ).length;

  const visibleActiveCount = filteredItems.filter((i) =>
    (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(i.lead.status)
  ).length;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[#0a0a0a] text-zinc-100">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0f0f0f] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Kanban className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="truncate text-sm font-medium text-white">Pipeline</span>
          <span className="hidden text-zinc-600 sm:inline">·</span>
          <span className="hidden truncate text-xs text-zinc-500 sm:inline">
            {listScopedActiveItems.length} aktive
          </span>
          {overdueCount > 0 ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
              {overdueCount} forfalt
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {nyCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowNyColumn((v) => !v)}
              className={`inline-flex h-8 items-center rounded-md px-2 text-xs font-medium transition ${
                showNyColumn
                  ? "bg-white/[0.08] text-zinc-200"
                  : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
              }`}
              title={showNyColumn ? "Skjul Ny-kolonnen" : "Vis Ny-kolonnen"}
            >
              Ny ({nyCount})
            </button>
          ) : null}
          <Link
            href="/app"
            className="hidden h-8 items-center rounded-md px-2 text-xs text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 sm:inline-flex"
          >
            Fra Skann
          </Link>
        </div>
      </header>

      <div className="shrink-0 border-b border-white/[0.06] bg-[#0c0c0c] px-3 py-2">
        <PipelineToolbar
          totalCount={listScopedActiveItems.length}
          visibleCount={visibleActiveCount}
          selectedListId={selectedListId}
          onListSelect={handleListSelect}
          search={search}
          onSearchChange={setSearch}
          followUpToday={followUpToday}
          onFollowUpTodayChange={setFollowUpToday}
          score70Plus={score70Plus}
          onScore70PlusChange={setScore70Plus}
        />
      </div>

      {statusError && (
        <p className="shrink-0 px-3 py-2 text-sm text-red-400" role="alert">
          {statusError}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {items.length === 0 ? (
          <div className="pipeline-empty flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center">
            <p className="text-sm font-semibold text-white">Ingen leads ennå</p>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Start på Skann og legg firma i kø — de dukker opp her etter kontakt.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/app"
                className="inline-flex h-9 items-center rounded-lg bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400"
              >
                Gå til Skann
              </Link>
              <Link
                href="/app/ko"
                className="inline-flex h-9 items-center rounded-lg px-4 text-xs font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
              >
                Arbeidskø
              </Link>
            </div>
          </div>
        ) : (
          <PipelineBoard
            items={filteredItems}
            onStatusChange={handleStatusChange}
            onOpenCard={openCard}
            showNyColumn={showNyColumn}
            onExpandNy={() => setShowNyColumn(true)}
          />
        )}
      </div>

      <LeadDetailDrawer
        item={drawerItem}
        open={Boolean(drawerItem)}
        isDemo={isDemo}
        focusNotes={drawerFocusNotes}
        onClose={() => setDrawerItem(null)}
        onStatusChange={handleStatusChange}
        onLeadPatch={handleLeadPatch}
        onSendEmail={
          drawerItem?.company.email
            ? () => {
                setSendTarget(drawerItem);
                setDrawerItem(null);
              }
            : undefined
        }
      />

      <KoSendDrawer
        item={sendTarget ? pipelineItemToQueueItem(sendTarget) : null}
        open={Boolean(sendTarget)}
        templates={emailTemplates}
        sequences={emailSequences}
        onClose={() => setSendTarget(null)}
        onSent={() => setSendTarget(null)}
      />
    </div>
  );
}
