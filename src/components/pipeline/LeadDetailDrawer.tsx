"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Mail } from "lucide-react";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import { ScoreRing, StatusPill } from "@/components/ui/primitives";
import { statusLabel } from "@/lib/sales/constants";
import type { LeadActivity, LeadStatus } from "@/types/database";
import { cn, formatCompanyName, formatRegisteredDate, formatRelativeTime } from "@/lib/utils";
import type { PipelineItem } from "./types";

type Props = {
  item: PipelineItem | null;
  open: boolean;
  isDemo: boolean;
  focusNotes?: boolean;
  onClose: () => void;
  onStatusChange: (orgnr: string, status: LeadStatus) => void;
  onLeadPatch: (
    orgnr: string,
    patch: { notes?: string; next_follow_up_at?: string | null }
  ) => Promise<void>;
  onSendEmail?: () => void;
};

export function LeadDetailDrawer({
  item,
  open,
  isDemo,
  focusNotes = false,
  onClose,
  onStatusChange,
  onLeadPatch,
  onSendEmail,
}: Props) {
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setNotes(item.lead.notes ?? "");
    setFollowUp(item.lead.next_follow_up_at?.slice(0, 10) ?? "");
    setError(null);
  }, [item]);

  useEffect(() => {
    if (!open || !item || isDemo) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    fetch(`/api/leads/${item.lead.orgnr}/activities`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Kunne ikke hente aktivitet"))))
      .then((data) => setActivities(data.activities ?? []))
      .catch(() => setActivities([]))
      .finally(() => setLoadingActivities(false));
  }, [open, item, isDemo]);

  if (!item) return null;

  const { lead, company } = item;

  async function saveDetails() {
    setSaving(true);
    setError(null);
    try {
      await onLeadPatch(lead.orgnr, {
        notes: notes.trim(),
        next_follow_up_at: followUp ? new Date(`${followUp}T09:00:00`).toISOString() : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <div className="border-b border-white/10 p-4 pr-14">
      <div className="flex flex-wrap items-center gap-2">
        <ScoreRing score={lead.score} size="sm" />
        <StatusPill status={lead.status} label={statusLabel(lead.status)} />
      </div>
      <h2
        className="mt-2 truncate text-lg font-semibold text-white"
        title={formatCompanyName(company.name)}
      >
        {formatCompanyName(company.name)}
      </h2>
      <p className="text-xs text-slate-400">Org.nr {company.orgnr}</p>
    </div>
  );

  const footer = (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStatusChange(lead.orgnr, "kontaktet")}
          className="scan-btn-ghost text-xs"
        >
          Marker kontaktet
        </button>
        <Link
          href={`/app?orgnr=${company.orgnr}`}
          className="scan-btn-ghost inline-flex items-center gap-1 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Åpne i Skann
        </Link>
      </div>
      <label className="block text-xs text-slate-500">
        Flytt til
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(lead.orgnr, e.target.value as LeadStatus)}
          className="scan-input mt-1 w-full py-2 text-sm"
        >
          {["ny", "kontaktet", "svarte", "moete_booket", "vunnet", "tapt", "ikke_interessert"].map(
            (s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            )
          )}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void saveDetails()}
        disabled={saving}
        className={cn("btn-primary w-full text-sm", saving && "opacity-60")}
      >
        {saving ? "Lagrer…" : "Lagre notat og oppfølging"}
      </button>
      <p className="text-center text-[10px] text-slate-500">
        Her følger du opp leads du allerede har kontaktet
      </p>
    </div>
  );

  return (
    <AppSideDrawer
      open={open}
      onClose={onClose}
      header={header}
      footer={footer}
      panelClassName="pipeline-drawer"
      maxWidth="md"
    >
      <div className="space-y-5 p-4">
        <section className="space-y-2 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Kontakt
          </h3>
          {company.email ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sky-300">{company.email}</span>
              {onSendEmail && (
                <button
                  type="button"
                  onClick={onSendEmail}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Send e-post
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-500">Ingen e-post</p>
          )}
          {(company.phone || company.mobile) && (
            <a
              href={`tel:${company.mobile ?? company.phone}`}
              className="block text-slate-300 hover:underline"
            >
              {company.mobile ?? company.phone}
            </a>
          )}
          {company.daglig_leder && (
            <p className="text-slate-400">Daglig leder: {company.daglig_leder}</p>
          )}
          {company.website && (
            <a
              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-slate-400 hover:text-sky-300"
            >
              {company.website}
            </a>
          )}
          <p className="text-xs text-slate-500">
            {company.municipality_name ?? "—"}
            {company.registered_at && ` · Reg. ${formatRegisteredDate(company.registered_at)}`}
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notater
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            autoFocus={focusNotes}
            placeholder="Skriv notater om samtalen…"
            className="scan-input w-full text-sm leading-relaxed"
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Oppfølging
          </h3>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="scan-input w-full py-2 text-sm"
          />
          {lead.last_contacted_at && (
            <p className="text-xs text-slate-500">
              Sist kontaktet {formatRelativeTime(lead.last_contacted_at)}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Aktivitet
          </h3>
          {loadingActivities ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Laster…
            </p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-slate-500">
              {isDemo ? "Ingen aktivitet i demo." : "Ingen aktivitet ennå."}
            </p>
          ) : (
            <ul className="space-y-2">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <p className="text-slate-200">{a.description}</p>
                  <p className="mt-0.5 text-slate-500">
                    {formatRelativeTime(a.created_at) ?? formatRegisteredDate(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </AppSideDrawer>
  );
}
