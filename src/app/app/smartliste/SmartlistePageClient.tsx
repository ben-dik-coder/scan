"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext } from "@dnd-kit/core";
import { SmartlisteBatchBar } from "@/components/smartliste/SmartlisteBatchBar";
import { SmartlisteCard } from "@/components/smartliste/SmartlisteCard";
import { SmartlisteDetailPanel } from "@/components/smartliste/SmartlisteDetailPanel";
import { SmartlisteDotBoard } from "@/components/smartliste/SmartlisteDotBoard";
import {
  SmartlisteInsights,
  SmartlisteRankedView,
} from "@/components/smartliste/SmartlisteRankedView";
import { useSmartList } from "@/lib/smartliste/use-smart-list";
import type { SmartListCard, SmartListViewMode } from "@/lib/smartliste/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Grid3X3,
  LayoutGrid,
  List,
  Loader2,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export function SmartlistePageClient({ initialListId }: { initialListId?: string | null }) {
  const router = useRouter();
  const {
    lists,
    board,
    listId,
    setListId,
    loadingLists,
    loadingBoard,
    ranking,
    syncing,
    error,
    setError,
    loadBoard,
    createList,
    deleteList,
    patchItems,
    rankList,
    summarizeItems,
    updateBoardConfig,
    createLabel,
    setViewMode,
  } = useSmartList(initialListId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCard, setDetailCard] = useState<SmartListCard | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const viewMode: SmartListViewMode = board?.list.board_config.defaultView ?? "board";
  const zoom = board?.list.board_config.zoom ?? 100;
  const cardSize = board?.list.board_config.cardSize ?? "comfortable";
  const showLeft = board?.list.board_config.leftPanelOpen !== false;
  const showRight = board?.list.board_config.rightPanelOpen !== false;

  const selectedCards = useMemo(
    () => board?.items.filter((i) => selectedIds.has(i.id)) ?? [],
    [board?.items, selectedIds]
  );

  useEffect(() => {
    if (!detailCard || !board) return;
    const updated = board.items.find((i) => i.id === detailCard.id);
    if (updated) setDetailCard(updated);
  }, [board, detailCard]);

  function flash(msg: string) {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 2200);
  }

  const handleSelect = useCallback((card: SmartListCard, additive: boolean) => {
    setDetailCard(card);
    setSelectedIds((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (additive && prev.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  }, []);

  const handleMoveItems = useCallback(
    (itemIds: string[], laneId: string, sortBase: number) => {
      const patches = itemIds.map((id, index) => ({
        id,
        lane_id: laneId,
        sort_order: sortBase + index,
      }));
      void patchItems(patches);
    },
    [patchItems]
  );

  async function handleSummarizeItems(itemIds: string[]) {
    if (itemIds.length === 0) return;
    setSummarizing(true);
    const count = await summarizeItems(itemIds);
    setSummarizing(false);
    if (count > 0) flash(`Ferdig analysert ${count} firma (med research)`);
  }

  async function handleCreateList() {
    if (!newListName.trim()) return;
    setCreating(true);
    const id = await createList(newListName.trim());
    setCreating(false);
    if (id) {
      setNewListName("");
      flash("Liste opprettet");
    }
  }

  async function exportToQueue() {
    for (const card of selectedCards) {
      await fetch("/api/leads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgnr: card.orgnr, status: "ny", queue: true }),
      });
    }
    flash(`${selectedCards.length} lagt i arbeidskø`);
    setSelectedIds(new Set());
  }

  async function exportToPipeline() {
    for (const card of selectedCards) {
      await fetch("/api/leads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgnr: card.orgnr, status: "kontaktet" }),
      });
    }
    flash(`${selectedCards.length} sendt til pipeline`);
    setSelectedIds(new Set());
  }

  async function exportToRing() {
    await exportToQueue();
    router.push("/app/ring");
  }

  async function handleRemoveSelected() {
    if (!listId || selectedCards.length === 0) return;
    if (!window.confirm(`Fjerne ${selectedCards.length} fra listen?`)) return;
    const res = await fetch(`/api/smartliste/${listId}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: selectedCards.map((c) => c.id) }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      setDetailCard(null);
      if (listId) await loadBoard(listId);
      flash("Fjernet fra liste");
    }
  }

  return (
    <div className="smartliste-page">
      <header className="smartliste-topbar">
        <Link href="/app/oversikt" className="smartliste-link smartliste-btn smartliste-btn-icon">
          <ArrowLeft className="h-4 w-4" />
          <span>Tilbake</span>
        </Link>

        <LayoutGrid className="h-5 w-5" style={{ color: "#fbbf24" }} />
        <h1>Smartliste</h1>

        {board && <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>{board.list.name}</span>}

        <div style={{ marginLeft: "auto", flex: 1, maxWidth: "20rem", position: "relative" }}>
          <Search
            className="h-4 w-4"
            style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk i listen…"
            className="smartliste-input"
            style={{ paddingLeft: "2rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          {(["board", "ranked", "grid"] as SmartListViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn("smartliste-btn smartliste-btn-icon", viewMode === mode && "smartliste-btn-primary")}
              title={mode === "board" ? "Tavle" : mode === "ranked" ? "Rangert" : "Rutenett"}
            >
              {mode === "board" ? (
                <LayoutGrid className="h-4 w-4" />
              ) : mode === "ranked" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid3X3 className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void rankList()}
          disabled={ranking || !listId}
          className="smartliste-btn smartliste-btn-primary"
        >
          {ranking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI-ranger
        </button>

        <button type="button" onClick={() => updateBoardConfig({ leftPanelOpen: !showLeft })} className="smartliste-btn smartliste-btn-icon" title="Venstre panel">
          <PanelLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => updateBoardConfig({ rightPanelOpen: !showRight })} className="smartliste-btn smartliste-btn-icon" title="Høyre panel">
          <PanelRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => updateBoardConfig({ zoom: Math.max(75, zoom - 10) })} className="smartliste-btn smartliste-btn-icon">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{zoom}%</span>
        <button type="button" onClick={() => updateBoardConfig({ zoom: Math.min(125, zoom + 10) })} className="smartliste-btn smartliste-btn-icon">
          <ZoomIn className="h-4 w-4" />
        </button>

        {syncing && (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Lagrer…
          </span>
        )}
        {!syncing && board && (
          <span style={{ fontSize: "0.75rem", color: "#34d399", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <Check className="h-3 w-3" />
            Lagret
          </span>
        )}
      </header>

      {(error || message) && (
        <div
          className={cn(
            "px-4 py-2 text-center text-sm",
            error ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"
          )}
        >
          {error ?? message}
          {error && (
            <button type="button" onClick={() => setError(null)} className="ml-2 underline">
              Lukk
            </button>
          )}
        </div>
      )}

      <div className="smartliste-body">
        {showLeft && (
          <aside className="smartliste-sidebar">
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem" }}>
              <p className="smartliste-section-label">Dine lister</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCreateList()}
                  placeholder="Ny liste…"
                  className="smartliste-input"
                />
                <button type="button" onClick={() => void handleCreateList()} disabled={creating} className="smartliste-btn smartliste-btn-primary smartliste-btn-icon">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "0.5rem" }}>
              {loadingLists ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#64748b" }} />
                </div>
              ) : lists.length === 0 ? (
                <p style={{ padding: "1rem 0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                  Opprett din første smartliste over.
                </p>
              ) : (
                lists.map((list) => (
                  <div key={list.id} className={cn("smartliste-list-item", listId === list.id && "active")}>
                    <button
                      type="button"
                      onClick={() => {
                        setListId(list.id);
                        setSelectedIds(new Set());
                        setDetailCard(null);
                      }}
                    >
                      {list.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Slette «${list.name}»?`)) void deleteList(list.id);
                      }}
                      className="smartliste-btn smartliste-btn-icon"
                      style={{ border: "none", background: "transparent", color: "#64748b" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {board && <SmartlisteInsights board={board} />}
          </aside>
        )}

        <main className="smartliste-main">
          {loadingBoard ? (
            <div className="smartliste-empty">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#64748b" }} />
            </div>
          ) : !board ? (
            <div className="smartliste-empty">
              <LayoutGrid className="h-12 w-12" style={{ color: "#475569" }} />
              <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e2e8f0" }}>Smartliste</p>
              <p style={{ maxWidth: "28rem", fontSize: "0.875rem" }}>
                Her strukturerer du leads med soner, merkelapper og AI-rangering.
                Opprett en liste til venstre, eller lagre firma fra Skann.
              </p>
              <Link href="/app" className="smartliste-link">
                Gå til Skann →
              </Link>
            </div>
          ) : viewMode === "ranked" ? (
            <SmartlisteRankedView
              board={board}
              searchQuery={searchQuery}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onOpen={setDetailCard}
            />
          ) : viewMode === "grid" ? (
            <DndContext>
              <div className="smartliste-dot-grid overflow-auto p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {board.items
                    .filter((item) => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        item.company?.name?.toLowerCase().includes(q) ||
                        item.orgnr.includes(q)
                      );
                    })
                    .map((item) => (
                      <SmartlisteCard
                        key={item.id}
                        card={item}
                        selected={selectedIds.has(item.id)}
                        compact={cardSize === "compact"}
                        staticCard
                        onSelect={handleSelect}
                        onOpen={setDetailCard}
                      />
                    ))}
                </div>
              </div>
            </DndContext>
          ) : (
            <SmartlisteDotBoard
              board={board}
              zoom={zoom}
              compact={cardSize === "compact"}
              searchQuery={searchQuery}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onOpen={setDetailCard}
              onMoveItems={handleMoveItems}
            />
          )}
        </main>

        {/* Høyre panel */}
        {showRight && board && (
          <aside className="smartliste-detail">
            <SmartlisteDetailPanel
              board={board}
              card={detailCard}
              syncing={syncing}
              summarizing={summarizing}
              onClose={() => setDetailCard(null)}
              onPatch={(patch) => void patchItems([patch])}
              onCreateLabel={createLabel}
              onSummarize={(itemId) => handleSummarizeItems([itemId])}
            />
          </aside>
        )}
      </div>

      {board && (
        <SmartlisteBatchBar
          selectedCards={selectedCards}
          syncing={syncing}
          summarizing={summarizing}
          onClearSelection={() => setSelectedIds(new Set())}
          onRemoveSelected={() => void handleRemoveSelected()}
          onSummarizeSelected={() => void handleSummarizeItems(selectedCards.map((c) => c.id))}
          onExportQueue={exportToQueue}
          onExportPipeline={exportToPipeline}
          onExportRing={exportToRing}
        />
      )}
    </div>
  );
}
