"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, Clock, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentScheduledMessage } from "@/types/database";

type Props = {
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
  conversationId?: string | null;
  onScheduled?: () => void;
  onOpenConversation?: (conversationId: string) => void;
};

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultDateTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusLabel(status: AgentScheduledMessage["status"]): string {
  switch (status) {
    case "pending":
      return "Venter";
    case "running":
      return "Kjører";
    case "done":
      return "Ferdig";
    case "failed":
      return "Feilet";
    default:
      return status;
  }
}

function statusColor(status: AgentScheduledMessage["status"]): string {
  switch (status) {
    case "pending":
      return "text-sky-300 bg-sky-500/15 border-sky-400/25";
    case "running":
      return "text-amber-200 bg-amber-500/15 border-amber-400/25";
    case "done":
      return "text-emerald-200 bg-emerald-500/15 border-emerald-400/25";
    case "failed":
      return "text-red-200 bg-red-500/15 border-red-400/25";
    default:
      return "text-[#98989d] bg-white/5 border-white/10";
  }
}

export function AgentScheduleModal({
  open,
  onClose,
  initialMessage = "",
  conversationId = null,
  onScheduled,
  onOpenConversation,
}: Props) {
  const [message, setMessage] = useState(initialMessage);
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scheduled, setScheduled] = useState<AgentScheduledMessage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => scheduled.filter((s) => s.status === "pending" || s.status === "running").length,
    [scheduled]
  );

  const loadScheduled = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/agent/scheduled");
      if (!res.ok) return;
      const data = (await res.json()) as { scheduled?: AgentScheduledMessage[] };
      setScheduled(data.scheduled ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMessage(initialMessage);
    setScheduledAt(defaultDateTimeLocal());
    setError(null);
    setSuccess(false);
    void loadScheduled();
  }, [open, initialMessage, loadScheduled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/agent/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          scheduledAt: new Date(scheduledAt).toISOString(),
          conversationId: conversationId ?? undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Kunne ikke planlegge.");
        return;
      }

      setSuccess(true);
      setMessage("");
      onScheduled?.();
      await loadScheduled();
    } catch {
      setError("Kunne ikke nå serveren. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/agent/scheduled?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) await loadScheduled();
    } catch {
      // ignore
    } finally {
      setCancellingId(null);
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
        aria-label="Lukk planlegging"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Planlegg AI-spørsmål"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-[1] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c1e] text-[#f5f5f7] shadow-2xl",
          "max-h-[min(90dvh,640px)]"
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a84ff]/15 text-[#0a84ff]">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Planlegg spørsmål</h2>
            <p className="text-[11px] text-[#98989d]">
              Agenten kjører på valgt tid — du kan gå vekk
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#98989d] transition hover:bg-white/10 hover:text-[#f5f5f7]"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 border-b border-white/[0.06] p-4">
          <div>
            <label htmlFor="schedule-message" className="mb-1.5 block text-[11px] font-medium text-[#98989d]">
              Spørsmål til agenten
            </label>
            <textarea
              id="schedule-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="F.eks. Finn frisører uten nettside i Narvik…"
              className="w-full resize-none rounded-xl border border-white/[0.06] bg-[#2c2c2e] px-3 py-2.5 text-[13px] text-[#f5f5f7] placeholder:text-[#98989d] focus:border-[#0a84ff]/60 focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/30"
            />
          </div>

          <div>
            <label htmlFor="schedule-at" className="mb-1.5 block text-[11px] font-medium text-[#98989d]">
              Når skal det kjøres?
            </label>
            <input
              id="schedule-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-[#2c2c2e] px-3 py-2.5 text-[13px] text-[#f5f5f7] focus:border-[#0a84ff]/60 focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/30 [color-scheme:dark]"
            />
            <p className="mt-1 text-[10px] text-[#98989d]/80">
              Ingen øvre grense — du kan planlegge langt frem i tid
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
              <Check className="h-3.5 w-3.5 shrink-0" />
              Planlagt! Du får svar i samtalen når tiden kommer.
            </p>
          )}

          <button
            type="submit"
            disabled={!message.trim() || submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0a84ff] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#3395ff] disabled:bg-[#2c2c2e] disabled:text-[#5a5a5e]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Planlegger…
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Planlegg spørsmål
              </>
            )}
          </button>
        </form>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <h3 className="text-[12px] font-medium text-[#98989d]">
              Planlagte og ferdige
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[#0a84ff]/20 px-1.5 py-0.5 text-[10px] text-[#6cb8ff]">
                  {pendingCount} venter
                </span>
              )}
            </h3>
            {loadingList && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#98989d]" />}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {scheduled.length === 0 && !loadingList && (
              <p className="py-4 text-center text-[12px] text-[#98989d]">
                Ingen planlagte spørsmål ennå
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {scheduled.map((item) => {
                const preview = item.message.slice(0, 80);
                const resultText =
                  item.status === "done" && item.result?.assistantText
                    ? String(item.result.assistantText).slice(0, 100)
                    : null;

                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/[0.06] bg-[#2c2c2e]/80 p-3"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[12px] leading-snug text-[#f5f5f7]">
                        {preview}
                        {item.message.length > 80 ? "…" : ""}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          statusColor(item.status)
                        )}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <p className="text-[10px] text-[#98989d]">
                      {formatScheduledAt(item.scheduled_at)}
                    </p>

                    {item.status === "failed" && item.error_message && (
                      <p className="mt-1 text-[10px] text-red-300">{item.error_message}</p>
                    )}

                    {resultText && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] text-[#98989d]">
                        {resultText}…
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => void handleCancel(item.id)}
                          disabled={cancellingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-[#98989d] transition hover:bg-white/10 hover:text-red-200"
                        >
                          {cancellingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Avbryt
                        </button>
                      )}

                      {item.status === "done" && item.conversation_id && onOpenConversation && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenConversation(item.conversation_id!);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#0a84ff]/30 bg-[#0a84ff]/10 px-2 py-1 text-[10px] text-[#6cb8ff] transition hover:bg-[#0a84ff]/20"
                        >
                          Se svar i samtale
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
