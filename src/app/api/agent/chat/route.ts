import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import {
  createConversation,
  createRun,
  deriveConversationTitle,
  finishRun,
  getActiveRunForUser,
  loadConversationMessages,
  saveMessage,
} from "@/lib/agent/conversations";
import { runAgentChat } from "@/lib/agent/run-agent";
import { isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user && !isDemoMode()) {
    return new Response(JSON.stringify({ error: "Du må være innlogget." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (user && !isDemoMode()) {
    const entitlements = await getEntitlements(user.id);
    if (!entitlements.hasAccess) {
      return new Response(
        JSON.stringify({ error: "Aktivt abonnement kreves." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let body: { message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ugyldig JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "Melding mangler" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (user && !isDemoMode()) {
    const active = await getActiveRunForUser(user.id);
    if (active) {
      return new Response(
        JSON.stringify({
          error: "En agent-jobb kjører allerede. Vent til den er ferdig.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let conversationId = body.conversationId;
  if (!conversationId && user && !isDemoMode()) {
    const conv = await createConversation(user.id, deriveConversationTitle(message));
    conversationId = conv.id;
  } else if (!conversationId) {
    conversationId = `demo-${Date.now()}`;
  }

  const run =
    user && !isDemoMode()
      ? await createRun(user.id, conversationId, { message })
      : { id: `demo-run-${Date.now()}` };

  if (user && !isDemoMode()) {
    await saveMessage(conversationId, "user", message);
  }

  const priorMessages =
    user && !isDemoMode() && body.conversationId
      ? await loadConversationMessages(conversationId, user.id)
      : [];

  const history = priorMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (!body.conversationId || history.length === 0) {
    history.push({ role: "user", content: message });
  } else if (history[history.length - 1]?.content !== message) {
    history.push({ role: "user", content: message });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseLine(data)));
      };

      send({ type: "conversation", conversationId });

      try {
        const { assistantText, link } = await runAgentChat(
          history,
          { userId: user?.id ?? "demo", runId: run.id },
          async (event) => {
            if (event.type === "text") {
              send({ type: "text", content: event.content });
            } else if (event.type === "tool_start") {
              send({ type: "tool_start", tool: event.tool });
            } else if (event.type === "tool_end") {
              send({
                type: "tool_end",
                tool: event.tool,
                summary: event.summary,
              });
            } else if (event.type === "error") {
              send({ type: "error", message: event.message });
            } else if (event.type === "list_saved") {
              send({
                type: "list_saved",
                listId: event.listId,
                listName: event.listName,
                url: event.url,
                orgnrCount: event.orgnrCount,
              });
            } else if (event.type === "done") {
              send({
                type: "done",
                link: event.link,
                listId: event.listId,
                listName: event.listName,
              });
            }
          }
        );

        if (user && !isDemoMode() && assistantText) {
          await saveMessage(conversationId!, "assistant", assistantText);
        }

        if (user && !isDemoMode()) {
          await finishRun(
            run.id,
            { assistantText, link: link ?? null },
            "done"
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Ukjent feil";
        send({ type: "error", message: errMsg });
        if (user && !isDemoMode()) {
          await finishRun(run.id, null, "failed", errMsg);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
