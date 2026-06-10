"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerperUsage } from "@/lib/billing/serper-usage";
import { useRouter } from "next/navigation";
import { notifySavedListChanged } from "@/lib/agent/saved-list-bus";
import {
  openAgentChat,
  setStoredAgentConversationId,
} from "@/lib/agent/agent-chat-bus";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import { useVisualViewportBottomInset } from "@/hooks/useVisualViewportBottomInset";
import { cn } from "@/lib/utils";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import { AgentScheduleModal } from "@/components/agent/AgentScheduleModal";
import { AGENT_MAX_TOOL_LOOPS } from "@/lib/agent/constants";
import { isAgentResumeIntent } from "@/lib/agent/prompt";
import {
  ArrowUp,
  Building2,
  Clock,
  Search,
  Square,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  link?: string;
  listId?: string;
  listName?: string;
};

const SUGGESTIONS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Finn frisører i Narvik uten nettside", icon: Search },
  { label: "Nye byggfirma i Oslo siste 30 dager", icon: Building2 },
  {
    label: "Serveringsfirma i Nordland som trenger nettside",
    icon: UtensilsCrossed,
  },
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cancelAgentRuns(): Promise<void> {
  try {
    await fetch("/api/agent/runs/cancel", { method: "POST" });
  } catch {
    // Best-effort: server may still mark run finished on disconnect.
  }
}

export function AgentChatFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="agent-chat-fab fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center overflow-hidden rounded-full border border-sky-400/40 bg-sky-500/90 text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-400 hover:scale-105 active:scale-95"
      aria-label="Åpne AI-assistent"
      title="AI-assistent"
    >
      <AgentRobotIcon size={40} className="scale-125 drop-shadow-sm" />
    </button>
  );
}

