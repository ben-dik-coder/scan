import { getAiCallConfig } from "./config";
import {
  assertElevenLabsCanStartCall,
  looksLikeQuotaError,
  ELEVENLABS_QUOTA_MESSAGE,
} from "./credits";
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

function normalizeE164(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

type ElevenLabsPhoneMeta = {
  phoneNumber: string | null;
  provider: "twilio" | "sip_trunk" | "exotel" | string | null;
};

/** Fra-nummer + provider (Twilio vs SIP) for valgt ElevenLabs-nummer. */
async function resolveElevenLabsPhoneMeta(
  apiKey: string,
  phoneNumberId: string
): Promise<ElevenLabsPhoneMeta> {
  const fromEnv = process.env.ELEVENLABS_FROM_NUMBER?.trim();
  const res = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    return {
      phoneNumber: fromEnv ? normalizeE164(fromEnv) : null,
      provider: null,
    };
  }
  const list = (await res.json().catch(() => null)) as
    | Array<{
        phone_number?: string;
        phone_number_id?: string;
        provider?: string;
      }>
    | null;
  if (!Array.isArray(list)) {
    return {
      phoneNumber: fromEnv ? normalizeE164(fromEnv) : null,
      provider: null,
    };
  }
  const match = list.find((p) => p.phone_number_id === phoneNumberId);
  const num = match?.phone_number?.trim() || fromEnv || null;
  return {
    phoneNumber: num ? normalizeE164(num) : null,
    provider: match?.provider ?? null,
  };
}

function humanizeElevenLabsError(
  raw: Record<string, unknown>,
  status: number
): string {
  const detail = raw.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
  }
  if (Array.isArray(detail)) return JSON.stringify(detail);
  if (typeof raw.message === "string") return raw.message;
  if (typeof raw.error === "string") return raw.error;
  return `ElevenLabs-feil (${status})`;
}

export async function startElevenLabsOutboundCall(
  input: StartAiCallInput
): Promise<StartAiCallResult> {
  const config = getAiCallConfig();
  if (config.provider !== "elevenlabs") {
    throw new Error("ElevenLabs er ikke konfigurert");
  }

  await assertElevenLabsCanStartCall(config.apiKey);

  const toNumber = normalizeE164(input.customerNumberE164);
  const phoneMeta = await resolveElevenLabsPhoneMeta(
    config.apiKey,
    config.phoneNumberId
  );
  const fromNumber = phoneMeta.phoneNumber;
  if (fromNumber && toNumber && fromNumber === toNumber) {
    throw new Error(
      "Kan ikke AI-ringe dette nummeret — det er samme som nummeret vi ringer fra. Velg et annet firma."
    );
  }

  const variableValues = buildAiCallVariableValues(input.promptVars);

  // Alltid Main-branch (Frida). Eldre branch «lk» hadde fortsatt Adrian.
  const mainBranchId =
    process.env.ELEVENLABS_AGENT_BRANCH_ID?.trim() ||
    "agtbrch_0301m5x9879aeh5v9w6d2s697r7r";

  // Vilde — kvinnelig norsk. Lås per-kall så vi ikke får Magnar/mann igjen.
  const fridaVoiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "SUVXSJC7hh41K4FtAVuH";
  // Modell, stabilitet og tempo styres i ElevenLabs-agenten (én sannhetskilde).
  // Sett ELEVENLABS_TTS_MODEL_OVERRIDE kun hvis du bevisst vil overstyre per kall.
  const ttsModelOverride = process.env.ELEVENLABS_TTS_MODEL_OVERRIDE?.trim();

  // Per kall: lås stemmen (Frida) og send prompt + åpning med faktiske verdier.
  const conversationInitiationClientData: Record<string, unknown> = {
    branch_id: mainBranchId,
    dynamic_variables: {
      ...variableValues,
      ai_call_id: input.metadata.aiCallId,
      orgnr: input.metadata.orgnr,
      user_id: input.metadata.userId,
    },
    conversation_config_override: {
      tts: {
        voice_id: fridaVoiceId,
        ...(ttsModelOverride ? { model_id: ttsModelOverride } : {}),
      },
      agent: {
        language: "no",
        first_message: buildAiCallFirstMessage(input.promptVars),
        prompt: {
          prompt: buildAiCallSystemPrompt(input.promptVars),
        },
      },
    },
  };

  const body = {
    agent_id: config.agentId,
    agent_phone_number_id: config.phoneNumberId,
    to_number: input.customerNumberE164,
    conversation_initiation_client_data: conversationInitiationClientData,
    /** Legg på hvis ingen tar telefonen innen 30 sekunder. */
    telephony_call_config: {
      ringing_timeout_secs: 30,
    },
  };

  // Kun ice SIP — ingen Twilio.
  if (phoneMeta.provider && phoneMeta.provider !== "sip_trunk") {
    throw new Error(
      `Telefonnummeret er satt som «${phoneMeta.provider}». NyLead ringer bare via ice SIP — bytt til SIP-nummeret i ElevenLabs.`
    );
  }
  const outboundUrl =
    "https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call";

  const res = await fetch(outboundUrl, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = humanizeElevenLabsError(raw, res.status);
    throw new Error(
      looksLikeQuotaError(message) ? ELEVENLABS_QUOTA_MESSAGE : message
    );
  }

  if (raw.success === false) {
    const message =
      typeof raw.message === "string"
        ? raw.message
        : "ElevenLabs kunne ikke starte samtalen";
    throw new Error(
      looksLikeQuotaError(message) ? ELEVENLABS_QUOTA_MESSAGE : message
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
    raw: {
      ...raw,
      provider: "elevenlabs",
      telephony: "sip_trunk",
      sip_call_id: raw.sip_call_id ?? null,
      callSid: raw.sip_call_id ?? null,
    },
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
