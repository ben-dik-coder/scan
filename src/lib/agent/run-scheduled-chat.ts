import { getEntitlements } from "@/lib/billing/entitlements";
import {
  cancelRun,
  createConversation,
  createRun,
  deriveConversationTitle,
  finishRun,
  getActiveRunForUser,
  getLastResumableRunForConversation,
  loadConversationMessagesForUser,
  saveMessage,
} from "@/lib/agent/conversations";
import {
  buildAgentStartupContextPrompt,
  loadAgentStartupContext,
} from "@/lib/agent/context";
import { buildAgentChatHistory } from "@/lib/agent/history";
import {
  buildAgentCancelledRunContextPrompt,
  buildAgentResumePrompt,
  isAgentPostCancelFollowUp,
  isAgentResumeIntent,
} from "@/lib/agent/prompt";
import { runAgentChat } from "@/lib/agent/run-agent";
import { formatSearchToolPersistContent } from "@/lib/agent/fast-list";

export type ScheduledChatResult = {
  conversationId: string;
  assistantText: string;
  link?: string;
  listId?: string;
  listName?: string;
};

async function executeAgentRound(
  userId: string,
  conversationId: string,
  message: string,
  existingConversation: boolean
): Promise<ScheduledChatResult & { needsSaveConfirm: boolean }> {
  const active = await getActiveRunForUser(userId);
  if (active) {
    await cancelRun(active.id, "Avbrutt for planlagt melding");
  }

  const run = await createRun(userId, conversationId, { message, scheduled: true });
  await saveMessage(conversationId, "user", message);

  const [priorMessages, startup, lastRun] = await Promise.all([
    existingConversation
      ? loadConversationMessagesForUser(conversationId, userId)
      : Promise.resolve([]),
    loadAgentStartupContext(userId),
    getLastResumableRunForConversation(conversationId, userId),
  ]);

  const history = buildAgentChatHistory(priorMessages);
  if (!existingConversation || history.length === 0) {
    history.push({ role: "user", content: message });
  } else if (history[history.length - 1]?.content !== message) {
    history.push({ role: "user", content: message });
  }

  const systemPromptParts: string[] = [];
  if (startup) {
    systemPromptParts.push(buildAgentStartupContextPrompt(startup));
  }
  if (lastRun) {
    if (isAgentResumeIntent(message)) {
      systemPromptParts.push(buildAgentResumePrompt(lastRun));
    } else if (isAgentPostCancelFollowUp(message)) {
      systemPromptParts.push(buildAgentCancelledRunContextPrompt(lastRun));
    }
  }

  let needsSaveConfirm = false;
  let link: string | undefined;
  let listId: string | undefined;
  let listName: string | undefined;

  const { assistantText, link: resultLink } = await runAgentChat(
    history,
    { userId, runId: run.id },
    async (event) => {
      if (event.type === "confirm_save") {
        needsSaveConfirm = true;
      } else if (event.type === "list_saved") {
        listId = event.listId;
        listName = event.listName;
        link = event.url;
      } else if (event.type === "done") {
        if (event.link) link = event.link;
        if (event.listId) listId = event.listId;
        if (event.listName) listName = event.listName;
      }
    },
    undefined,
    {
      systemPromptExtra:
        systemPromptParts.length > 0 ? systemPromptParts.join("\n\n") : undefined,
      onToolComplete: async (tool, summary, data) => {
        let content = summary;
        if (tool === "search_companies" && Array.isArray(data.orgnrs)) {
          const orgnrs = (data.orgnrs as string[]).filter(
            (orgnr) => typeof orgnr === "string" && orgnr.trim()
          );
          content = formatSearchToolPersistContent(summary, orgnrs);
        }
        await saveMessage(conversationId, "tool", content, { tool_name: tool });
      },
    }
  );

  if (assistantText) {
    await saveMessage(conversationId, "assistant", assistantText);
  }

  await finishRun(run.id, { assistantText, link: link ?? resultLink ?? null }, "done");

  return {
    conversationId,
    assistantText,
    link: link ?? resultLink,
    listId,
    listName,
    needsSaveConfirm,
  };
}

export async function runScheduledAgentChat(
  userId: string,
  message: string,
  conversationId?: string | null
): Promise<ScheduledChatResult> {
  const entitlements = await getEntitlements(userId);
  if (!entitlements.hasAccess) {
    throw new Error("Aktivt abonnement kreves.");
  }

  let convId = conversationId ?? null;
  const existingConversation = Boolean(convId);

  if (!convId) {
    const conv = await createConversation(userId, deriveConversationTitle(message));
    convId = conv.id;
  }

  let result = await executeAgentRound(
    userId,
    convId,
    message,
    existingConversation
  );

  if (result.needsSaveConfirm && !result.listId) {
    result = await executeAgentRound(
      userId,
      convId,
      "Ja, lagre listen",
      true
    );
  }

  return {
    conversationId: convId,
    assistantText: result.assistantText,
    link: result.link,
    listId: result.listId,
    listName: result.listName,
  };
}
