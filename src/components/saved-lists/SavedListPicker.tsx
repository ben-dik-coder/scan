"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  agentOrgnrsFromFilters,
  shuffledAgentOrgnrsFromFilters,
  isCompanyListFilters,
  type AgentSavedListFilters,
} from "@/lib/agent/saved-list-filters";
import { SAVED_LIST_CHANGED_EVENT } from "@/lib/agent/saved-list-bus";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { Check, ChevronDown, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SavedListRow = {
  id: string;
  name: string;
  filters: AgentSavedListFilters;
};

const SAVED_LIST_LABEL_MAX = 36;

function stripTrailingCountSuffix(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, "").trim() || name;
}

function formatSavedListLabel(name: string, count: number, maxLen = SAVED_LIST_LABEL_MAX) {
  const baseName = stripTrailingCountSuffix(name);
  const full = `${baseName} (${count})`;
  if (full.length <= maxLen) {
    return { display: full, title: full };
  }
  const suffix = ` (${count})`;
  const maxBase = Math.max(1, maxLen - suffix.length - 1);
  const truncated = `${baseName.slice(0, maxBase).trimEnd()}…`;
  return { display: `${truncated}${suffix}`, title: full };
}

type QueueModeProps = {
  mode: "queue";
  onLoad: (orgnrs: string[], listName: string) => Promise<void>;
  loading?: boolean;
};

type FilterModeProps = {
  mode: "filter";
  selectedListId: string | null;
  onSelect: (selection: {
    listId: string | null;
    orgnrs: string[] | null;
    listName: string | null;
  }) => void;
};

type Props = QueueModeProps | FilterModeProps;

export function SavedListPicker(props: Props) {
  const demo = useDemo();
  const [saved, setSaved] = useState<SavedListRow[]>([]);
  const [fetching, setFetching] = useState(!isDemoMode());
  const [open, setOpen] = useState(false);

  const companyLists = useMemo(
    () => saved.filter((l) => isCompanyListFilters(l.filters)),
    [saved]
  );

  const reloadSaved = useCallback(async () => {
    if (isDemoMode()) {
      setSaved(
        demo.savedLists.map((l) => ({
          id: l.id,
          name: l.name,
          filters: (l.filters ?? {}) as AgentSavedListFilters,
        }))
      );
      setFetching(false);
      return;
    }
    setFetching(true);
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
      setFetching(false);
    }
  }, [demo.savedLists]);

  useEffect(() => {
    void reloadSaved();
  }, [reloadSaved]);

  useEffect(() => {
    function onListChanged() {
      void reloadSaved();
    }
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
    return () => window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
  }, [reloadSaved]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isQueue = props.mode === "queue";
  const loading = isQueue ? (props.loading ?? false) : false;
  const selectedListId = !isQueue ? props.selectedListId : null;

  const selectedList = useMemo(
    () => (selectedListId ? companyLists.find((l) => l.id === selectedListId) : null),
    [companyLists, selectedListId]
  );

  const buttonLabel = useMemo(() => {
    if (isQueue) {
      return loading ? "Legger i kø…" : "Velg liste";
    }
    if (!selectedList) return "Alle";
    const count = agentOrgnrsFromFilters(selectedList.filters).length;
    return formatSavedListLabel(selectedList.name, count).display;
  }, [isQueue, loading, selectedList]);

  async function handleSelectList(listId: string) {
    if (loading) return;
    const list = companyLists.find((l) => l.id === listId);
    if (!list) return;
    const orgnrs = shuffledAgentOrgnrsFromFilters(list.filters);
    if (orgnrs.length === 0) return;
    setOpen(false);

    if (isQueue) {
      await props.onLoad(orgnrs, list.name);
    } else {
      props.onSelect({ listId, orgnrs, listName: list.name });
    }
  }

  function handleSelectAll() {
    if (loading || isQueue) return;
    setOpen(false);
    props.onSelect({ listId: null, orgnrs: null, listName: null });
  }

  if (fetching) {
    return (
      <span className="scan-glass-muted inline-flex min-h-[36px] items-center gap-1.5 px-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Laster lister…
      </span>
    );
  }

  if (isQueue && companyLists.length === 0) {
    return null;
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={isQueue ? "Velg lagret firmaliste" : "Filtrer pipeline på lagret liste"}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={loading}
        onClick={() => !loading && setOpen((v) => !v)}
        className={cn(
          "scan-btn-ghost inline-flex min-h-[36px] min-w-[180px] max-w-[220px] items-center gap-1.5 px-3 py-2 text-xs font-semibold sm:min-w-[220px]",
          loading && "opacity-50"
        )}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{buttonLabel}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 opacity-50 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && !loading && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Lukk"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="ko-filter-dropdown absolute left-0 top-full z-40 mt-2 w-[min(100vw-2rem,280px)] rounded-xl border border-white/10 p-1.5 shadow-xl backdrop-blur-md"
          >
            {!isQueue && (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedListId === null}
                onClick={handleSelectAll}
                className={cn(
                  "flex w-full min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                  selectedListId === null
                    ? "bg-white/10 text-white"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                )}
              >
                <span>Alle</span>
                {selectedListId === null && (
                  <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                )}
              </button>
            )}
            {!isQueue && companyLists.length > 0 && (
              <div className="my-1 border-t border-white/10" role="separator" />
            )}
            {companyLists.map((l) => {
              const count = agentOrgnrsFromFilters(l.filters).length;
              const { display, title } = formatSavedListLabel(l.name, count);
              const isSelected = !isQueue && selectedListId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  title={title}
                  onClick={() => void handleSelectList(l.id)}
                  className={cn(
                    "flex w-full min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                    isSelected
                      ? "bg-white/10 text-white"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="min-w-0 truncate">{display}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
