"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentRobotIcon } from "@/components/agent/AgentRobotIcon";
import {
  getStoredAgentConversationId,
  openAgentChat,
} from "@/lib/agent/agent-chat-bus";
import { MAX_AGENT_CONVERSATIONS } from "@/lib/agent/constants";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus } from "lucide-react";

type ConversationItem = {
  id: string;
  title: string;
  updated_at: string;
  preview: string | null;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AiSamtalerClient() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/conversations");
      const data = (await res.json()) as {
        conversations?: ConversationItem[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke hente samtaler");
      }

      setConversations(data.conversations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    setActiveId(getStoredAgentConversationId());
  }, [load]);

  useEffect(() => {
    function refreshActive() {
      setActiveId(getStoredAgentConversationId());
    }

    window.addEventListener("focus", refreshActive);
    window.addEventListener("storage", refreshActive);
    return () => {
      window.removeEventListener("focus", refreshActive);
      window.removeEventListener("storage", refreshActive);
    };
  }, []);

  function openConversation(id: string) {
    setActiveId(id);
    openAgentChat({ conversationId: id });
  }

  function startNewChat() {
    setActiveId(null);
    openAgentChat();
  }

  return (
    <div className="scan-glass-kommand mx-auto w-full max-w-2xl space-y-4">
      <header className="scan-glass-header rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="scan-glass-title flex items-center gap-2 text-xl">
              <MessageSquare className="h-5 w-5 text-sky-300" />
              AI samtaler
            </h1>
            <p className="scan-glass-subtitle mt-1 text-sm">
              Du kan ha opptil {MAX_AGENT_CONVERSATIONS} samtaler. Den eldste
              flyttes bort når du starter en ny.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/30"
          >
            <Plus className="h-4 w-4" />
            Ny samtale
          </button>
        </div>
      </header>

      {loading && (
        <p className="scan-glass-muted px-1 text-sm">Laster samtaler…</p>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="scan-glass-header rounded-2xl p-6 text-center">
          <AgentRobotIcon size={48} className="mx-auto mb-3 opacity-90" />
          <p className="text-sm text-slate-200">
            Ingen samtaler ennå — åpne AI-assistenten
          </p>
          <button
            type="button"
            onClick={startNewChat}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            <AgentRobotIcon size={18} />
            Start AI-assistent
          </button>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <ul className="space-y-2">
          {conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => openConversation(conv.id)}
                  className={cn(
                    "scan-glass-header w-full rounded-2xl p-4 text-left transition",
                    isActive
                      ? "ring-2 ring-sky-400/50 ring-offset-2 ring-offset-transparent"
                      : "hover:border-sky-400/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {conv.title || "Ny samtale"}
                      </p>
                      {conv.preview && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                          {conv.preview}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {isActive && (
                        <span className="mb-1 inline-block rounded-full bg-sky-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                          Aktiv
                        </span>
                      )}
                      <p className="scan-glass-muted text-xs tabular-nums">
                        {formatWhen(conv.updated_at)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
