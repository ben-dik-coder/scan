"use client";

import { LABEL_COLOR_OPTIONS, labelChipClass } from "@/lib/smartliste/board-config";
import { readAiSummaryFromCustomFields } from "@/lib/smartliste/ai-summary-shared";
import { buildCompanyFacts } from "@/lib/smartliste/company-facts";
import type { SmartListBoard, SmartListCard, SmartListLabel } from "@/lib/smartliste/types";
import { cn, formatCompanyName } from "@/lib/utils";
import { ScoreRing } from "@/components/ui/primitives";
import { Loader2, Pin, PinOff, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  board: SmartListBoard;
  card: SmartListCard | null;
  syncing: boolean;
  summarizing: boolean;
  onClose: () => void;
  onPatch: (patch: {
    id: string;
    note?: string | null;
    pinned?: boolean;
    label_ids?: string[];
  }) => void;
  onCreateLabel: (name: string, color: string) => Promise<string | null>;
  onSummarize: (itemId: string) => Promise<void>;
};

export function SmartlisteDetailPanel({
  board,
  card,
  syncing,
  summarizing,
  onClose,
  onPatch,
  onCreateLabel,
  onSummarize,
}: Props) {
  const [note, setNote] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("sky");

  useEffect(() => {
    setNote(card?.note ?? "");
  }, [card?.id, card?.note]);

  const facts = useMemo(
    () => (card?.company ? buildCompanyFacts(card.company) : null),
    [card?.company]
  );

  const aiSummary = useMemo(
    () => (card ? readAiSummaryFromCustomFields(card.custom_fields) : null),
    [card]
  );

  if (!card) {
    return (
      <div className="smartliste-empty" style={{ height: "100%" }}>
        <p>Velg et kort for detaljer</p>
        <p style={{ fontSize: "0.75rem" }}>Dobbeltklikk eller klikk for å velge</p>
      </div>
    );
  }

  const company = card.company;
  const score = card.ai_score ?? 0;

  function toggleLabel(label: SmartListLabel) {
    const ids = new Set(card!.labels.map((l) => l.id));
    if (ids.has(label.id)) ids.delete(label.id);
    else ids.add(label.id);
    onPatch({ id: card!.id, label_ids: [...ids] });
  }

  async function handleCreateLabel() {
    if (!card || !newLabelName.trim()) return;
    const id = await onCreateLabel(newLabelName.trim(), newLabelColor);
    if (id) {
      const ids = [...card.labels.map((l) => l.id), id];
      onPatch({ id: card.id, label_ids: ids });
      setNewLabelName("");
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          padding: "0.75rem 1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>Detaljer</h2>
        <button type="button" onClick={onClose} className="smartliste-btn smartliste-btn-icon">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1rem" }}>
          <ScoreRing score={score} size="md" />
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {company ? formatCompanyName(company.name) : card.orgnr}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>{card.orgnr}</p>
          </div>
        </div>

        {facts && (
          <div
            style={{
              marginBottom: "1rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              padding: "0.75rem",
            }}
          >
            <p className="smartliste-section-label" style={{ padding: 0, marginBottom: "0.5rem" }}>
              Firmainfo
            </p>
            <dl style={{ margin: 0, fontSize: "0.875rem" }}>
              <FactRow label="Etablert" value={facts.establishedLabel} />
              <FactRow label="Bransje" value={facts.industry} />
              <FactRow label="Daglig leder" value={facts.dagligLeder ?? "Ikke funnet"} />
              <FactRow label="Sted" value={facts.municipality ?? "—"} />
              <FactRow label="Telefon" value={facts.phone ?? "—"} />
              <FactRow label="E-post" value={facts.email ?? "—"} />
              <FactRow label="Nettside" value={facts.websiteStatus} />
            </dl>
          </div>
        )}

        <div
          style={{
            marginBottom: "1rem",
            borderRadius: "0.75rem",
            border: "1px solid rgba(251,191,36,0.2)",
            background: "rgba(251,191,36,0.06)",
            padding: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <p className="smartliste-section-label" style={{ padding: 0, margin: 0, color: "#fcd34d" }}>
              AI-oppsummering
            </p>
            <button
              type="button"
              disabled={summarizing || !company}
              onClick={() => void onSummarize(card.id)}
              className="smartliste-btn smartliste-btn-primary"
            >
              {summarizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {summarizing ? "Søker…" : aiSummary ? "Oppdater" : "Analyser"}
            </button>
          </div>

          {summarizing && (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
              Henter Brreg, telefon (1881/Gulesider), skanner nett og søker Google — tar gjerne 15–30 sek per firma.
            </p>
          )}

          {aiSummary ? (
            <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#e2e8f0" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem",
                  marginBottom: "0.65rem",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    borderRadius: "9999px",
                    padding: "0.15rem 0.5rem",
                    background: aiSummary.usedAi ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                    color: aiSummary.usedAi ? "#86efac" : "#cbd5e1",
                  }}
                >
                  {aiSummary.usedAi ? "AI + research" : "Research (regler)"}
                </span>
                {aiSummary.liveScanRan && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      borderRadius: "9999px",
                      padding: "0.15rem 0.5rem",
                      background: "rgba(56,189,248,0.12)",
                      color: "#7dd3fc",
                    }}
                  >
                    Live skann
                  </span>
                )}
                {(aiSummary.sources?.length ?? 0) > 0 &&
                  aiSummary.sources!.map((source) => (
                    <span
                      key={source}
                      style={{
                        fontSize: "0.65rem",
                        borderRadius: "9999px",
                        padding: "0.15rem 0.5rem",
                        background: "rgba(255,255,255,0.06)",
                        color: "#94a3b8",
                      }}
                    >
                      {source}
                    </span>
                  ))}
              </div>
              <p style={{ margin: "0 0 0.75rem", lineHeight: 1.5 }}>{aiSummary.summary}</p>
              {aiSummary.whatTheyDo && (
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                  <strong style={{ color: "#cbd5e1" }}>Driver med:</strong> {aiSummary.whatTheyDo}
                </p>
              )}
              {aiSummary.opportunities.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1" }}>
                    Hva vi kan løse for dem
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#cbd5e1" }}>
                    {aiSummary.opportunities.map((item) => (
                      <li key={item} style={{ marginBottom: "0.25rem" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiSummary.approach && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                  {aiSummary.approach}
                </p>
              )}
              {aiSummary.generated_at && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.65rem", color: "#64748b" }}>
                  Oppdatert {new Date(aiSummary.generated_at).toLocaleString("nb-NO")}
                </p>
              )}
            </div>
          ) : (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Trykk «Analyser» — da søker vi Brreg, nett og Google, og lager en unik vurdering for dette firmaet.
            </p>
          )}
        </div>

        {card.ai_score_reason && (
          <div
            style={{
              marginBottom: "1rem",
              borderRadius: "0.75rem",
              background: "rgba(255,255,255,0.03)",
              padding: "0.75rem",
            }}
          >
            <p className="smartliste-section-label" style={{ padding: 0, marginBottom: "0.35rem" }}>
              Prioritets-score
            </p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#cbd5e1" }}>{card.ai_score_reason}</p>
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <p className="smartliste-section-label" style={{ padding: 0, margin: 0 }}>
              Merkelapper
            </p>
            {syncing && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "#94a3b8" }} />}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {board.labels.map((label) => {
              const active = card.labels.some((l) => l.id === label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    active ? labelChipClass(label.color) : "border-white/10 text-slate-500"
                  )}
                >
                  {label.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Ny merkelapp"
              className="smartliste-input"
            />
            <select
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              className="smartliste-input"
              style={{ width: "auto" }}
            >
              {LABEL_COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void handleCreateLabel()} className="smartliste-btn">
              +
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <p className="smartliste-section-label" style={{ padding: 0, marginBottom: "0.5rem" }}>
            Notat
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (card.note ?? "")) onPatch({ id: card.id, note: note || null });
            }}
            rows={4}
            className="smartliste-input"
            placeholder="Egne notater om dette firmaet…"
          />
        </div>

        <button
          type="button"
          onClick={() => onPatch({ id: card.id, pinned: !card.pinned })}
          className="smartliste-btn"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {card.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {card.pinned ? "Løsne pin" : "Pin øverst i sone"}
        </button>
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "7rem 1fr", gap: "0.5rem", marginBottom: "0.35rem" }}>
      <dt style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#e2e8f0" }}>{value}</dd>
    </div>
  );
}
