export type AiCallProvider = "elevenlabs" | "vapi";

export type AiCallConfig =
  | {
      provider: "elevenlabs";
      apiKey: string;
      agentId: string;
      phoneNumberId: string;
      webhookSecret: string;
      serverUrl: string | null;
    }
  | {
      provider: "vapi";
      apiKey: string;
      assistantId: string;
      phoneNumberId: string;
      webhookSecret: string;
      serverUrl: string | null;
    };

function appWebhookUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "") ?? "";
  return appUrl ? `${appUrl}/api/ai-call/webhook` : null;
}

export function isElevenLabsCallConfigured(): boolean {
  return Boolean(
    process.env.ELEVENLABS_API_KEY?.trim() &&
      process.env.ELEVENLABS_AGENT_ID?.trim() &&
      process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID?.trim()
  );
}

export function isVapiCallConfigured(): boolean {
  return Boolean(
    process.env.VAPI_API_KEY?.trim() &&
      process.env.VAPI_ASSISTANT_ID?.trim() &&
      process.env.VAPI_PHONE_NUMBER_ID?.trim()
  );
}

/** ElevenLabs først (hvis satt), ellers Vapi. */
export function isAiCallConfigured(): boolean {
  return isElevenLabsCallConfigured() || isVapiCallConfigured();
}

export function getAiCallProvider(): AiCallProvider | null {
  if (isElevenLabsCallConfigured()) return "elevenlabs";
  if (isVapiCallConfigured()) return "vapi";
  return null;
}

export function getAiCallConfig(): AiCallConfig {
  const serverUrl = appWebhookUrl();
  const webhookSecret = process.env.AI_CALL_WEBHOOK_SECRET?.trim() ?? "";

  if (isElevenLabsCallConfigured()) {
    return {
      provider: "elevenlabs",
      apiKey: process.env.ELEVENLABS_API_KEY!.trim(),
      agentId: process.env.ELEVENLABS_AGENT_ID!.trim(),
      phoneNumberId: process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID!.trim(),
      webhookSecret:
        process.env.ELEVENLABS_WEBHOOK_SECRET?.trim() || webhookSecret,
      serverUrl,
    };
  }

  const apiKey = process.env.VAPI_API_KEY?.trim() ?? "";
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim() ?? "";
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim() ?? "";

  if (!apiKey || !assistantId || !phoneNumberId) {
    throw new Error(
      "AI-ring er ikke konfigurert. Sett ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID + ELEVENLABS_AGENT_PHONE_NUMBER_ID (anbefalt), eller VAPI_API_KEY + VAPI_ASSISTANT_ID + VAPI_PHONE_NUMBER_ID."
    );
  }

  return {
    provider: "vapi",
    apiKey,
    assistantId,
    phoneNumberId,
    webhookSecret,
    serverUrl,
  };
}

export function verifyAiCallWebhookSecret(request: Request): boolean {
  const expected = process.env.AI_CALL_WEBHOOK_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV !== "production") return true;
    // ElevenLabs bruker egen HMAC — tillat videre verifisering der
    if (request.headers.get("elevenlabs-signature")) return true;
    return false;
  }

  const header =
    request.headers.get("x-vapi-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";

  return header === expected || querySecret === expected;
}

export function getElevenLabsWebhookSecret(): string | null {
  return (
    process.env.ELEVENLABS_WEBHOOK_SECRET?.trim() ||
    process.env.AI_CALL_WEBHOOK_SECRET?.trim() ||
    null
  );
}

export function aiCallConfigErrorMessage(): string {
  return "AI-ring er ikke konfigurert. Sett ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID og ELEVENLABS_AGENT_PHONE_NUMBER_ID (Twilio-nummer i ElevenLabs), eller Vapi-nøklene.";
}
