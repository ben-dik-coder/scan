import { getAiCallConfig } from "./config";
import {
  buildAiCallAnalysisPlan,
  buildAiCallFirstMessage,
  buildAiCallSystemPrompt,
  buildAiCallVariableValues,
  type AiCallPromptVars,
} from "./prompt";

export type StartAiCallInput = {
  customerNumberE164: string;
  promptVars: AiCallPromptVars;
  metadata: {
    aiCallId: string;
    userId: string;
    orgnr: string;
  };
};

export type StartAiCallResult = {
  provider: "elevenlabs" | "vapi";
  /** ElevenLabs conversation_id eller Vapi call id — lagres i ai_calls.vapi_call_id */
  externalCallId: string;
  raw: Record<string, unknown>;
};

/** @deprecated Bruk startAiOutboundCall */
export type StartVapiCallInput = StartAiCallInput;
/** @deprecated Bruk startAiOutboundCall */
export type StartVapiCallResult = {
  vapiCallId: string;
  raw: Record<string, unknown>;
};

export async function startAiOutboundCall(
  input: StartAiCallInput
): Promise<StartAiCallResult> {
  const config = getAiCallConfig();
  if (config.provider === "elevenlabs") {
    return startElevenLabsOutboundCall(input);
  }
  const vapi = await startVapiOutboundCall(input);
  return {
    provider: "vapi",
    externalCallId: vapi.vapiCallId,
    raw: vapi.raw,
  };
}

export async function startElevenLabsOutboundCall(
  input: StartAiCallInput
): Promise<StartAiCallResult> {
  const config = getAiCallConfig();
  if (config.provider !== "elevenlabs") {
    throw new Error("ElevenLabs er ikke konfigurert");
  }

  const variableValues = buildAiCallVariableValues(input.promptVars);
  const overridePrompt =
    process.env.ELEVENLABS_OVERRIDE_PROMPT?.trim() === "1" ||
    process.env.ELEVENLABS_OVERRIDE_PROMPT?.trim()?.toLowerCase() === "true";

  const conversationInitiationClientData: Record<string, unknown> = {
    dynamic_variables: {
      ...variableValues,
      ai_call_id: input.metadata.aiCallId,
      orgnr: input.metadata.orgnr,
      user_id: input.metadata.userId,
    },
  };

  if (overridePrompt) {
    conversationInitiationClientData.conversation_config_override = {
      agent: {
        first_message: buildAiCallFirstMessage(input.promptVars),
        prompt: {
          prompt: buildAiCallSystemPrompt(input.promptVars),
        },
      },
    };
  }

  const body = {
    agent_id: config.agentId,
    agent_phone_number_id: config.phoneNumberId,
    to_number: input.customerNumberE164,
    conversation_initiation_client_data: conversationInitiationClientData,
  };

  const res = await fetch(
    "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      typeof raw.detail === "string"
        ? raw.detail
        : Array.isArray(raw.detail)
          ? JSON.stringify(raw.detail)
          : null;
    const message =
      detail ??
      (typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : `ElevenLabs-feil (${res.status})`);
    throw new Error(message);
  }

  if (raw.success === false) {
    throw new Error(
      typeof raw.message === "string"
        ? raw.message
        : "ElevenLabs kunne ikke starte samtalen"
    );
  }

  const conversationId =
    typeof raw.conversation_id === "string" ? raw.conversation_id : null;
  if (!conversationId) {
    throw new Error("ElevenLabs returnerte ikke conversation_id");
  }

  return {
    provider: "elevenlabs",
    externalCallId: conversationId,
    raw: { ...raw, provider: "elevenlabs", callSid: raw.callSid ?? null },
  };
}

export async function startVapiOutboundCall(
  input: StartAiCallInput
): Promise<StartVapiCallResult> {
  const config = getAiCallConfig();
  if (config.provider !== "vapi") {
    throw new Error("Vapi er ikke aktiv provider");
  }

  const systemPrompt = buildAiCallSystemPrompt(input.promptVars);
  const firstMessage = buildAiCallFirstMessage(input.promptVars);
  const variableValues = buildAiCallVariableValues(input.promptVars);

  const body: Record<string, unknown> = {
    assistantId: config.assistantId,
    phoneNumberId: config.phoneNumberId,
    customer: {
      number: input.customerNumberE164,
    },
    name: `nylead-${input.metadata.orgnr}`,
    assistantOverrides: {
      firstMessage,
      variableValues,
      maxDurationSeconds: 240,
      silenceTimeoutSeconds: 10,
      responseDelaySeconds: 0.25,
      llmRequestDelaySeconds: 0.15,
      model: {
        provider: "openai",
        model: "gpt-4o-2024-11-20:westeurope",
        temperature: 0.6,
        maxTokens: 180,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
      },
      startSpeakingPlan: {
        waitSeconds: 0.4,
        smartEndpointingEnabled: true,
      },
      analysisPlan: buildAiCallAnalysisPlan(),
      endCallMessage: "Takk for praten. Ha en fin dag.",
      metadata: input.metadata,
      ...(config.serverUrl
        ? {
            serverUrl: config.serverUrl,
            ...(config.webhookSecret
              ? { serverUrlSecret: config.webhookSecret }
              : {}),
          }
        : {}),
    },
    metadata: input.metadata,
  };

  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : `Vapi-feil (${res.status})`;
    throw new Error(message);
  }

  const vapiCallId = typeof raw.id === "string" ? raw.id : null;
  if (!vapiCallId) {
    throw new Error("Vapi returnerte ikke call-id");
  }

  return { vapiCallId, raw: { ...raw, provider: "vapi" } };
}
