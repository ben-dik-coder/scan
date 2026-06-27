"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  shuffledAgentOrgnrsFromFilters,
  isCompanyListFilters,
  type AgentSavedListFilters,
} from "@/lib/agent/saved-list-filters";
import {
  resolveListOrgnrs,
  savedListCountHint,
} from "@/lib/saved-lists/resolve-list-orgnrs";
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

type DialModeProps = {
  mode: "ring" | "sms";
  selectedListId: string | null;
  onSelect: (selection: {
    listId: string | null;
    orgnrs: string[] | null;
    listName: string | null;
  }) => void;
  resolving?: boolean;
};

type Props = QueueModeProps | FilterModeProps | DialModeProps;

export function SavedListPicker(props: Props) {
  const demo = useDemo();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState<SavedListRow[]>([]);
  const [fetching, setFetching] = useState(!isDemoMode());
  const [open, setOpen] = useState(false);
  const [resolvingList, setResolvingList] = useState(false);
  const [listCounts, setListCounts] = useState<Map<string, number>>(new Map());
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

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

  const isDialMode = props.mode === "ring" || props.mode === "sms";

  useEffect(() => {
    if (!isDialMode || saved.length === 0) {
      setListCounts(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      const counts = new Map<string, number>();
      await Promise.all(
        saved.map(async (list) => {
          const hint = savedListCountHint(list.filters);
          if (hint !== null) {
            counts.set(list.id, hint);
            return;
          }
          const resolved = await resolveListOrgnrs(list.id, { demoLists: demo.savedLists });
          if (resolved) counts.set(list.id, resolved.orgnrs.length);
        })
      );
      if (!cancelled) setListCounts(counts);
    })();

    return () => {
      cancelled = true;
    };
  }, [isDialMode, saved, demo.savedLists]);

  useEffect(() => {
    function onListChanged() {
      void reloadSaved();
    }
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
    return () => window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
  }, [reloadSaved]);

  const updateMenuPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.min(Math.max(rect.width, 220), 280),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || !isDialMode) {
      if (!open) setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, isDialMode, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isQueue = props.mode === "queue";
  const loading = isQueue
    ? (props.loading ?? false)
    : isDialMode
      ? (props.resolving ?? false) || resolvingList
      : false;
  const selectedListId = isQueue ? null : props.selectedListId;

  const pickerLists = isDialMode ? saved : companyLists;

  const selectedList = useMemo(
    () => (selectedListId ? pickerLists.find((l) => l.id === selectedListId) : null),
    [pickerLists, selectedListId]
  );

  const countForListCb = useCallback(
    (list: SavedListRow): number => {
      const hint = savedListCountHint(list.filters);
      if (hint !== null) return hint;
      return listCounts.get(list.id) ?? 0;
    },
    [listCounts]
  );

  const buttonLabel = useMemo(() => {
    if (isQueue) {
      return loading ? "Legger i kø…" : "Velg liste";
    }
    if (loading) return "Laster liste…";
    if (!selectedList) return isDialMode ? "Alle i køen" : "Alle";
    const count = countForListCb(selectedList);
    return formatSavedListLabel(selectedList.name, count).display;
  }, [isQueue, isDialMode, loading, selectedList, countForListCb]);

  async function handleSelectList(listId: string) {
    if (loading) return;
    const list = pickerLists.find((l) => l.id === listId);
    if (!list) return;
    setOpen(false);

    if (isQueue) {
      const orgnrs = shuffledAgentOrgnrsFromFilters(list.filters);
      if (orgnrs.length === 0) return;
      await props.onLoad(orgnrs, list.name);
      return;
    }

    if (isDialMode) {
      setResolvingList(true);
      try {
        const resolved = await resolveListOrgnrs(listId, { demoLists: demo.savedLists });
        if (!resolved) return;
        props.onSelect({
          listId,
          orgnrs: resolved.orgnrs,
          listName: resolved.name,
        });
      } finally {
        setResolvingList(false);
      }
      return;
    }

    const orgnrs = shuffledAgentOrgnrsFromFilters(list.filters);
    if (orgnrs.length === 0) return;
    props.onSelect({ listId, orgnrs, listName: list.name });
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

  const menuItems = (
    <>
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
          <span>{isDialMode ? "Alle i køen" : "Alle"}</span>
          {selectedListId === null && (
            <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
          )}
        </button>
      )}
      {!isQueue && pickerLists.length > 0 && (
        <div className="my-1 border-t border-white/10" role="separator" />
      )}
      {pickerLists.map((l) => {
        const count = countForListCb(l);
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
            {isSelected && <Check className="h-4 w-4 shrink-0 text-white/70" aria-hidden />}
          </button>
        );
      })}
      {isDialMode && pickerLists.length === 0 && (
        <p className="px-3 py-2 text-xs text-slate-400">
          Ingen lagrede lister ennå. Lag en fra Skann eller Smartliste.
        </p>
      )}
    </>
  );

  const dialDropdown =
    isDialMode &&
    menuPos &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[100] cursor-default"
          aria-label="Lukk"
          onClick={() => setOpen(false)}
        />
        <div
          role="menu"
          className="fixed z-[110] max-h-[min(60dvh,420px)] overflow-y-auto rounded-xl border border-white/10 bg-[#2c2c2e] p-1.5 shadow-2xl"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          {menuItems}
        </div>
      </>,
      document.body
    );

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          isQueue
            ? "Velg lagret firmaliste"
            : props.mode === "ring"
              ? "Velg liste å ringe fra"
              : props.mode === "sms"
                ? "Velg liste å sende SMS fra"
                : "Filtrer pipeline på lagret liste"
        }
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
      {open && !loading && !isDialMode && (
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
            {menuItems}
          </div>
        </>
      )}
      {open && !loading && dialDropdown}
    </div>
  );
}
