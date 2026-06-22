"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { FolderOpen, Loader2, Plus, Trash2, X } from "lucide-react";

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
    () => saved.filter((l) => isCompanyListFilters(l.filters)),
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
    function onListChanged() {
      void reloadSaved();
    }
    window.addEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
    return () => window.removeEventListener(SAVED_LIST_CHANGED_EVENT, onListChanged);
  }, [reloadSaved]);

  function showMessage(text: string) {
    setMessage(text);
    onAdded?.(text);
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
      setNewName("");
      setNewGroup("");
      showMessage(`Liste «${newName.trim()}» opprettet med ${orgnrs.length} firma`);
      await reloadSaved();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setCreating(false);
    }
  }

  async function addToExistingList(listId: string, orgnrs: string[]) {
    if (!listId || orgnrs.length === 0) return;
    setAdding(true);
    try {
      if (isDemoMode()) {
        const target = demo.savedLists.find((l) => l.id === listId);
        if (!target) throw new Error("Listen finnes ikke");
        const merged = Array.from(
          new Set([...agentOrgnrsFromFilters(target.filters), ...orgnrs])
        );
        const nextFilters = {
          ...(target.filters ?? {}),
          ...buildUserListFilters(merged, listGroupFromFilters(target.filters)),
        };
        demo.updateSavedListDemo(listId, nextFilters);
        notifySavedListChanged({ id: listId, name: target.name, orgnrCount: merged.length });
      } else {
        const res = await fetch(`/api/saved-lists/${encodeURIComponent(listId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addOrgnrs: orgnrs }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Kunne ikke oppdatere liste");
        }
        const row = (await res.json()) as SavedListRow;
        notifySavedListChanged({
          id: row.id,
          name: row.name,
          orgnrCount: agentOrgnrsFromFilters(row.filters).length,
        });
      }
      setAddTargetId("");
      showMessage(`La til ${orgnrs.length} firma i listen`);
      await reloadSaved();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Noe gikk galt");
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
      showMessage(err instanceof Error ? err.message : "Noe gikk galt");
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
        <div className="scan-glass-muted rounded-xl border border-white/10 p-3">
          <p className="text-xs font-semibold text-white">
            {selectedOrgnrs.length} valgte firma
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              value={addTargetId}
              onChange={(e) => setAddTargetId(e.target.value)}
              className="scan-input flex-1"
            >
              <option value="">Velg eksisterende liste…</option>
              {companyLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({agentOrgnrsFromFilters(l.filters).length})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addTargetId || adding}
              onClick={() => void addToExistingList(addTargetId, selectedOrgnrs)}
              className={cn(
                "scan-btn-primary shrink-0 px-4 py-2.5 text-xs",
                (!addTargetId || adding) && "opacity-50"
              )}
            >
              {adding ? "Legger til…" : "Legg i liste"}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Eller lag ny liste…"
              className="scan-input flex-1"
            />
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="Gruppe (valgfritt)"
              className="scan-input sm:max-w-[160px]"
            />
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void createList(selectedOrgnrs)}
              className={cn(
                "scan-btn-ghost inline-flex shrink-0 items-center gap-1 px-4 py-2.5 text-xs",
                (creating || !newName.trim()) && "opacity-50"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? "Oppretter…" : "Ny liste"}
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
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedOrgnrs.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="scan-btn-ghost min-h-[36px] px-3 text-xs font-semibold"
      >
        <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
        Liste
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Lukk"
            onClick={() => setOpen(false)}
          />
          <div className="scan-glass-dropdown absolute bottom-full right-0 z-40 mb-2 w-[min(100vw-2rem,320px)] rounded-xl border border-white/10 p-3 shadow-xl backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Legg i liste</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-white/50 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ScanCompanyLists
              addOnly
              selectedOrgnrs={selectedOrgnrs}
              onApply={onApply}
              onAdded={(text) => {
                setMessage(text);
                onAdded?.(text);
                setOpen(false);
                window.setTimeout(() => setMessage(null), 3000);
              }}
            />
          </div>
        </>
      )}
      {message && (
        <span className="absolute bottom-full right-0 mb-14 hidden text-[10px] text-emerald-300 sm:inline">
          {message}
        </span>
      )}
    </div>
  );
}
