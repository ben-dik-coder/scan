"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerperUsage } from "@/lib/billing/serper-usage";
import { useRouter } from "next/navigation";
import { notifySavedListChanged } from "@/lib/agent/saved-list-bus";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import { cn } from "@/lib/utils";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import { AGENT_MAX_TOOL_LOOPS } from "@/lib/agent/constants";
import { Send, Square } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  link?: string;
  listId?: string;
  listName?: string;
};

const SUGGESTIONS = [
  "Finn frisører i Narvik uten nettside",
  "Nye byggfirma i Oslo siste 30 dager",
  "Serveringsfirma i Nordland som trenger nettside",
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
      className="agent-chat-fab fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-sky-400/40 bg-sky-500/90 text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-400 hover:scale-105 active:scale-95"
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
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [pendingRetryText, setPendingRetryText] = useState<string | null>(null);
  const [showResumeButton, setShowResumeButton] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolStep, setToolStep] = useState(0);
  const [serperUsage, setSerperUsage] = useState<SerperUsage | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    void fetch("/api/serper-usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((usage) => {
        if (usage) setSerperUsage(usage);
      })
      .catch(() => {});
  }, [open, loading]);

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
      const abortController = new AbortController();
      abortRef.current = abortController;

      setInput("");
      setBlockedMessage(null);
      setPendingRetryText(null);
      setShowResumeButton(false);
      if (!options?.skipUserAppend) {
        appendMessage({ role: "user", content: trimmed });
      }
      setLoading(true);
      setActiveTool(null);
      setToolStep(0);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationId ?? undefined,
            cancelPrevious: options?.cancelPrevious ?? false,
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
        let resultLink: string | undefined;
        let savedListId: string | undefined;
        let savedListName: string | undefined;
        let savedOrgnrCount: number | undefined;
        const statusSummaries: string[] = [];

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
            } else if (event.type === "text" && typeof event.content === "string") {
              assistantText = event.content;
            } else if (event.type === "tool_start" && typeof event.tool === "string") {
              setActiveTool(event.tool);
              setToolStep((n) => n + 1);
            } else if (
              event.type === "tool_end" &&
              typeof event.summary === "string"
            ) {
              setActiveTool(null);
              statusSummaries.push(event.summary);
              appendMessage({ role: "status", content: event.summary });
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
          appendMessage({
            role: "assistant",
            content: assistantText,
            link: resultLink,
            listId: savedListId,
            listName: savedListName,
          });
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
        }
        setLoading(false);
        setActiveTool(null);
        setToolStep(0);
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
    <AppSideDrawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AgentRobotIcon size={20} />
          AI-assistent
        </span>
      }
      maxWidth="md"
      panelClassName="flex flex-col overflow-hidden"
      footer={
        <>
          <form
            className="flex gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="F.eks. Finn frisører uten nettside i Narvik…"
              disabled={loading}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/50 focus:outline-none"
            />
            {loading ? (
              <button
                type="button"
                onClick={stopRequest}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/20 px-3 text-sm font-medium text-red-200 transition hover:bg-red-500/30"
                aria-label="Stopp"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stopp
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </>
      }
    >
      <div className={cn("agent-aurora-field", loading && "agent-aurora-field--active")}>
        {loading && (
          <div className="agent-aurora-overlay" aria-hidden="true">
            <div className="agent-aurora-overlay__ribbon agent-aurora-overlay__ribbon--1" />
            <div className="agent-aurora-overlay__ribbon agent-aurora-overlay__ribbon--2" />
            <div className="agent-aurora-overlay__ribbon agent-aurora-overlay__ribbon--3" />
            <div className="agent-aurora-overlay__shimmer" />
            <div className="agent-aurora-overlay__veil" />
          </div>
        )}

        <div ref={listRef} className="agent-aurora-content flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Jeg kan finne firma, sjekke nettside, berike kontaktinfo og lage
              lister over de som trenger nettside.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  disabled={loading}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-3 py-2 text-sm",
              m.role === "user" && "ml-auto bg-sky-500/25 text-white",
              m.role === "assistant" && "bg-white/8 text-slate-100",
              m.role === "status" &&
                "mx-auto max-w-full border border-white/10 bg-white/5 text-center text-xs text-slate-400"
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
                  className="inline-flex text-left text-xs font-semibold text-sky-300 hover:text-sky-200"
                >
                  Åpne listen i Skann →
                </button>
                {m.listName && (
                  <span className="text-[10px] text-slate-400">
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
              className="rounded-lg border border-amber-300/40 bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-amber-400/30"
            >
              Avbryt og start på nytt
            </button>
          </div>
        )}

        {showResumeButton && !loading && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void sendMessage("Start søk igjen")}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:bg-sky-500/30"
            >
              Start søk igjen
            </button>
          </div>
        )}

        {serperUsage && (
          <p
            className={cn(
              "text-center text-xs tabular-nums",
              serperUsage.limitReached ? "text-amber-300" : "text-slate-500"
            )}
          >
            Serper: {serperUsage.used} / {serperUsage.limit}
          </p>
        )}

        {loading && (
          <div
            className="agent-thinking-status"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="agent-thinking-status__dot" aria-hidden="true" />
            {activeTool
              ? `${activeTool.replace(/_/g, " ")}… (steg ${toolStep}/${AGENT_MAX_TOOL_LOOPS})`
              : "Tenker…"}
          </div>
        )}

        </div>
      </div>
    </AppSideDrawer>
  );
}
