import OpenAI from "openai";
import {
  AGENT_DISABLED_MESSAGE,
  AGENT_MAX_TOOL_LOOPS,
  AGENT_MAX_TOOL_LOOPS_SIMPLE_SEARCH,
  isAgentEnabled,
} from "@/lib/agent/constants";
import { executeAgentTool } from "@/lib/agent/execute-tool";
import type { AgentToolContext, ToolExecutionResult } from "@/lib/agent/execute-tool";
import {
  formatFastListReply,
  isSimpleListIntent,
  parseSimpleListRequest,
  type SimpleListCompany,
} from "@/lib/agent/fast-list";
import {
  AGENT_SYSTEM_PROMPT,
  AGENT_FINAL_SUMMARY_NUDGE,
  isSimpleSearchIntent,
} from "@/lib/agent/prompt";
import { AGENT_OPENAI_TOOLS } from "@/lib/agent/tools";
import { compactToolResultForModel } from "@/lib/agent/tool-payload";

export type AgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "text_delta"; content: string }
  | { type: "tool_start"; tool: string }
  | {
      type: "tool_progress";
      tool: string;
      scanned: number;
      total: number;
    }
  | { type: "tool_end"; tool: string; summary: string }
  | { type: "error"; message: string }
  | {
      type: "confirm_save";
      count: number;
      orgnrs: string[];
      message: string;
    }
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
  onToolComplete?: (tool: string, summary: string, data: Record<string, unknown>) => Promise<void>;
};

type AgentRunSummary = {
  toolSummaries: string[];
  listId?: string;
  listName?: string;
  orgnrCount?: number;
  hitMaxLoops: boolean;
};

export function needsConcreteSummary(assistantText: string, hadTools: boolean): boolean {
  if (!hadTools) return false;
  const text = assistantText.trim();
  if (!text) return true;

  const hasNumbers = /\d/.test(text);
  const hasExamples = /f\.?eks\.| — |«|»/i.test(text);
  if (hasNumbers && hasExamples) return false;
  if (hasNumbers && text.length >= 90) return false;

  if (text.length < 70) return true;
  if (!hasNumbers) return true;
  if (
    /^(jeg (skal|har)|la meg|ok[,! ]|greit[,! ]|fint[,! ])/i.test(text) &&
    text.length < 140
  ) {
    return true;
  }
  return false;
}

function isConcreteEnoughText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 70 && /\d/.test(trimmed);
}

function shouldSkipSynthesis(
  toolsUsed: Set<string>,
  toolSummaries: string[]
): boolean {
  if (!toolsUsed.has("search_companies")) return false;
  if (
    toolsUsed.has("scan_websites") ||
    toolsUsed.has("filter_no_website") ||
    toolsUsed.has("enrich_contacts") ||
    toolsUsed.has("save_list")
  ) {
    return false;
  }

  const searchSummary =
    toolSummaries.find((summary) => /Fant \d+ firma/.test(summary)) ?? "";
  return searchSummary.length > 0;
}

async function synthesizeAgentReply(
  client: OpenAI,
  toolSummaries: string[],
  partialReply: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);

  const useful = toolSummaries.filter((s) => s.trim().length > 0).slice(-5);
  if (useful.length === 0) return "";

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Du skriver korte, konkrete svar på norsk til en B2B-selger basert på verktøy-resultater.",
      },
      {
        role: "user",
        content: `Verktøy-resultater:\n${useful.join("\n")}${
          partialReply.trim() ? `\n\nUfullstendig svar fra assistent: ${partialReply.trim()}` : ""
        }\n\n${AGENT_FINAL_SUMMARY_NUDGE}`,
      },
    ],
    tool_choice: "none",
    // gpt-5-modeller godtar ikke `max_tokens`; resonneringstokens trekkes
    // fra samme budsjett, så vi gir litt ekstra rom over de ~450 synlige.
    max_completion_tokens: 1200,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

type StreamedAssistantMessage = {
  content: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
};

