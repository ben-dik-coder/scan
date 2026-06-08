/** Åpne AI-assistenten fra andre deler av appen (f.eks. AI samtaler). */
export const AGENT_CHAT_OPEN_EVENT = "nylead:agent-chat-open";
export const AGENT_CONV_STORAGE_KEY = "nylead:agent-conversation-id";

export type AgentChatOpenDetail = {
  conversationId?: string;
};

export function openAgentChat(detail: AgentChatOpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AGENT_CHAT_OPEN_EVENT, { detail })
  );
}

export function getStoredAgentConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AGENT_CONV_STORAGE_KEY);
}

export function setStoredAgentConversationId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    sessionStorage.setItem(AGENT_CONV_STORAGE_KEY, id);
  } else {
    sessionStorage.removeItem(AGENT_CONV_STORAGE_KEY);
  }
}
