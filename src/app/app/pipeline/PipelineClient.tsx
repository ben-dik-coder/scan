"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NextStepBanner } from "@/components/journey/NextStepBanner";
import { KoSendDrawer } from "@/components/ko/KoSendDrawer";
import { pipelineItemToQueueItem } from "@/components/ko/queue-utils";
import { LeadDetailDrawer } from "@/components/pipeline/LeadDetailDrawer";
import { PageHeader } from "@/components/ui/primitives";
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
  const [items, setItems] = useState<PipelineItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [followUpToday, setFollowUpToday] = useState(false);
  const [score70Plus, setScore70Plus] = useState(false);
  const [drawerItem, setDrawerItem] = useState<PipelineItem | null>(null);
  const [drawerFocusNotes, setDrawerFocusNotes] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<PipelineItem | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailSequences, setEmailSequences] = useState<
    { id: string; name: string; steps: unknown[] }[]
  >([]);

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
        const seqData = (await seqRes.json()) as { id: string; name: string; steps: unknown[] }[];
        setEmailSequences(Array.isArray(seqData) ? seqData : []);
      }
    })();
  }, [isDemo]);

  const activeItems = useMemo(
    () =>
      items.filter((i) =>
        (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(i.lead.status)
      ),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.company.name.toLowerCase().includes(q)) return false;
      if (followUpToday && !isFollowUpToday(item.lead.next_follow_up_at)) return false;
      if (score70Plus && item.lead.score < 70) return false;
      return true;
    });
  }, [items, search, followUpToday, score70Plus]);

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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Statusendring feilet");
      } catch (err) {
        updateItem(orgnr, {
          status: prev.lead.status,
          last_contacted_at: prev.lead.last_contacted_at,
        });
        setStatusError(err instanceof Error ? err.message : "Ukjent feil");
      }
    },
    [items, isDemo, demo, updateItem]
  );

  const handleLeadPatch = useCallback(
    async (orgnr: string, patch: { notes?: string; next_follow_up_at?: string | null }) => {
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
      const data = await res.json();
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

  return (
    <div className="scan-glass-kommand space-y-4 pb-8">
      <PageHeader
        title="Pipeline"
        description="Her følger du opp leads du allerede har kontaktet"
      />

      <NextStepBanner pagePhase="pipeline" />

      {overdueCount > 0 && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          {overdueCount} lead{overdueCount === 1 ? "" : "s"} har forfalt oppfølging
        </p>
      )}

      <PipelineToolbar
        totalCount={activeItems.length}
        visibleCount={filteredItems.filter((i) =>
          (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(i.lead.status)
        ).length}
        search={search}
        onSearchChange={setSearch}
        followUpToday={followUpToday}
        onFollowUpTodayChange={setFollowUpToday}
        score70Plus={score70Plus}
        onScore70PlusChange={setScore70Plus}
      />

      {statusError && (
        <p className="text-sm text-red-400" role="alert">
          {statusError}
        </p>
      )}

      {items.length === 0 ? (
        <div className="pipeline-empty rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="scan-glass-strong text-sm font-semibold">Ingen leads i pipeline ennå</p>
          <p className="scan-glass-muted mt-2 text-sm">
            Ingen leads ennå — start på Skann og legg i kø, så dukker de opp her etter kontakt.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app" className="btn-primary text-sm">
              Gå til Skann
            </Link>
            <Link href="/app/ko" className="scan-btn-ghost text-sm">
              Arbeidskø
            </Link>
          </div>
        </div>
      ) : (
        <PipelineBoard
          items={filteredItems}
          onStatusChange={handleStatusChange}
          onOpenCard={openCard}
        />
      )}

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
