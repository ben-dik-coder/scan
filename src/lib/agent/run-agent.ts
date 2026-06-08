import OpenAI from "openai";
import { AGENT_DISABLED_MESSAGE, AGENT_MAX_TOOL_LOOPS, isAgentEnabled } from "@/lib/agent/constants";
import { executeAgentTool } from "@/lib/agent/execute-tool";
import type { AgentToolContext } from "@/lib/agent/execute-tool";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { AGENT_OPENAI_TOOLS } from "@/lib/agent/tools";

export type AgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string; summary: string }
  | { type: "error"; message: string }
  | {
      type: "list_saved";
      listId: string;
      listName: string;
      url: string;
      orgnrCount: number;
    }
  | {
      type: "done";
      link?: string;
      listId?: string;
      listName?: string;
      orgnrCount?: number;
      content?: string;
    };

export type AgentChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function normalizeAgentModel(raw: string): string {
  const key = raw
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (/gpt[\s-]?5[\s-]?mini/.test(key) || /gtp[\s-]?5[\s-]?mini/.test(key)) {
    return "gpt-5-mini";
  }
  if (/gpt[\s-]?4o[\s-]?mini/.test(key)) return "gpt-4o-mini";
  if (key === "gpt-4o") return "gpt-4o";

  return raw.trim();
}

function getAgentModel(): string {
  const raw = process.env.OPENAI_AGENT_MODEL?.trim();
  if (!raw) return "gpt-5-mini";
  return normalizeAgentModel(raw);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export type AgentChatOptions = {
  systemPromptExtra?: string;
};

type AgentRunSummary = {
  toolSummaries: string[];
  listId?: string;
  listName?: string;
  orgnrCount?: number;
  hitMaxLoops: boolean;
};

export function buildAgentCompletionSummary(summary: AgentRunSummary): string {
  const parts: string[] = [];

  if (summary.listName) {
    const count =
      typeof summary.orgnrCount === "number" && summary.orgnrCount > 0
        ? ` med ${summary.orgnrCount} firma`
        : "";
    parts.push(`Lagret listen «${summary.listName}»${count}.`);
    parts.push("Du finner den under Lagrede målgrupper, eller åpne den i Skann.");
  }

  const usefulSummaries = summary.toolSummaries.filter((s) => s.trim().length > 0);
  if (usefulSummaries.length > 0) {
    parts.push(usefulSummaries.slice(-3).join(" "));
  }

  if (summary.hitMaxLoops) {
    parts.unshift(
      "Jobben tok mange steg og stoppet ved grensen. Her er det som ble gjort:"
    );
  } else if (parts.length === 0) {
    return "Jobben er ferdig, men jeg fikk ikke skrevet et sammendrag. Sjekk statusmeldingene over.";
  } else if (!summary.listName) {
    parts.unshift("Ferdig! Her er resultatet:");
  }

  return parts.join("\n\n");
}

export async function runAgentChat(
  history: AgentChatMessage[],
  ctx: AgentToolContext,
  onEvent: (event: AgentStreamEvent) => void | Promise<void>,
  signal?: AbortSignal,
  options?: AgentChatOptions
): Promise<{ assistantText: string; link?: string }> {
  if (!isAgentEnabled()) {
    const msg = AGENT_DISABLED_MESSAGE;
    await onEvent({ type: "error", message: msg });
    return { assistantText: msg };
  }

  const client = getOpenAIClient();
  if (!client) {
    const msg =
      "AI-agenten er ikke konfigurert ennå (mangler OPENAI_API_KEY). Kontakt support.";
    await onEvent({ type: "error", message: msg });
    return { assistantText: msg };
  }

  const systemPrompt = options?.systemPromptExtra
    ? `${AGENT_SYSTEM_PROMPT}\n\n${options.systemPromptExtra}`
    : AGENT_SYSTEM_PROMPT;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  let assistantText = "";
  let link: string | undefined;
  let listId: string | undefined;
  let listName: string | undefined;
  let orgnrCount: number | undefined;
  const toolSummaries: string[] = [];
  let loops = 0;

  while (loops < AGENT_MAX_TOOL_LOOPS) {
    throwIfAborted(signal);

    const response = await client.chat.completions.create({
      model: getAgentModel(),
      messages,
      tools: AGENT_OPENAI_TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0]?.message;
    if (!choice) break;

    if (choice.content?.trim()) {
      assistantText = choice.content.trim();
      await onEvent({ type: "text", content: assistantText });
    }

    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) break;

    messages.push({
      role: "assistant",
      content: choice.content ?? "",
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      throwIfAborted(signal);
      if (tc.type !== "function") continue;
      const toolName = tc.function.name;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        parsedArgs = {};
      }

      await onEvent({ type: "tool_start", tool: toolName });

      let result;
      try {
        result = await executeAgentTool(ctx, toolName, parsedArgs);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ukjent feil";
        result = { summary: `Feil: ${message}`, data: { error: message } };
      }

      toolSummaries.push(result.summary);
      await onEvent({
        type: "tool_end",
        tool: toolName,
        summary: result.summary,
      });

      if (toolName === "save_list") {
        if (typeof result.data.url === "string") link = result.data.url;
        if (typeof result.data.savedListId === "string") {
          listId = result.data.savedListId;
          const savedCount =
            typeof result.data.orgnrCount === "number"
              ? result.data.orgnrCount
              : 0;
          orgnrCount = savedCount;
          await onEvent({
            type: "list_saved",
            listId: result.data.savedListId,
            listName:
              typeof result.data.listName === "string"
                ? result.data.listName
                : "Ny liste",
            url: typeof result.data.url === "string" ? result.data.url : "/app",
            orgnrCount: savedCount,
          });
        }
        if (typeof result.data.listName === "string") {
          listName = result.data.listName;
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify({
          summary: result.summary,
          ...result.data,
        }),
      });
    }

    loops++;
  }

  const hitMaxLoops = loops >= AGENT_MAX_TOOL_LOOPS;

  if (hitMaxLoops && !assistantText.trim()) {
    await onEvent({
      type: "error",
      message:
        "Agenten stoppet etter for mange steg. Prøv en enklere forespørsel.",
    });
  }

  if (!assistantText.trim()) {
    assistantText = buildAgentCompletionSummary({
      toolSummaries,
      listId,
      listName,
      orgnrCount,
      hitMaxLoops,
    });
    await onEvent({ type: "text", content: assistantText });
  }

  await onEvent({
    type: "done",
    link,
    listId,
    listName,
    orgnrCount,
    content: assistantText,
  });
  return { assistantText, link };
}
