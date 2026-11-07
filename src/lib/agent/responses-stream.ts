import OpenAI from "openai";
import { AGENT_RESPONSES_TOOLS } from "@/lib/agent/tools";

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
  response?: {
    id?: string;
    output?: unknown[];
    error?: { message?: string } | null;
  };
  item?: unknown;
  error?: { message?: string } | null;
};

function asFunctionCall(item: unknown): StreamedResponsesTurn["functionCalls"][number] | null {
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

function isHostedWebSearchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /web_search_preview|web search|hosted tool/i.test(message);
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
  const createStream = async (includeHostedWebSearch: boolean) => {
    const tools = includeHostedWebSearch
      ? AGENT_RESPONSES_TOOLS
      : AGENT_RESPONSES_TOOLS.filter((tool) => tool.type !== "web_search_preview");
    const body = {
      model: options.model,
      instructions: options.instructions,
      input: options.input,
      previous_response_id: options.previousResponseId,
      tools,
      tool_choice: "auto",
      reasoning: {
        effort: options.reasoningEffort ?? "medium",
        summary: "auto",
      },
      stream: true,
      store: true,
    } as unknown as ResponsesCreateOptions;

    return options.client.responses.create(body, { signal: options.signal });
  };

  let stream: Awaited<ReturnType<typeof createStream>>;
  try {
    stream = await createStream(true);
  } catch (error) {
    if (!isHostedWebSearchError(error)) throw error;
    stream = await createStream(false);
  }

  let responseId = "";
  let content = "";
  const calls = new Map<string, StreamedResponsesTurn["functionCalls"][number]>();

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
      await options.onWebSearch?.(type.slice("response.web_search_call.".length));
    } else if (type === "response.output_item.done") {
      const call = asFunctionCall(event.item);
      if (call) calls.set(call.call_id, call);
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