export function AgentChatPanel({
  open,
  onClose,
  initialConversationId = null,
}: {
  open: boolean;
  onClose: () => void;
  initialConversationId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [pendingRetryText, setPendingRetryText] = useState<string | null>(null);
  const [showResumeButton, setShowResumeButton] = useState(false);
  const [pendingSavePrompt, setPendingSavePrompt] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolStep, setToolStep] = useState(0);
  const [toolProgress, setToolProgress] = useState<{
    scanned: number;
    total: number;
  } | null>(null);
  const [serperUsage, setSerperUsage] = useState<SerperUsage | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [pendingScheduleCount, setPendingScheduleCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const keyboardInset = useVisualViewportBottomInset(open, inputRef);

  const refreshPendingScheduleCount = useCallback(() => {
    void fetch("/api/agent/scheduled")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { scheduled?: Array<{ status: string }> } | null) => {
        if (!data?.scheduled) return;
        const count = data.scheduled.filter(
          (s) => s.status === "pending" || s.status === "running"
        ).length;
        setPendingScheduleCount(count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/serper-usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((usage) => {
        if (usage) setSerperUsage(usage);
      })
      .catch(() => {});
    void fetch("/api/agent/scheduled/run", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        refreshPendingScheduleCount();
      });
  }, [open, loading, refreshPendingScheduleCount]);

  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    void cancelAgentRuns();
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      void cancelAgentRuns();
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function bootstrapConversation() {
      setBlockedMessage(null);
      setPendingRetryText(null);
      setShowResumeButton(false);
      setInput("");

      if (!initialConversationId) {
        setConversationId(null);
        setMessages([]);
        setStoredAgentConversationId(null);
        return;
      }

      setConversationId(initialConversationId);
      setStoredAgentConversationId(initialConversationId);
      setLoadingHistory(true);

      try {
        const res = await fetch(
          `/api/agent/conversations?id=${encodeURIComponent(initialConversationId)}`
        );
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: string;
            content: string;
          }>;
        };

        if (cancelled) return;

        const loaded = (data.messages ?? []).map((m) => {
          if (m.role === "tool") {
            const label = (m as { tool_name?: string }).tool_name?.replace(/_/g, " ") ?? "verktøy";
            return {
              id: m.id,
              role: "status" as const,
              content: `[${label}] ${m.content}`,
            };
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          };
        });

        setMessages(loaded);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "auto",
          });
        });
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    void bootstrapConversation();

    return () => {
      cancelled = true;
    };
  }, [open, initialConversationId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const appendMessage = useCallback(
    (msg: Omit<ChatMessage, "id">) => {
      setMessages((prev) => [...prev, { ...msg, id: newId() }]);
      scrollToBottom();
    },
    [scrollToBottom]
  );

  const stopRequest = useCallback(() => {
    abortRef.current?.abort();
    void cancelAgentRuns();
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { cancelPrevious?: boolean; skipUserAppend?: boolean }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      abortRef.current?.abort();
      await cancelAgentRuns();
      const abortController = new AbortController();
      abortRef.current = abortController;

      setInput("");
      setBlockedMessage(null);
      setPendingRetryText(null);
      setPendingSavePrompt(null);
      if (isAgentResumeIntent(trimmed)) {
        setShowResumeButton(false);
      }
      if (!options?.skipUserAppend) {
        appendMessage({ role: "user", content: trimmed });
      }
      setLoading(true);
      setActiveTool(null);
      setToolStep(0);
      setToolProgress(null);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationId ?? undefined,
            cancelPrevious: options?.cancelPrevious ?? true,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText =
            typeof err.error === "string"
              ? err.error
              : "Noe gikk galt. Prøv igjen.";

          if (res.status === 409 && err.canCancel) {
            if (!options?.cancelPrevious) {
              void sendMessage(trimmed, {
                cancelPrevious: true,
                skipUserAppend: true,
              });
              return;
            }
            setBlockedMessage(errorText);
            setPendingRetryText(trimmed);
            appendMessage({
              role: "assistant",
              content: errorText,
            });
            return;
          }

          appendMessage({
            role: "assistant",
            content: errorText,
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Ingen stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        let streamingMessageId: string | null = null;
        let resultLink: string | undefined;
        let savedListId: string | undefined;
        let savedListName: string | undefined;
        let savedOrgnrCount: number | undefined;
        const statusSummaries: string[] = [];

        const ensureStreamingMessage = () => {
          if (streamingMessageId) return streamingMessageId;
          const id = newId();
          streamingMessageId = id;
          setMessages((prev) => [
            ...prev,
            { id, role: "assistant", content: "" },
          ]);
          scrollToBottom();
          return id;
        };

        const appendStreamingDelta = (delta: string) => {
          const id = ensureStreamingMessage();
          assistantText += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, content: m.content + delta } : m
            )
          );
          scrollToBottom();
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const raw = line.replace(/^data: /, "").trim();
            if (!raw) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (event.type === "conversation" && typeof event.conversationId === "string") {
              setConversationId(event.conversationId);
              setStoredAgentConversationId(event.conversationId);
            } else if (event.type === "text_delta" && typeof event.content === "string") {
              appendStreamingDelta(event.content);
            } else if (event.type === "text" && typeof event.content === "string") {
              assistantText = event.content;
              if (streamingMessageId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingMessageId
                      ? { ...m, content: event.content as string }
                      : m
                  )
                );
              }
            } else if (event.type === "tool_start" && typeof event.tool === "string") {
              setActiveTool(event.tool);
              setToolStep((n) => n + 1);
              setToolProgress(null);
            } else if (
              event.type === "tool_progress" &&
              typeof event.scanned === "number" &&
              typeof event.total === "number"
            ) {
              setToolProgress({
                scanned: event.scanned,
                total: event.total,
              });
            } else if (
              event.type === "tool_end" &&
              typeof event.summary === "string"
            ) {
              setActiveTool(null);
              setToolProgress(null);
              statusSummaries.push(event.summary);
              appendMessage({ role: "status", content: event.summary });
            } else if (
              event.type === "confirm_save" &&
              typeof event.message === "string"
            ) {
              setPendingSavePrompt(event.message);
            } else if (event.type === "error" && typeof event.message === "string") {
              assistantText = event.message;
            } else if (event.type === "list_saved") {
              if (typeof event.listId === "string") savedListId = event.listId;
              if (typeof event.listName === "string") savedListName = event.listName;
              if (typeof event.url === "string") resultLink = event.url;
              if (typeof event.orgnrCount === "number") {
                savedOrgnrCount = event.orgnrCount;
              }
              notifySavedListChanged({
                id: String(event.listId ?? ""),
                name: String(event.listName ?? "Ny liste"),
                url: typeof event.url === "string" ? event.url : undefined,
                orgnrCount:
                  typeof event.orgnrCount === "number" ? event.orgnrCount : undefined,
              });
            } else if (event.type === "done") {
              if (typeof event.link === "string") resultLink = event.link;
              if (typeof event.listId === "string") savedListId = event.listId;
              if (typeof event.listName === "string") savedListName = event.listName;
              if (typeof event.orgnrCount === "number") {
                savedOrgnrCount = event.orgnrCount;
              }
              if (typeof event.content === "string" && event.content.trim()) {
                assistantText = event.content;
              }
            }
          }
        }

        if (!assistantText.trim()) {
          if (savedListName) {
            const count =
              typeof savedOrgnrCount === "number" && savedOrgnrCount > 0
                ? ` med ${savedOrgnrCount} firma`
                : "";
            assistantText = `Ferdig! Lagret «${savedListName}»${count}. Åpne listen i Skann når du er klar.`;
          } else if (statusSummaries.length > 0) {
            assistantText = `Ferdig! ${statusSummaries.slice(-3).join(" ")}`;
          }
        }

        if (assistantText.trim()) {
          if (streamingMessageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMessageId
                  ? {
                      ...m,
                      content: assistantText,
                      link: resultLink,
                      listId: savedListId,
                      listName: savedListName,
                    }
                  : m
              )
            );
            scrollToBottom();
          } else {
            appendMessage({
              role: "assistant",
              content: assistantText,
              link: resultLink,
              listId: savedListId,
              listName: savedListName,
            });
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          appendMessage({ role: "status", content: "Stoppet av deg" });
          setShowResumeButton(true);
          return;
        }
        appendMessage({
          role: "assistant",
          content: "Kunne ikke nå agenten. Sjekk nettverket og prøv igjen.",
        });
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
          setLoading(false);
          setActiveTool(null);
          setToolStep(0);
          setToolProgress(null);
        }
      }
    },
    [appendMessage, conversationId, loading]
  );

  const retryAfterCancel = useCallback(async () => {
    if (!pendingRetryText || loading) return;
    await cancelAgentRuns();
    void sendMessage(pendingRetryText, {
      cancelPrevious: true,
      skipUserAppend: true,
    });
  }, [loading, pendingRetryText, sendMessage]);

  return (
    <>
    <AgentScheduleModal
      open={scheduleModalOpen}
      onClose={() => setScheduleModalOpen(false)}
      initialMessage={input}
      conversationId={conversationId}
      onScheduled={refreshPendingScheduleCount}
      onOpenConversation={(id) => openAgentChat({ conversationId: id })}
    />
    <AppSideDrawer
      open={open}
      onClose={onClose}
      fullScreenMobile
      header={
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] bg-[#232325]/85 px-3 py-3 pr-14 backdrop-blur-xl sm:px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] shadow-[0_2px_10px_rgba(10,132,255,0.35)]">
            <AgentRobotIcon size={26} className="drop-shadow-sm" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
              AI-assistent
            </span>
            <span className="truncate text-[11px] text-[#98989d]">
              Finner firma og lager lister
            </span>
          </span>
        </div>
      }
      maxWidth="md"
      panelClassName="flex flex-col overflow-hidden border-white/[0.06] bg-[#1c1c1e]"
      footer={
        <div
          className="sticky bottom-0 z-10 bg-[#1c1c1e] px-3 pt-2 sm:px-3"
          style={{
            paddingBottom: `max(${keyboardInset}px, env(safe-area-inset-bottom, 0px), 0.75rem)`,
          }}
        >
          {serperUsage && (
            <p
              className={cn(
                "mb-1.5 text-center text-[11px] tabular-nums tracking-wide sm:text-[10px]",
                serperUsage.limitReached ? "text-amber-400" : "text-[#98989d]/70"
              )}
            >
              Serper-søk: {serperUsage.used} / {serperUsage.limit}
            </p>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              disabled={loading}
              className="relative flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#2c2c2e] text-[#98989d] transition hover:bg-[#3a3a3c] hover:text-[#f5f5f7] active:scale-95 disabled:opacity-60"
              aria-label="Planlegg spørsmål"
              title="Planlegg spørsmål til senere"
            >
              <Clock className="h-[18px] w-[18px]" />
              {pendingScheduleCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0a84ff] px-1 text-[10px] font-semibold text-white">
                  {pendingScheduleCount > 9 ? "9+" : pendingScheduleCount}
                </span>
              )}
            </button>
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="F.eks. Finn frisører uten nettside i Narvik…"
              disabled={loading}
              className="min-h-[44px] min-w-0 flex-1 rounded-[14px] border border-white/[0.06] bg-[#2c2c2e] px-4 py-2.5 text-[16px] text-[#f5f5f7] placeholder:text-[#98989d] transition focus:border-[#0a84ff]/60 focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/30 disabled:opacity-60 sm:text-[13px]"
            />
            {loading ? (
              <button
                type="button"
                onClick={stopRequest}
                className="flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/15 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/25 active:scale-95 sm:px-3.5 sm:text-xs"
                aria-label="Stopp"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stopp
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[#0a84ff] text-white shadow-[0_2px_10px_rgba(10,132,255,0.4)] transition hover:bg-[#3395ff] active:scale-95 disabled:bg-[#2c2c2e] disabled:text-[#5a5a5e] disabled:shadow-none"
                aria-label="Send"
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
              </button>
            )}
          </form>
        </div>
      }
    >
      <div className="flex min-h-full flex-col">
        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 pb-4 sm:gap-2.5 sm:p-4"
        >
        {loadingHistory && (
          <p className="text-center text-sm text-[#98989d]">Laster samtale…</p>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-1 py-6 sm:gap-7 sm:py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] shadow-[0_8px_28px_rgba(10,132,255,0.35)]">
                <AgentRobotIcon size={46} className="drop-shadow-sm" />
              </span>
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[#f5f5f7] sm:text-[19px]">
                Hva kan jeg hjelpe med?
              </h3>
              <p className="max-w-[300px] text-[13px] leading-relaxed text-[#98989d] sm:max-w-[270px] sm:text-[12.5px]">
                Jeg finner firma, sjekker nettsider, beriker kontaktinfo og
                lager lister over de som trenger nettside.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:gap-2">
              {SUGGESTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void sendMessage(label)}
                  disabled={loading}
                  className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-[#2c2c2e] px-3.5 py-3 text-left text-[14px] leading-snug text-[#f5f5f7] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#3a3a3c] hover:shadow-[0_6px_16px_rgba(0,0,0,0.35)] active:translate-y-0 disabled:opacity-50 sm:px-4 sm:text-[13px]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a84ff]/15 text-[#0a84ff] transition group-hover:bg-[#0a84ff]/25 sm:h-7 sm:w-7">
                    <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[90%] rounded-[18px] px-3.5 py-2.5 text-[14px] leading-relaxed sm:max-w-[85%] sm:py-2 sm:text-[13px]",
              m.role === "user" &&
                "ml-auto rounded-br-[6px] bg-[#0a84ff] text-white shadow-[0_2px_8px_rgba(10,132,255,0.25)]",
              m.role === "assistant" &&
                "rounded-bl-[6px] border border-white/[0.04] bg-[#2c2c2e] text-[#f5f5f7]",
              m.role === "status" &&
                "mx-auto max-w-full rounded-full bg-white/[0.05] px-3.5 py-1 text-center text-[11px] text-[#98989d]"
            )}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.link && (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(m.link!);
                  }}
                  className="inline-flex min-h-[44px] items-center text-left text-sm font-semibold text-[#6cb8ff] hover:text-[#9ccfff] sm:min-h-0 sm:text-xs"
                >
                  Åpne listen i Skann →
                </button>
                {m.listName && (
                  <span className="text-[10px] text-[#98989d]">
                    Lagret som «{m.listName}» under Lagrede målgrupper
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {blockedMessage && pendingRetryText && !loading && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <p>En gammel jobb blokkerer chatten. Du kan avbryte den og prøve på nytt.</p>
            <button
              type="button"
              onClick={() => void retryAfterCancel()}
              className="min-h-[44px] rounded-lg border border-amber-300/40 bg-amber-400/20 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-400/30 active:scale-[0.98] sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
            >
              Avbryt og start på nytt
            </button>
          </div>
        )}

        {pendingSavePrompt && !loading && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <p>{pendingSavePrompt}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void sendMessage("Ja, lagre listen")}
                className="min-h-[44px] rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-4 py-2.5 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/30 active:scale-[0.98] sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
              >
                Lagre liste
              </button>
              <button
                type="button"
                onClick={() => void sendMessage("Nei, ikke lagre ennå — skann flere")}
                className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 active:scale-[0.98] sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
              >
                Ikke lagre ennå
              </button>
            </div>
          </div>
        )}

        {showResumeButton && !loading && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => void sendMessage("Start søk igjen")}
              className="min-h-[44px] rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/30 active:scale-[0.98] sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
            >
              Start søk igjen
            </button>
            <p className="text-center text-[11px] text-[#98989d]">
              Du kan også stille spørsmål før du fortsetter
            </p>
          </div>
        )}

        {loading && (
          <div
            className="agent-thinking-bubble"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="agent-thinking-bubble__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {activeTool ? (
              <span className="agent-thinking-bubble__label">
                {toolProgress
                  ? `${activeTool.replace(/_/g, " ")}… ${toolProgress.scanned}/${toolProgress.total} (steg ${toolStep}/${AGENT_MAX_TOOL_LOOPS})`
                  : `${activeTool.replace(/_/g, " ")}… (steg ${toolStep}/${AGENT_MAX_TOOL_LOOPS})`}
              </span>
            ) : (
              <span className="sr-only">Tenker…</span>
            )}
          </div>
        )}

        </div>
      </div>
    </AppSideDrawer>
    </>
  );
}
