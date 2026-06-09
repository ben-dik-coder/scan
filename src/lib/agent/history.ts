import { AGENT_MAX_TOOL_HISTORY_MESSAGES } from "@/lib/agent/constants";
import type { AgentChatMessage } from "@/lib/agent/run-agent";
import type { AgentMessage } from "@/types/database";

/** Konverter lagrede meldinger til OpenAI-historikk inkl. tool-sammendrag. */
export function buildAgentChatHistory(messages: AgentMessage[]): AgentChatMessage[] {
  const history: AgentChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "user" || msg.role === "assistant") {
      history.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (msg.role === "tool" && msg.content.trim()) {
      const label = msg.tool_name?.replace(/_/g, " ") ?? "verktøy";
      history.push({
        role: "assistant",
        content: `[${label}] ${msg.content.trim()}`,
      });
    }
  }

  return trimAgentHistory(history);
}

/** Behold siste meldinger — tool-notater telles med, men begrens total lengde. */
export function trimAgentHistory(history: AgentChatMessage[]): AgentChatMessage[] {
  const max = AGENT_MAX_TOOL_HISTORY_MESSAGES * 2;
  if (history.length <= max) return history;
  return history.slice(-max);
}
