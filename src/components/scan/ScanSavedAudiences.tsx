"use client";

import { useCallback, useEffect, useState } from "react";
import type { FilterState } from "@/components/CompanyFilters";
import {
  agentOrgnrsFromFilters,
  type AgentSavedListFilters,
} from "@/lib/agent/saved-list-filters";
import {
  SAVED_LIST_CHANGED_EVENT,
  type SavedListChangedDetail,
} from "@/lib/agent/saved-list-bus";
import { DEFAULT_MARKET_FILTERS, OSLO_MUNICIPALITY_CODE } from "@/lib/constants/market";
import { parseProfessionIdFromParam } from "@/lib/constants/professions";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type SavedListRow = {
  id: string;
  name: string;
  filters: AgentSavedListFilters;
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
      professionId: "",
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
      professionId: "",
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
      professionId: "rorlegger",
      industryGroup: "",
    },
  },
];

export type SavedAudienceApply = {
  filters: FilterState;
  agentOrgnrs?: string[];
  listId?: string;
  listName?: string;
};

type Props = {
  onApply: (payload: SavedAudienceApply) => void;
  onSaveCurrent: (name: string) => Promise<void>;
  saveMessage: string | null;
};

function resolveProfessionId(
  partial: Partial<FilterState> & { professionSearch?: string }
): string {
  if (partial.professionId) return partial.professionId;
  const legacy = partial.professionSearch?.trim();
  if (legacy) return parseProfessionIdFromParam(legacy);
  return "";
}

function mergeFilters(
  partial: AgentSavedListFilters & { professionSearch?: string }
): FilterState {
  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: partial.days ?? DEFAULT_MARKET_FILTERS.days,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionId: resolveProfessionId(partial),
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
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const reloadSaved = useCallback(async () => {
    if (isDemoMode()) {
      setSaved(
        demo.savedLists.map((l) => ({
          id: l.id,
          name: l.name,
          filters: (l.filters ?? {}) as AgentSavedListFilters,
        }))
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/saved-lists");
      if (!res.ok) {
        setSaved([]);
        return;
      }
      const rows = (await res.json()) as SavedListRow[];
      setSaved(
        rows.map((l) => ({
          id: l.id,
          name: l.name,
          filters: (l.filters ?? {}) as AgentSavedListFilters,
        }))
      );
    } catch {
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [demo.savedLists]);

  useEffect(() => {
    void reloadSaved();
  }, [reloadSaved]);

  useEffect(() => {
    function onListChanged(e: Event) {
      const detail = (e as CustomEvent<SavedListChangedDetail>).detail;
      if (detail?.id) {
        setHighlightId(detail.id);
        window.setTimeout(() => setHighlightId(null), 4000);
      }
      void reloadSaved();
    }
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
    return () =>
      window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
  }, [reloadSaved]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaveCurrent(name.trim());
      setName("");
      await reloadSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="w-full max-w-none">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_AUDIENCES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply({ filters: p.filters })}
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
          saved.map((l) => {
            const agentOrgnrs = agentOrgnrsFromFilters(l.filters);
            const isAgent = l.filters.createdBy === "agent" || agentOrgnrs.length > 0;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  onApply({
                    filters: mergeFilters(l.filters),
                    agentOrgnrs: agentOrgnrs.length ? agentOrgnrs : undefined,
                    listId: l.id,
                    listName: l.name,
                  })
                }
                className={cn(
                  "scan-chip cursor-pointer hover:border-sky-400/40",
                  highlightId === l.id && "border-sky-400/60 bg-sky-400/15",
                  isAgent && "border-violet-400/30"
                )}
                title={
                  agentOrgnrs.length
                    ? `${agentOrgnrs.length} firma fra AI-agent`
                    : undefined
                }
              >
                {l.name}
                {isAgent && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-violet-300">
                    <AgentRobotIcon size={12} />
                    AI
                  </span>
                )}
              </button>
            );
          })}
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
