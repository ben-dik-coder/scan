"use client";

import { useEffect, useState } from "react";
import type { FilterState } from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS, OSLO_MUNICIPALITY_CODE } from "@/lib/constants/market";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Bookmark, Loader2 } from "lucide-react";

type SavedListRow = {
  id: string;
  name: string;
  filters: Partial<FilterState>;
};

const PRESET_AUDIENCES: { id: string; name: string; filters: FilterState }[] = [
  {
    id: "preset-oslo-30",
    name: "Nye firma · Oslo · 30 d",
    filters: {
      ...DEFAULT_MARKET_FILTERS,
      regionId: "oslo",
      municipalityCode: OSLO_MUNICIPALITY_CODE,
      days: 30,
      industryGroup: "",
      professionSearch: "",
    },
  },
  {
    id: "preset-rogaland-30",
    name: "Nye firma · Rogaland · 30 d",
    filters: {
      ...DEFAULT_MARKET_FILTERS,
      regionId: "rogaland",
      municipalityCode: "",
      days: 30,
      industryGroup: "",
      professionSearch: "",
    },
  },
  {
    id: "preset-rorlegger-oslo",
    name: "Rørleggere · Oslo · 30 d",
    filters: {
      ...DEFAULT_MARKET_FILTERS,
      regionId: "oslo",
      municipalityCode: OSLO_MUNICIPALITY_CODE,
      days: 30,
      professionSearch: "rørlegger",
      industryGroup: "",
    },
  },
];

type Props = {
  onApply: (filters: FilterState) => void;
  onSaveCurrent: (name: string) => Promise<void>;
  saveMessage: string | null;
};

function mergeFilters(partial: Partial<FilterState>): FilterState {
  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: partial.days ?? DEFAULT_MARKET_FILTERS.days,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionSearch: partial.professionSearch ?? "",
    websitePresence: partial.websitePresence ?? "all",
    facebookPresence: partial.facebookPresence ?? "all",
    instagramPresence: partial.instagramPresence ?? "all",
  };
}

export function ScanSavedAudiences({ onApply, onSaveCurrent, saveMessage }: Props) {
  const demo = useDemo();
  const [saved, setSaved] = useState<SavedListRow[]>([]);
  const [loading, setLoading] = useState(!isDemoMode());
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      setSaved(
        demo.savedLists.map((l) => ({
          id: l.id,
          name: l.name,
          filters: (l.filters ?? {}) as Partial<FilterState>,
        }))
      );
      setLoading(false);
      return;
    }
    fetch("/api/saved-lists")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setSaved(
          (rows as SavedListRow[]).map((l) => ({
            id: l.id,
            name: l.name,
            filters: (l.filters ?? {}) as Partial<FilterState>,
          }))
        );
      })
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when demo lists change
  }, [demo.savedLists.length]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaveCurrent(name.trim());
      setName("");
      if (!isDemoMode()) {
        const res = await fetch("/api/saved-lists");
        if (res.ok) {
          const rows = await res.json();
          setSaved(
            (rows as SavedListRow[]).map((l) => ({
              id: l.id,
              name: l.name,
              filters: (l.filters ?? {}) as Partial<FilterState>,
            }))
          );
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="scan-surface-pad w-full max-w-none">
      <p className="scan-glass-muted mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
        Mine målgrupper
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_AUDIENCES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(p.filters)}
            className="scan-chip cursor-pointer hover:border-sky-400/40"
          >
            {p.name}
          </button>
        ))}
        {loading && (
          <span className="scan-glass-muted inline-flex items-center gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Laster…
          </span>
        )}
        {!loading &&
          saved.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onApply(mergeFilters(l.filters))}
              className="scan-chip cursor-pointer hover:border-sky-400/40"
            >
              {l.name}
            </button>
          ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lagre nåværende filter som…"
          className="scan-input flex-1"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className={cn(
            "scan-btn-primary shrink-0 px-4 py-2.5",
            (saving || !name.trim()) && "opacity-50"
          )}
        >
          {saving ? "Lagrer…" : "Lagre målgruppe"}
        </button>
      </div>
      {saveMessage && (
        <p className="mt-2 text-xs text-emerald-300" role="status">
          {saveMessage}
        </p>
      )}
    </section>
  );
}
