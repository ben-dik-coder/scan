"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  agentOrgnrsFromFilters,
  filtersForAgentListApplication,
  isAgentSavedListFilters,
  isCompanyListFilters,
  listGroupFromFilters,
  shuffledAgentOrgnrsFromFilters,
  type AgentSavedListFilters,
} from "@/lib/agent/saved-list-filters";
import {
  notifySavedListChanged,
  SAVED_LIST_CHANGED_EVENT,
} from "@/lib/agent/saved-list-bus";
import { AGENT_LIST_PERIOD_DAYS } from "@/lib/agent/saved-list-filters";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import type { SavedAudienceApply } from "@/components/scan/ScanSavedAudiences";
import { cn } from "@/lib/utils";
import { Check, FolderOpen, LayoutGrid, Loader2, Plus, Trash2, X } from "lucide-react";

/** Firmaliste man kan legge firma i — inkl. tomme brukerlister. */
function isAddableCompanyList(
  filters: AgentSavedListFilters | Record<string, unknown> | null | undefined
): boolean {
  if (isCompanyListFilters(filters)) return true;
  return Boolean(filters && (filters as AgentSavedListFilters).createdBy === "user");
}

type SavedListRow = {
  id: string;
  name: string;
  filters: AgentSavedListFilters;
};

type Props = {
  onApply: (payload: SavedAudienceApply) => void;
  selectedOrgnrs?: string[];
  onAdded?: (message: string) => void;
  /** Kun legg-til-skjema, uten listeoversikt */
  addOnly?: boolean;
};

function buildUserListFilters(orgnrs: string[], group?: string): AgentSavedListFilters {
  return {
    agentOrgnrs: orgnrs,
    createdBy: "user",
    days: AGENT_LIST_PERIOD_DAYS,
    websitePresence: "all",
    group: group?.trim() || undefined,
  };
}

