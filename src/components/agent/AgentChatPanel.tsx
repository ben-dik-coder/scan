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
import { AgentMessageContent } from "@/components/agent/AgentMessageContent";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import { AgentScheduleModal } from "@/components/agent/AgentScheduleModal";
import {
  detectPlanConfirmKind,
  planConfirmActions,
  type PlanConfirmKind,
} from "@/lib/agent/plan-confirm";
import { isAgentResumeIntent } from "@/lib/agent/prompt";
import { ArrowUp, Clock, Square } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  link?: string;
  listId?: string;
  listName?: string;
  planConfirm?: PlanConfirmKind;
};

const SUGGESTIONS = [
  "Finn frisører i Narvik uten nettside",
  "Nye byggfirma i Oslo siste 30 dager",
  "Serveringsfirma i Nordland som trenger nettside",
];

const TOOL_STATUS_LABELS: Record<string, string> = {
  search_companies: "Søker firma",
  scan_websites: "Sjekker nettsider",
  filter_no_website: "Går gjennom listen",
  filter_leads: "Går gjennom listen",
  enrich_contacts: "Henter kontaktinfo",
  save_list: "Lagrer liste",
  get_usage: "Sjekker kvote",
  list_saved_lists: "Henter lagrede lister",
  load_saved_list: "Laster liste",
  remember_preference: "Lagrer preferanse",
};

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
  const [activeTool, setActiveTool] = useState<string | null>(null);
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
  const sendingRef = useRef(false);
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
        if (!sendingRef.current) {
          setMessages([]);
        }
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

        if (cancelled || sendingRef.current) return;

        const loaded = (data.messages ?? [])
          .filter((m) => m.role !== "tool")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

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
      if (isAgentResumeIntent(trimmed)) {
        setShowResumeButton(false);
      }
      setMessages((prev) =>
        prev.map((m) => ({ ...m, planConfirm: undefined }))
      );
      if (!options?.skipUserAppend) {
        appendMessage({ role: "user", content: trimmed });
      }
      setLoading(true);
      sendingRef.current = true;
      setActiveTool(null);
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

        const setAssistantContent = (content: string) => {
          const id = ensureStreamingMessage();
          assistantText = content;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content } : m))
          );
          scrollToBottom();
        };

        const appendStreamingDelta = (delta: string) => {
          if (!delta) return;
          const id = ensureStreamingMessage();
          assistantText += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, content: m.content + delta } : m
            )
          );
          scrollToBottom();
        };

        const processSseEvent = (event: Record<string, unknown>) => {
          if (event.type === "conversation" && typeof event.conversationId === "string") {
            setConversationId(event.conversationId);
            setStoredAgentConversationId(event.conversationId);
          } else if (event.type === "text_delta" && typeof event.content === "string") {
            appendStreamingDelta(event.content);
          } else if (event.type === "text" && typeof event.content === "string") {
            setAssistantContent(event.content);
          } else if (event.type === "tool_start" && typeof event.tool === "string") {
            setActiveTool(event.tool);
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
          } else if (event.type === "confirm_save") {
            const id = ensureStreamingMessage();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, planConfirm: "save_only" } : m
              )
            );
          } else if (event.type === "error" && typeof event.message === "string") {
            setAssistantContent(event.message);
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
              setAssistantContent(event.content);
            }
          }
        };

        const processSseLines = (lines: string[]) => {
          for (const line of lines) {
            const raw = line.replace(/^data: /, "").trim();
            if (!raw) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }
            processSseEvent(event);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";
            processSseLines(lines);
          }
          if (done) break;
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          processSseLines(buffer.split("\n\n").filter(Boolean));
          buffer = "";
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
          } else {
            assistantText =
              "Beklager, jeg fikk ikke fram et svar. Prøv igjen om litt.";
          }
        }

        const planConfirm = detectPlanConfirmKind(assistantText) ?? undefined;
        if (streamingMessageId) {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === streamingMessageId
                ? {
                    ...m,
                    content: assistantText,
                    link: resultLink,
                    listId: savedListId,
                    listName: savedListName,
                    planConfirm: m.planConfirm ?? planConfirm,
                  }
                : m
            );
            return updated.filter(
              (m) => m.role !== "assistant" || m.content.trim().length > 0
            );
          });
          scrollToBottom();
        } else {
          appendMessage({
            role: "assistant",
            content: assistantText,
            link: resultLink,
            listId: savedListId,
            listName: savedListName,
            planConfirm,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setShowResumeButton(true);
          return;
        }
        appendMessage({
          role: "assistant",
          content: "Kunne ikke nå agenten. Sjekk nettverket og prøv igjen.",
        });
      } finally {
        sendingRef.current = false;
        if (abortRef.current === abortController) {
          abortRef.current = null;
          setLoading(false);
          setActiveTool(null);
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
        <div className="flex items-center gap-2.5 border-b border-white/[0.05] bg-[#212121]/90 px-3 py-2.5 pr-14 backdrop-blur-xl sm:px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f2f2f]">
            <AgentRobotIcon size={22} className="opacity-90" />
          </span>
          <span className="truncate text-[15px] font-medium tracking-[-0.01em] text-[#ececec]">
            NyLead-assistent
          </span>
        </div>
      }
      maxWidth="md"
      panelClassName="flex flex-col overflow-hidden border-white/[0.05] bg-[#212121]"
      footer={
        <div
          className="sticky bottom-0 z-10 bg-[#212121] px-3 pt-2 sm:px-4"
          style={{
            paddingBottom: `max(${keyboardInset}px, env(safe-area-inset-bottom, 0px), 0.75rem)`,
          }}
        >
          {serperUsage?.limitReached && (
            <p className="mb-1.5 text-center text-[10px] text-amber-400/90">
              Søkekvote brukt opp ({serperUsage.used}/{serperUsage.limit})
            </p>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              disabled={loading}
              className="relative flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition hover:bg-white/[0.06] hover:text-[#ececec] active:scale-95 disabled:opacity-50"
              aria-label="Planlegg spørsmål"
              title="Planlegg spørsmål til senere"
            >
              <Clock className="h-[17px] w-[17px]" />
              {pendingScheduleCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#10a37f] px-1 text-[9px] font-semibold text-white">
                  {pendingScheduleCount > 9 ? "9+" : pendingScheduleCount}
                </span>
              )}
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[26px] border border-white/[0.08] bg-[#2f2f2f] px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] focus-within:border-white/[0.14]">
              <input
                ref={inputRef}
                type="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Spør om hva som helst…"
                disabled={loading}
                className="min-h-[40px] min-w-0 flex-1 bg-transparent py-2 text-[16px] text-[#ececec] placeholder:text-[#8e8e93] focus:outline-none disabled:opacity-60 sm:text-[15px]"
              />
              {loading ? (
                <button
                  type="button"
                  onClick={stopRequest}
                  className="flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full bg-[#ececec] text-[#212121] transition hover:bg-white active:scale-95"
                  aria-label="Stopp"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full bg-[#ececec] text-[#212121] transition hover:bg-white active:scale-95 disabled:bg-[#424242] disabled:text-[#6b6b6b]"
                  aria-label="Send"
                >
                  <ArrowUp className="h-[16px] w-[16px]" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </form>
        </div>
      }
    >
      <div className="flex min-h-full flex-col">
        <div
          ref={listRef}
          className="agent-chat-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4 pb-6 sm:gap-6 sm:px-4"
        >
        {loadingHistory && (
          <p className="text-center text-sm text-[#8e8e93]">Laster samtale…</p>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-2 py-8 sm:py-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-[22px] font-medium tracking-[-0.02em] text-[#ececec] sm:text-[20px]">
                Hva kan jeg hjelpe med?
              </h3>
              <p className="max-w-[280px] text-[14px] leading-relaxed text-[#8e8e93]">
                Spør om firma, nettsider eller lister — jeg svarer på norsk.
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2">
              {SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void sendMessage(label)}
                  disabled={loading}
                  className="rounded-2xl border border-white/[0.08] bg-transparent px-4 py-3 text-left text-[14px] leading-snug text-[#ececec] transition hover:bg-white/[0.05] active:scale-[0.99] disabled:opacity-50 sm:text-[13px]"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const lastPlanConfirmMessageId = !loading
            ? [...messages]
                .reverse()
                .find((msg) => msg.role === "assistant" && msg.planConfirm)?.id
            : null;

          return messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start",
                m.role === "status" && "justify-center"
              )}
            >
              <div
                className={cn(
                  m.role === "user" && "agent-chat-bubble agent-chat-bubble--user",
                  m.role === "assistant" &&
                    "agent-chat-bubble agent-chat-bubble--assistant",
                  m.role === "status" &&
                    "max-w-full px-2 py-0.5 text-center text-[11px] text-[#6b6b6b]"
                )}
              >
                <AgentMessageContent
                  content={m.content}
                  variant={m.role === "user" ? "user" : "assistant"}
                />
                {m.planConfirm &&
                  m.id === lastPlanConfirmMessageId &&
                  !loading && (
                    <div className="agent-chat-plan-confirm">
                      {planConfirmActions(m.planConfirm).map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => void sendMessage(action.message)}
                          className={cn(
                            "agent-chat-plan-confirm__btn",
                            action.variant === "primary"
                              ? "agent-chat-plan-confirm__btn--primary"
                              : "agent-chat-plan-confirm__btn--secondary"
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                {m.link && (
                  <div className="mt-3 flex flex-col gap-1 border-t border-white/[0.06] pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(m.link!);
                      }}
                      className="inline-flex min-h-[44px] items-center text-left text-sm font-medium text-[#10a37f] hover:text-[#1fd8a4] sm:min-h-0 sm:text-[13px]"
                    >
                      Åpne listen i Skann →
                    </button>
                    {m.listName && (
                      <span className="text-[11px] text-[#8e8e93]">
                        Lagret som «{m.listName}»
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ));
        })()}

        {blockedMessage && pendingRetryText && !loading && (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
            <p>En gammel jobb blokkerer chatten. Avbryt den og prøv på nytt.</p>
            <button
              type="button"
              onClick={() => void retryAfterCancel()}
              className="min-h-[44px] rounded-full bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-400/25 active:scale-[0.98] sm:min-h-0 sm:py-1.5 sm:text-xs"
            >
              Avbryt og start på nytt
            </button>
          </div>
        )}

        {showResumeButton && !loading && (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => void sendMessage("Start søk igjen")}
              className="min-h-[44px] rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-[#ececec] transition hover:bg-white/[0.05] active:scale-[0.98] sm:min-h-0 sm:py-1.5 sm:text-xs"
            >
              Start søk igjen
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-start" role="status" aria-live="polite" aria-busy="true">
            <div className="agent-thinking-bubble">
              <span className="agent-thinking-bubble__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {activeTool ? (
                <span className="agent-thinking-bubble__label">
                  {toolProgress
                    ? `${TOOL_STATUS_LABELS[activeTool] ?? "Jobber"}… ${toolProgress.scanned}/${toolProgress.total}`
                    : TOOL_STATUS_LABELS[activeTool] ?? "Jobber…"}
                </span>
              ) : (
                <span className="sr-only">Tenker…</span>
              )}
            </div>
          </div>
        )}

        </div>
      </div>
    </AppSideDrawer>
    </>
  );
}
