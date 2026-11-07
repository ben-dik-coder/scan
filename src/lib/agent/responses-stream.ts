import OpenAI from "openai";
import { AGENT_OPENAI_TOOLS, AGENT_RESPONSES_TOOLS } from "@/lib/agent/tools";

export type StreamedResponsesTurn = {
  responseId: string;
  content: string;
  functionCalls: Array<{
    call_id: string;
    name: string;
    arguments: string;
  }>;
};

type ResponsesCreateOptions = Parameters<OpenAI["responses"]["create"]>[0];
type StreamEvent = {
  type?: string;
  delta?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  item_id?: string;
  response?: {
    id?: string;
    output?: unknown[];
    error?: { message?: string } | null;
  };
  item?: unknown;
  error?: { message?: string } | null;
};

function asFunctionCall(
  item: unknown
): StreamedResponsesTurn["functionCalls"][number] | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  if (value.type !== "function_call") return null;

  const callId =
    typeof value.call_id === "string"
      ? value.call_id
      : typeof value.id === "string"
        ? value.id
        : "";
  const name = typeof value.name === "string" ? value.name : "";
  const args = typeof value.arguments === "string" ? value.arguments : "{}";
  return callId && name ? { call_id: callId, name, arguments: args } : null;
}

function modelSupportsReasoning(model: string): boolean {
  const key = model.toLowerCase();
  if (key.includes("mini") || key.includes("nano")) return false;
  return (
    key.includes("sol") ||
    key.includes("gpt-5.2") ||
    key.includes("gpt-5.4") ||
    key.includes("gpt-5.5") ||
    key.includes("gpt-5.6") ||
    key.includes("o3") ||
    key.includes("o4")
  );
}

function isRetryableToolConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /web_search_preview|web search|hosted tool|reasoning|unsupported|unknown parameter|invalid/i.test(
    message
  );
}

export async function streamResponsesTurn(options: {
  client: OpenAI;
  model: string;
  instructions?: string;
  input: OpenAI.Responses.ResponseInput;
  previousResponseId?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  onTextDelta: (delta: string) => Promise<void>;
  onThinkingDelta: (delta: string) => Promise<void>;
  onWebSearch?: (status: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<StreamedResponsesTurn> {
  const createStream = async (opts: {
    includeHostedWebSearch: boolean;
    includeReasoning: boolean;
  }) => {
    const tools = opts.includeHostedWebSearch
      ? AGENT_RESPONSES_TOOLS
      : AGENT_RESPONSES_TOOLS.filter((tool) => tool.type !== "web_search_preview");

    const body: Record<string, unknown> = {
      model: options.model,
      instructions: options.instructions,
      input: options.input,
      previous_response_id: options.previousResponseId,
      tools,
      tool_choice: "auto",
      stream: true,
      store: true,
      max_output_tokens: 4096,
    };

    if (opts.includeReasoning && modelSupportsReasoning(options.model)) {
      body.reasoning = {
        effort: options.reasoningEffort ?? "medium",
        summary: "auto",
      };
    }

    return options.client.responses.create(
      body as unknown as ResponsesCreateOptions,
      { signal: options.signal }
    );
  };

  const attempts = [
    { includeHostedWebSearch: true, includeReasoning: true },
    { includeHostedWebSearch: false, includeReasoning: true },
    { includeHostedWebSearch: false, includeReasoning: false },
  ];

  let stream: Awaited<ReturnType<typeof createStream>> | null = null;
  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      stream = await createStream(attempt);
      break;
    } catch (error) {
      lastError = error;
      if (!isRetryableToolConfigError(error)) throw error;
    }
  }
  if (!stream) {
    throw lastError instanceof Error
      ? lastError
      : new Error("OpenAI Responses-kallet feilet");
  }

  let responseId = "";
  let content = "";
  const calls = new Map<string, StreamedResponsesTurn["functionCalls"][number]>();
  const pendingArgs = new Map<
    string,
    { call_id: string; name: string; arguments: string }
  >();

  const collectItems = (items: unknown[] | undefined) => {
    for (const item of items ?? []) {
      const call = asFunctionCall(item);
      if (call) calls.set(call.call_id, call);
    }
  };

  for await (const rawEvent of stream as AsyncIterable<OpenAI.Responses.ResponseStreamEvent>) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const event = rawEvent as unknown as StreamEvent;
    const type = event.type ?? "";
    if (type === "response.created" || type === "response.completed") {
      responseId = event.response?.id ?? responseId;
    }

    if (type === "response.output_text.delta" || type === "response.text.delta") {
      const delta = event.delta ?? "";
      content += delta;
      if (delta) await options.onTextDelta(delta);
    } else if (
      type === "response.reasoning_summary_text.delta" ||
      type === "response.reasoning_summary.delta" ||
      type === "response.reasoning.delta"
    ) {
      const delta = event.delta ?? "";
      if (delta) await options.onThinkingDelta(delta);
    } else if (type.startsWith("response.web_search_call.")) {
      await options.onWebSearch?.(
        type.slice("response.web_search_call.".length)
      );
    } else if (type === "response.output_item.added" || type === "response.output_item.done") {
      const call = asFunctionCall(event.item);
      if (call) {
        calls.set(call.call_id, call);
        pendingArgs.set(call.call_id, { ...call });
      }
    } else if (type === "response.function_call_arguments.delta") {
      const itemId = event.item_id ?? event.call_id ?? "";
      if (!itemId) continue;
      const existing =
        pendingArgs.get(itemId) ??
        ({
          call_id: event.call_id ?? itemId,
          name: event.name ?? "",
          arguments: "",
        } as const);
      const next = {
        call_id: existing.call_id,
        name: event.name || existing.name,
        arguments: existing.arguments + (event.delta ?? ""),
      };
      pendingArgs.set(itemId, next);
    } else if (type === "response.function_call_arguments.done") {
      const itemId = event.item_id ?? event.call_id ?? "";
      const existing = itemId ? pendingArgs.get(itemId) : undefined;
      const callId = event.call_id || existing?.call_id || itemId;
      const name = event.name || existing?.name || "";
      const args =
        typeof event.arguments === "string"
          ? event.arguments
          : existing?.arguments || "{}";
      if (callId && name) {
        calls.set(callId, { call_id: callId, name, arguments: args });
      }
    } else if (type === "response.failed" || type === "response.error") {
      throw new Error(
        event.response?.error?.message ??
          event.error?.message ??
          "OpenAI Responses-kallet feilet"
      );
    }

    if (type === "response.completed") {
      collectItems(event.response?.output);
    }
  }

  if (!responseId) {
    throw new Error("OpenAI Responses returnerte ingen response-id");
  }

  return {
    responseId,
    content,
    functionCalls: Array.from(calls.values()),
  };
}

/** Reliable Chat Completions fallback when Responses API fails. */
export async function streamChatCompletionsTurn(options: {
  client: OpenAI;
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  onTextDelta: (delta: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<{
  content: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}> {
  const stream = await options.client.chat.completions.create(
    {
      model: options.model,
      messages: options.messages,
      tools: AGENT_OPENAI_TOOLS,
      tool_choice: "auto",
      stream: true,
      max_completion_tokens: 2500,
    },
    { signal: options.signal }
  );

  let content = "";
  const toolCallsByIndex = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  for await (const chunk of stream) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      await options.onTextDelta(delta.content);
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