export function ScanCompanyLists({
  onApply,
  selectedOrgnrs = [],
  onAdded,
  addOnly = false,
}: Props) {
  const demo = useDemo();
  const [saved, setSaved] = useState<SavedListRow[]>([]);
  const [loading, setLoading] = useState(!isDemoMode());
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [creating, setCreating] = useState(false);
  const [addTargetId, setAddTargetId] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const companyLists = useMemo(
    () => saved.filter((l) => isAddableCompanyList(l.filters)),
    [saved]
  );

  const groupedLists = useMemo(() => {
    const groups = new Map<string, SavedListRow[]>();
    for (const list of companyLists) {
      const group = listGroupFromFilters(list.filters) || "Mine lister";
      const bucket = groups.get(group) ?? [];
      bucket.push(list);
      groups.set(group, bucket);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "nb"));
  }, [companyLists]);

  const reloadSaved = useCallback(async (opts?: { silent?: boolean }) => {
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
    if (!opts?.silent) setLoading(true);
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
    function onListChanged() {
      void reloadSaved({ silent: true });
    }
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
    return () => window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
  }, [reloadSaved]);

  function showMessage(text: string, opts?: { notifyParent?: boolean }) {
    setMessage(text);
    if (opts?.notifyParent !== false) onAdded?.(text);
    window.setTimeout(() => setMessage(null), 3000);
  }

  async function createList(orgnrs: string[]) {
    if (!newName.trim() || orgnrs.length === 0) return;
    setCreating(true);
    try {
      const filters = buildUserListFilters(orgnrs, newGroup);
      if (isDemoMode()) {
        demo.saveListDemo(newName.trim(), filters);
        notifySavedListChanged({
          id: `list-${Date.now()}`,
          name: newName.trim(),
          orgnrCount: orgnrs.length,
        });
      } else {
        const res = await fetch("/api/saved-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim(), filters }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Kunne ikke opprette liste");
        }
        const row = (await res.json()) as SavedListRow;
        notifySavedListChanged({
          id: row.id,
          name: row.name,
          orgnrCount: orgnrs.length,
        });
      }
      const createdName = newName.trim();
      setNewName("");
      setNewGroup("");
      showMessage(`Liste «${createdName}» opprettet med ${orgnrs.length} firma`);
      await reloadSaved({ silent: true });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Noe gikk galt", {
        notifyParent: false,
      });
    } finally {
      setCreating(false);
    }
  }

  async function addToExistingList(listId: string, orgnrs: string[]) {
    if (!listId || orgnrs.length === 0 || adding) return;
    const target = companyLists.find((l) => l.id === listId);
    setAdding(true);
    setAddTargetId(listId);
    try {
      if (isDemoMode()) {
        const demoTarget = demo.savedLists.find((l) => l.id === listId);
        if (!demoTarget) throw new Error("Listen finnes ikke");
        const merged = Array.from(
          new Set([...agentOrgnrsFromFilters(demoTarget.filters), ...orgnrs])
        );
        const nextFilters = {
          ...(demoTarget.filters ?? {}),
          ...buildUserListFilters(merged, listGroupFromFilters(demoTarget.filters)),
        };
        demo.updateSavedListDemo(listId, nextFilters);
        notifySavedListChanged({
          id: listId,
          name: demoTarget.name,
          orgnrCount: merged.length,
        });
        showMessage(`La til ${orgnrs.length} i «${demoTarget.name}»`);
      } else {
        const res = await fetch(`/api/saved-lists/${encodeURIComponent(listId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addOrgnrs: orgnrs }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Kunne ikke oppdatere liste"
          );
        }
        const row = (await res.json()) as SavedListRow;
        notifySavedListChanged({
          id: row.id,
          name: row.name,
          orgnrCount: agentOrgnrsFromFilters(row.filters).length,
        });
        showMessage(`La til ${orgnrs.length} i «${row.name || target?.name || "listen"}»`);
      }
      setAddTargetId("");
      await reloadSaved({ silent: true });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Noe gikk galt", {
        notifyParent: false,
      });
      setAddTargetId("");
    } finally {
      setAdding(false);
    }
  }

  async function deleteList(list: SavedListRow) {
    setConfirmDeleteId(null);
    setDeletingId(list.id);
    try {
      if (isDemoMode()) {
        demo.deleteSavedListDemo(list.id);
        setSaved((prev) => prev.filter((l) => l.id !== list.id));
      } else {
        const res = await fetch(`/api/saved-lists/${encodeURIComponent(list.id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Kunne ikke slette");
        }
        await reloadSaved();
      }
      if (!isDemoMode()) {
        notifySavedListChanged({ id: list.id, name: list.name, orgnrCount: 0 });
      }
      showMessage(`Listen «${list.name}» er slettet`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Noe gikk galt", {
        notifyParent: false,
      });
    } finally {
      setDeletingId(null);
    }
  }

  function openList(list: SavedListRow) {
    const orgnrs = shuffledAgentOrgnrsFromFilters(list.filters);
    onApply({
      filters: filtersForAgentListApplication(list.filters, {
        regionId: "",
        municipalityCode: "",
        days: AGENT_LIST_PERIOD_DAYS,
        hasEmail: false,
        hasPhone: false,
        genericEmailOnly: false,
        industryGroup: "",
        professionId: "",
        naceCode: "",
        nameQuery: "",
        websitePresence: "all",
        facebookPresence: "all",
        instagramPresence: "all",
      }),
      agentOrgnrs: orgnrs.length ? orgnrs : undefined,
      listId: list.id,
      listName: list.name,
      listSource: isAgentSavedListFilters(list.filters) ? "agent" : "user",
    });
  }

  const hasSelection = selectedOrgnrs.length > 0;

  return (
    <section className="w-full max-w-none space-y-4">
      {hasSelection && (
        <div
          className={cn(
            "rounded-xl border border-white/10 p-3",
            !addOnly && "scan-glass-muted"
          )}
        >
          {!addOnly && (
            <p className="text-xs font-semibold text-white">
              {selectedOrgnrs.length} valgte firma
            </p>
          )}

          <div className={cn(!addOnly && "mt-2")}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Legg i eksisterende
            </p>
            {loading && companyLists.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Laster lister…
              </span>
            ) : companyLists.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Ingen lister ennå — lag en ny under.
              </p>
            ) : (
              <ul className="max-h-[min(40vh,220px)] space-y-1 overflow-y-auto overscroll-contain">
                {companyLists.map((l) => {
                  const count = agentOrgnrsFromFilters(l.filters).length;
                  const busy = adding && addTargetId === l.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={adding}
                        onClick={() => void addToExistingList(l.id, selectedOrgnrs)}
                        className={cn(
                          "flex w-full min-h-[40px] items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition",
                          busy
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "text-white hover:bg-white/10",
                          adding && !busy && "opacity-40"
                        )}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {l.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-500">
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Eller lag ny
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && !creating) {
                  e.preventDefault();
                  void createList(selectedOrgnrs);
                }
              }}
              placeholder="Navn på listen"
              className="scan-input w-full"
              autoComplete="off"
            />
            {!addOnly && (
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="Gruppe (valgfritt)"
                className="scan-input w-full"
                autoComplete="off"
              />
            )}
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void createList(selectedOrgnrs)}
              className={cn(
                "scan-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs",
                (creating || !newName.trim()) && "opacity-50"
              )}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? "Oppretter…" : `Opprett med ${selectedOrgnrs.length} firma`}
            </button>
          </div>
        </div>
      )}

      {!addOnly && (
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/80">
          <FolderOpen className="h-3.5 w-3.5" />
          Mine firmalister
        </div>
        {loading && (
          <span className="scan-glass-muted inline-flex items-center gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Laster…
          </span>
        )}
        {!loading && companyLists.length === 0 && (
          <p className="scan-glass-muted text-xs">
            Du har ingen firmalister ennå. Velg firma i tabellen og lag din første liste.
          </p>
        )}
        {!loading &&
          groupedLists.map(([group, lists]) => (
            <div key={group} className="mb-3">
              {groupedLists.length > 1 && (
                <p className="scan-glass-muted mb-1 text-[11px] font-medium uppercase tracking-wide">
                  {group}
                </p>
              )}
              <div className="space-y-1">
                {lists.map((list) => {
                  const orgnrs = agentOrgnrsFromFilters(list.filters);
                  const isAgent = isAgentSavedListFilters(list.filters);
                  const confirming = confirmDeleteId === list.id;
                  const deleting = deletingId === list.id;
                  return (
                    <div
                      key={list.id}
                      className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 pr-1"
                    >
                      {confirming ? (
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-xs text-white">
                          <span>
                            Slette «{list.name}»?
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteList(list);
                              }}
                              disabled={deleting}
                              className="rounded-lg bg-red-500/20 px-2 py-1 font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-40"
                            >
                              {deleting ? "Sletter…" : "Ja, slett"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              disabled={deleting}
                              className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                            >
                              Avbryt
                            </button>
                          </span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openList(list)}
                            className="min-w-0 flex-1 px-3 py-2 text-left text-xs text-white hover:bg-white/5"
                          >
                            <span className="font-medium">{list.name}</span>
                            <span className="scan-glass-muted ml-2 tabular-nums">
                              {orgnrs.length} firma
                            </span>
                            {isAgent && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-violet-300">
                                <AgentRobotIcon size={12} />
                                AI
                              </span>
                            )}
                          </button>
                          <Link
                            href={`/app/smartliste?list=${list.id}`}
                            className="relative z-10 shrink-0 rounded-lg p-2 text-white/50 hover:bg-brand-gold/15 hover:text-amber-200"
                            aria-label={`Åpne ${list.name} i Smartliste`}
                            title="Åpne i Smartliste"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(list.id);
                            }}
                            disabled={deletingId !== null}
                            className="relative z-10 shrink-0 rounded-lg p-2 text-white/50 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
                            aria-label={`Slett ${list.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
      )}

      {message && (
        <p className="text-xs text-emerald-300" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

type AddToListMenuProps = {
  selectedOrgnrs: string[];
  onAdded?: (message: string) => void;
  onApply: (payload: SavedAudienceApply) => void;
};

export function AddToListMenu({ selectedOrgnrs, onAdded, onApply }: AddToListMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    bottom: number;
    left: number;
    width: number;
  } | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const updateMenuPos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(320, Math.max(260, window.innerWidth - 24));
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setMenuPos({
      bottom: window.innerHeight - rect.top + 10,
      left,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
    const onResize = () => updateMenuPos();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (selectedOrgnrs.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) updateMenuPos();
          setOpen((v) => !v);
        }}
        className={cn(
          "scan-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold",
          justAdded && "border-emerald-400/40 text-emerald-300"
        )}
      >
        {justAdded ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5" />
        )}
        {justAdded ? "Lagt i liste" : "Liste"}
      </button>

      {open &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Legg i liste"
            className="fixed z-[120] rounded-xl border border-white/10 bg-[#1c1c1e] p-3 shadow-2xl"
            style={{
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-white">Legg i liste</p>
                <p className="text-[11px] text-zinc-500">
                  {selectedOrgnrs.length} valgt
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"
                aria-label="Lukk"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ScanCompanyLists
              addOnly
              selectedOrgnrs={selectedOrgnrs}
              onApply={onApply}
              onAdded={(text) => {
                onAdded?.(text);
                setJustAdded(true);
                setOpen(false);
                window.setTimeout(() => setJustAdded(false), 2500);
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