async function streamAssistantCompletion(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model: string,
  onTextDelta: (delta: string) => Promise<void>,
  signal?: AbortSignal
): Promise<StreamedAssistantMessage> {
  throwIfAborted(signal);

  const stream = await client.chat.completions.create({
    model,
    messages,
    tools: AGENT_OPENAI_TOOLS,
    tool_choice: "auto",
    stream: true,
  });

  let content = "";
  const toolCallsByIndex = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  for await (const chunk of stream) {
    throwIfAborted(signal);
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      await onTextDelta(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let existing = toolCallsByIndex.get(idx);
        if (!existing) {
          existing = {
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            arguments: "",
          };
          toolCallsByIndex.set(idx, existing);
        }
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
      }
    }
  }

  const tool_calls =
    toolCallsByIndex.size > 0
      ? Array.from(toolCallsByIndex.entries())
          .sort(([a], [b]) => a - b)
          .map(([, tc]) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          }))
      : undefined;

  return { content, tool_calls };
}

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
    parts.unshift("Jobben tok mange steg og stoppet ved grensen.");
  } else if (parts.length === 0) {
    return "Ferdig — men jeg fikk ikke skrevet et godt sammendrag. Se statusmeldingene over, eller spør meg «hva fant du?»";
  } else if (!summary.listName) {
    parts.unshift("Oppsummert:");
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
  const toolsUsed = new Set<string>();
  let loops = 0;
  const model = getAgentModel();
  const lastUserMessage =
    [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const maxToolLoops = isSimpleSearchIntent(lastUserMessage)
    ? AGENT_MAX_TOOL_LOOPS_SIMPLE_SEARCH
    : AGENT_MAX_TOOL_LOOPS;
  const toolCtx: AgentToolContext = {
    ...ctx,
    onProgress: async (progress) => {
      await onEvent({ type: "tool_progress", ...progress });
    },
  };

  if (isSimpleListIntent(lastUserMessage)) {
    const parsed = parseSimpleListRequest(lastUserMessage);
    if (parsed) {
      await onEvent({ type: "tool_start", tool: "search_companies" });
      let result: ToolExecutionResult;
      try {
        result = await executeAgentTool(
          toolCtx,
          "search_companies",
          parsed.searchArgs
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ukjent feil";
        result = { summary: `Feil: ${message}`, data: { error: message } };
      }

      await onEvent({
        type: "tool_end",
        tool: "search_companies",
        summary: result.summary,
      });

      const companies = Array.isArray(result.data.companies)
        ? (result.data.companies as SimpleListCompany[])
        : [];
      assistantText = formatFastListReply(companies, parsed);
      await onEvent({ type: "text", content: assistantText });
      await onEvent({ type: "done", content: assistantText });
      return { assistantText };
    }
  }

  while (loops < maxToolLoops) {
    throwIfAborted(signal);

    let streamedContent = "";
    const choice = await streamAssistantCompletion(
      client,
      messages,
      model,
      async (delta) => {
        streamedContent += delta;
        await onEvent({ type: "text_delta", content: delta });
      },
      signal
    );

    if (choice.content?.trim()) {
      assistantText = choice.content.trim();
    } else if (streamedContent.trim()) {
      assistantText = streamedContent.trim();
    }

    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) break;

    messages.push({
      role: "assistant",
      content: choice.content ?? "",
      tool_calls: toolCalls,
    });

    const executedTools = await Promise.all(
      toolCalls.map(async (tc) => {
        throwIfAborted(signal);
        if (tc.type !== "function") {
          return {
            tc,
            toolName: "unknown",
            result: {
              summary: "Ukjent verktøytype",
              data: { error: "Ukjent verktøytype" },
            } satisfies ToolExecutionResult,
          };
        }

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

        let result: ToolExecutionResult;
        try {
          result = await executeAgentTool(toolCtx, toolName, parsedArgs);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Ukjent feil";
          result = { summary: `Feil: ${message}`, data: { error: message } };
        }

        return { tc, toolName, result };
      })
    );

    for (const { tc, toolName, result } of executedTools) {
      if (toolName === "unknown") continue;

      toolsUsed.add(toolName);
      toolSummaries.push(result.summary);
      await onEvent({
        type: "tool_end",
        tool: toolName,
        summary: result.summary,
      });

      if (options?.onToolComplete) {
        await options.onToolComplete(toolName, result.summary, result.data);
      }

      if (toolName === "filter_no_website") {
        const count =
          typeof result.data.count === "number" ? result.data.count : 0;
        const orgnrs = Array.isArray(result.data.orgnrs)
          ? (result.data.orgnrs as string[])
          : [];
        if (count > 0) {
          await onEvent({
            type: "confirm_save",
            count,
            orgnrs,
            message: `Fant ${count} firma uten nettside. Vil du lagre som liste?`,
          });
        }
      }

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
        content: JSON.stringify(compactToolResultForModel(result)),
      });
    }

    loops++;
  }

  const hitMaxLoops = loops >= maxToolLoops;
  const hadTools = toolSummaries.length > 0;
  const runSummary: AgentRunSummary = {
    toolSummaries,
    listId,
    listName,
    orgnrCount,
    hitMaxLoops,
  };

  if (hitMaxLoops && !assistantText.trim()) {
    await onEvent({
      type: "error",
      message:
        "Agenten stoppet etter for mange steg. Prøv en enklere forespørsel.",
    });
  }

  if (needsConcreteSummary(assistantText, hadTools)) {
    const builtSummary = buildAgentCompletionSummary(runSummary);
    if (
      shouldSkipSynthesis(toolsUsed, toolSummaries) ||
      isConcreteEnoughText(builtSummary)
    ) {
      assistantText = builtSummary;
      await onEvent({ type: "text", content: assistantText });
    } else {
      const synthesized = await synthesizeAgentReply(
        client,
        toolSummaries,
        assistantText,
        model,
        signal
      ).catch(() => "");
      if (synthesized.trim()) {
        assistantText = synthesized.trim();
        await onEvent({ type: "text", content: assistantText });
      } else if (builtSummary.trim()) {
        assistantText = builtSummary.trim();
        await onEvent({ type: "text", content: assistantText });
      }
    }
  }

  if (!assistantText.trim()) {
    assistantText = buildAgentCompletionSummary(runSummary);
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
