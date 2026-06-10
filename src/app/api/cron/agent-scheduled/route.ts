import { NextResponse } from "next/server";
import { isAgentEnabled } from "@/lib/agent/constants";
import { runScheduledAgentChat } from "@/lib/agent/run-scheduled-chat";
import {
  claimDueScheduledMessages,
  finishScheduledMessage,
} from "@/lib/agent/scheduled-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAgentEnabled()) {
    return NextResponse.json({ skipped: true, reason: "agent disabled" });
  }

  const results: Array<{
    id: string;
    status: "done" | "failed";
    error?: string;
  }> = [];

  try {
    const due = await claimDueScheduledMessages(5);

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

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
