import { NextRequest } from "next/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import {
  cancelRun,
  createConversation,
  createRun,
  touchAgentRun,
  deriveConversationTitle,
  finishRun,
  getActiveRunForUser,
  getLastResumableRunForConversation,
  loadConversationMessages,
  loadConversationMessagesForUser,
  saveMessage,
} from "@/lib/agent/conversations";
import {
  AGENT_DISABLED_MESSAGE,
  AGENT_SSE_HEARTBEAT_MS,
  isAgentEnabled,
} from "@/lib/agent/constants";
import {
  buildAgentStartupContextPrompt,
  loadAgentStartupContext,
} from "@/lib/agent/context";
import { buildAgentChatHistory } from "@/lib/agent/history";
import {
  isAgentResumeIntent,
  isAgentPostCancelFollowUp,
  buildAgentResumePrompt,
  buildAgentCancelledRunContextPrompt,
} from "@/lib/agent/prompt";
import { buildAgentCompletionSummary, runAgentChat } from "@/lib/agent/run-agent";
import { isLikelyTruncatedAgentResponse } from "@/lib/agent/response-complete";
import {
  resolveAgentRequestAuth,
  shouldPersistAgentData,
} from "@/lib/agent/service-auth";
import { isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  if (!isAgentEnabled()) {
    return new Response(JSON.stringify({ error: AGENT_DISABLED_MESSAGE }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user, isServiceAuth } = auth;
  const persist = shouldPersistAgentData(user, isServiceAuth);

  if (!user && !isDemoMode()) {
    return new Response(JSON.stringify({ error: "Du må være innlogget." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (user && persist && !isServiceAuth) {
    const entitlements = await getEntitlements(user.id);
    if (!entitlements.hasAccess) {
      return new Response(
        JSON.stringify({ error: "Aktivt abonnement kreves." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let body: { message?: string; conversationId?: string; cancelPrevious?: boolean };
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

  if (persist) {
    const active = await getActiveRunForUser(user.id);
    if (active) {
      // Auto-avbryt hengende/forrige kjøring når bruker sender ny melding.
      await cancelRun(active.id, "Avbrutt for å starte ny melding");
    }
  }

  let conversationId = body.conversationId;
  if (!conversationId && persist) {
    const conv = await createConversation(user.id, deriveConversationTitle(message));
    conversationId = conv.id;
  } else if (!conversationId) {
    conversationId = `demo-${Date.now()}`;
  }

  const run = persist
    ? await createRun(user.id, conversationId, { message })
    : { id: `demo-run-${Date.now()}` };

  if (persist) {
    await saveMessage(conversationId, "user", message);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let runFinished = false;
      let doneSent = false;
      let lastAssistantText = "";
      const toolSummaries: string[] = [];
      const completeRun = async (
        status: "done" | "failed",
        result: Record<string, unknown> | null = null,
        errorMessage?: string
      ) => {
        if (runFinished || !persist) return;
        runFinished = true;
        await finishRun(run.id, result, status, errorMessage);
      };

      const onAbort = () => {
        void completeRun("failed", null, "Stoppet av bruker");
      };
      request.signal.addEventListener("abort", onAbort, { once: true });

      const send = (data: Record<string, unknown>) => {
        if (request.signal.aborted) return;
        controller.enqueue(encoder.encode(sseLine(data)));
      };

      const heartbeat = setInterval(() => {
        if (request.signal.aborted) return;
        send({ type: "ping" });
        if (persist) {
          void touchAgentRun(run.id);
        }
      }, AGENT_SSE_HEARTBEAT_MS);

      send({ type: "conversation", conversationId });
      send({ type: "run", runId: run.id });

      try {
        const [priorMessages, startup, lastRun] = await Promise.all([
          persist && body.conversationId
            ? isServiceAuth
              ? loadConversationMessagesForUser(conversationId, user.id)
              : loadConversationMessages(conversationId, user.id)
            : Promise.resolve([]),
          persist ? loadAgentStartupContext(user.id) : Promise.resolve(null),
          persist && conversationId
            ? getLastResumableRunForConversation(conversationId, user.id)
            : Promise.resolve(null),
        ]);

        const history = buildAgentChatHistory(priorMessages);

        if (!body.conversationId || history.length === 0) {
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

        const systemPromptExtra =
          systemPromptParts.length > 0 ? systemPromptParts.join("\n\n") : undefined;

        const { assistantText: agentText, link } = await runAgentChat(
          history,
          { userId: user?.id ?? "demo", runId: run.id },
          async (event) => {
            if (request.signal.aborted) return;
            if (event.type === "text") {
              if (event.content.trim()) lastAssistantText = event.content;
              send({ type: "text", content: event.content });
            } else if (event.type === "text_delta") {
              lastAssistantText += event.content;
              send({ type: "text_delta", content: event.content });
            } else if (event.type === "tool_start") {
              send({
                type: "tool_start",
                tool: event.tool,
                label: event.label,
              });
            } else if (event.type === "tool_progress") {
              send({
                type: "tool_progress",
                tool: event.tool,
                scanned: event.scanned,
                total: event.total,
              });
            } else if (event.type === "tool_end") {
              toolSummaries.push(event.summary);
              send({
                type: "tool_end",
                tool: event.tool,
                summary: event.summary,
              });
            } else if (event.type === "confirm_save") {
              send({
                type: "confirm_save",
                count: event.count,
                orgnrs: event.orgnrs,
                message: event.message,
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
              doneSent = true;
              if (typeof event.content === "string" && event.content.trim()) {
                lastAssistantText = event.content;
              }
              send({
                type: "done",
                link: event.link,
                listId: event.listId,
                listName: event.listName,
                orgnrCount: event.orgnrCount,
                content: lastAssistantText || event.content,
              });
            }
          },
          request.signal,
          {
            systemPromptExtra,
            onToolComplete: persist
              ? async (tool, summary) => {
                  await saveMessage(conversationId!, "tool", summary, {
                    tool_name: tool,
                  });
                }
              : undefined,
          }
        );

        if (request.signal.aborted) {
          await completeRun("failed", null, "Stoppet av bruker");
          return;
        }

        const assistantText = agentText.trim() || lastAssistantText.trim();
        if (!doneSent) {
          let fallbackText = assistantText;
          if (
            !fallbackText ||
            isLikelyTruncatedAgentResponse(fallbackText)
          ) {
            const built = buildAgentCompletionSummary({
              toolSummaries,
              hitMaxLoops: false,
            });
            if (built.trim()) fallbackText = built;
          }
          if (fallbackText) {
            send({ type: "text", content: fallbackText });
          }
          send({
            type: "done",
            link,
            content: fallbackText || undefined,
          });
          doneSent = true;
        }

        if (persist && assistantText) {
          await saveMessage(conversationId!, "assistant", assistantText);
        }

        if (persist) {
          await completeRun("done", { assistantText, link: link ?? null });
        }
      } catch (err) {
        if (
          request.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          await completeRun("failed", null, "Stoppet av bruker");
          return;
        }
        const errMsg = err instanceof Error ? err.message : "Ukjent feil";
        if (!doneSent) {
          const built = buildAgentCompletionSummary({
            toolSummaries,
            hitMaxLoops: false,
          });
          const fallbackText = lastAssistantText.trim() || built.trim();
          if (fallbackText) {
            send({ type: "text", content: fallbackText });
            send({ type: "done", content: fallbackText });
            doneSent = true;
            if (persist && conversationId) {
              await saveMessage(conversationId, "assistant", fallbackText);
            }
            await completeRun("done", { assistantText: fallbackText, link: null });
          } else {
            send({ type: "error", message: errMsg });
            await completeRun("failed", null, errMsg);
          }
        } else {
          send({ type: "error", message: errMsg });
          await completeRun("failed", null, errMsg);
        }
      } finally {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", onAbort);
        if (!doneSent && !request.signal.aborted) {
          const built = buildAgentCompletionSummary({
            toolSummaries,
            hitMaxLoops: false,
          });
          const fallbackText = lastAssistantText.trim() || built.trim();
          if (fallbackText) {
            send({ type: "text", content: fallbackText });
            send({ type: "done", content: fallbackText });
            doneSent = true;
            if (persist && conversationId) {
              await saveMessage(conversationId, "assistant", fallbackText);
            }
            await completeRun("done", { assistantText: fallbackText, link: null });
          }
        }
        if (persist && !runFinished) {
          await completeRun("failed", null, "Avsluttet uten fullføring");
        }
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
