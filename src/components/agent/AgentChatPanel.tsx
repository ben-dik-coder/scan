"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notifySavedListChanged } from "@/lib/agent/saved-list-bus";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles } from "lucide-react";

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

export function AgentChatFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="agent-chat-fab fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/90 text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-400 hover:scale-105 active:scale-95"
      aria-label="Åpne AI-assistent"
      title="AI-assistent"
    >
      <Sparkles className="h-6 w-6" />
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
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput("");
      appendMessage({ role: "user", content: trimmed });
      setLoading(true);
      setActiveTool(null);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationId ?? undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          appendMessage({
            role: "assistant",
            content:
              typeof err.error === "string"
                ? err.error
                : "Noe gikk galt. Prøv igjen.",
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
            } else if (
              event.type === "tool_end" &&
              typeof event.summary === "string"
            ) {
              setActiveTool(null);
              appendMessage({ role: "status", content: event.summary });
            } else if (event.type === "error" && typeof event.message === "string") {
              assistantText = event.message;
            } else if (event.type === "list_saved") {
              if (typeof event.listId === "string") savedListId = event.listId;
              if (typeof event.listName === "string") savedListName = event.listName;
              if (typeof event.url === "string") resultLink = event.url;
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
            }
          }
        }

        if (assistantText) {
          appendMessage({
            role: "assistant",
            content: assistantText,
            link: resultLink,
            listId: savedListId,
            listName: savedListName,
          });
        }
      } catch {
        appendMessage({
          role: "assistant",
          content: "Kunne ikke nå agenten. Sjekk nettverket og prøv igjen.",
        });
      } finally {
        setLoading(false);
        setActiveTool(null);
      }
    },
    [appendMessage, conversationId, loading]
  );

  return (
    <AppSideDrawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-400" />
          AI-assistent
        </span>
      }
      maxWidth="md"
      panelClassName="flex flex-col"
      footer={
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
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      }
    >
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
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

        {loading && activeTool && (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {activeTool.replace(/_/g, " ")}…
          </p>
        )}
      </div>
    </AppSideDrawer>
  );
}
