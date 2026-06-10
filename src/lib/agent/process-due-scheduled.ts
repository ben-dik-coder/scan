import { runScheduledAgentChat } from "@/lib/agent/run-scheduled-chat";
import {
  claimDueScheduledMessages,
  finishScheduledMessage,
} from "@/lib/agent/scheduled-messages";

export type ProcessDueScheduledResult = {
  processed: number;
  results: Array<{
    id: string;
    status: "done" | "failed";
    error?: string;
  }>;
};

export async function processDueScheduledMessages(
  limit = 5
): Promise<ProcessDueScheduledResult> {
  const results: ProcessDueScheduledResult["results"] = [];
  const due = await claimDueScheduledMessages(limit);

  for (const item of due) {
    try {
      const chatResult = await runScheduledAgentChat(
        item.user_id,
        item.message,
        item.conversation_id
      );

      await finishScheduledMessage(
        item.id,
        "done",
        {
          assistantText: chatResult.assistantText,
          link: chatResult.link ?? null,
          listId: chatResult.listId ?? null,
          listName: chatResult.listName ?? null,
        },
        undefined,
        chatResult.conversationId
      );

      results.push({ id: item.id, status: "done" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ukjent feil";
      await finishScheduledMessage(item.id, "failed", null, errorMessage);
      results.push({ id: item.id, status: "failed", error: errorMessage });
    }
  }

  return { processed: results.length, results };
}
