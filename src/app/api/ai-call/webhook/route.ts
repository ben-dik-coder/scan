import { NextResponse } from "next/server";
import {
  getElevenLabsWebhookSecret,
  verifyAiCallWebhookSecret,
} from "@/lib/ai-call/config";
import {
  extractElevenLabsAiCallId,
  extractElevenLabsConversationId,
  extractElevenLabsSummary,
  extractElevenLabsTranscript,
  mapElevenLabsPayloadToOutcome,
  verifyElevenLabsSignature,
} from "@/lib/ai-call/elevenlabs-webhook";
import {
  extractSummary,
  extractTranscript,
  extractVapiCallId,
  mapVapiPayloadToOutcome,
  mapVapiStatus,
} from "@/lib/ai-call/map-outcome";
import { logActivity, upsertUserLead } from "@/lib/sales/activities";
import { createServiceClient } from "@/lib/supabase/service";
import type { AiCall } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type WebhookBody = Record<string, unknown>;

function eventTypeOf(body: WebhookBody): string {
  const message = body.message;
  if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    if (typeof msg.type === "string") return msg.type;
  }
  if (typeof body.type === "string") return body.type;
  if (typeof body.status === "string") return body.status;
  return "";
}

function metadataOf(body: WebhookBody): Record<string, unknown> {
  const message = body.message;
  const msg =
    message && typeof message === "object"
      ? (message as Record<string, unknown>)
      : body;
  const call =
    msg.call && typeof msg.call === "object"
      ? (msg.call as Record<string, unknown>)
      : null;
  const fromCall =
    call?.metadata && typeof call.metadata === "object"
      ? (call.metadata as Record<string, unknown>)
      : {};
  const fromMsg =
    msg.metadata && typeof msg.metadata === "object"
      ? (msg.metadata as Record<string, unknown>)
      : {};
  const fromBody =
    body.metadata && typeof body.metadata === "object"
      ? (body.metadata as Record<string, unknown>)
      : {};
  return { ...fromBody, ...fromMsg, ...fromCall };
}

async function findAiCallByExternalId(
  service: ReturnType<typeof createServiceClient>,
  externalId: string | null
): Promise<AiCall | null> {
  if (!externalId) return null;
  const { data } = await service
    .from("ai_calls")
    .select("*")
    .eq("vapi_call_id", externalId)
    .maybeSingle();
  return data ? (data as AiCall) : null;
}

async function findAiCallById(
  service: ReturnType<typeof createServiceClient>,
  aiCallId: string | null
): Promise<AiCall | null> {
  if (!aiCallId) return null;
  const { data } = await service
    .from("ai_calls")
    .select("*")
    .eq("id", aiCallId)
    .maybeSingle();
  return data ? (data as AiCall) : null;
}

async function findVapiAiCall(
  service: ReturnType<typeof createServiceClient>,
  body: WebhookBody
): Promise<AiCall | null> {
  const meta = metadataOf(body);
  const aiCallId =
    typeof meta.aiCallId === "string"
      ? meta.aiCallId
      : typeof meta.ai_call_id === "string"
        ? meta.ai_call_id
        : null;

  const byId = await findAiCallById(service, aiCallId);
  if (byId) return byId;

  return findAiCallByExternalId(service, extractVapiCallId(body));
}

async function applyEndOfCall(
  service: ReturnType<typeof createServiceClient>,
  aiCall: AiCall,
  mapped: ReturnType<typeof mapVapiPayloadToOutcome>,
  transcript: string | null,
  summary: string | null,
  raw: WebhookBody
) {
  await service
    .from("ai_calls")
    .update({
      status: "ended",
      outcome: mapped.outcome,
      transcript,
      summary,
      ended_at: new Date().toISOString(),
      raw_payload: raw,
    })
    .eq("id", aiCall.id);

  await upsertUserLead(aiCall.user_id, aiCall.orgnr, {
    status: mapped.leadStatus,
    last_contacted_at: new Date().toISOString(),
    ...(mapped.unqueue ? { queued_at: null } : {}),
  });

  await logActivity(aiCall.user_id, aiCall.orgnr, "call", mapped.description, {
    ai_call_id: aiCall.id,
    outcome: mapped.outcome,
    lead_status: mapped.leadStatus,
  });
}

async function handleElevenLabs(
  service: ReturnType<typeof createServiceClient>,
  body: WebhookBody
) {
  const type = typeof body.type === "string" ? body.type : "";

  // Audio-only: ignore (ingen utfall)
  if (type === "post_call_audio") {
    return NextResponse.json({ ok: true, ignored: true, type });
  }

  const aiCall =
    (await findAiCallById(service, extractElevenLabsAiCallId(body))) ??
    (await findAiCallByExternalId(
      service,
      extractElevenLabsConversationId(body)
    ));

  if (!aiCall) {
    return NextResponse.json({ ok: true, ignored: true, type, provider: "elevenlabs" });
  }

  if (type === "call_initiation_failure") {
    const mapped = mapElevenLabsPayloadToOutcome(body);
    await applyEndOfCall(
      service,
      aiCall,
      mapped,
      null,
      mapped.description,
      body
    );
    return NextResponse.json({
      ok: true,
      provider: "elevenlabs",
      outcome: mapped.outcome,
      leadStatus: mapped.leadStatus,
    });
  }

  if (type === "post_call_transcription") {
    const mapped = mapElevenLabsPayloadToOutcome(body);
    await applyEndOfCall(
      service,
      aiCall,
      mapped,
      extractElevenLabsTranscript(body),
      extractElevenLabsSummary(body),
      body
    );
    return NextResponse.json({
      ok: true,
      provider: "elevenlabs",
      outcome: mapped.outcome,
      leadStatus: mapped.leadStatus,
    });
  }

  return NextResponse.json({ ok: true, ignored: true, type, provider: "elevenlabs" });
}

async function handleVapi(
  service: ReturnType<typeof createServiceClient>,
  body: WebhookBody
) {
  const eventType = eventTypeOf(body);
  const aiCall = await findVapiAiCall(service, body);

  if (!aiCall) {
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  const statusMapped = mapVapiStatus(eventType);
  const isEndReport =
    eventType.toLowerCase().includes("end-of-call") ||
    eventType === "end-of-call-report";

  if (!isEndReport && statusMapped && statusMapped !== "ended") {
    await service
      .from("ai_calls")
      .update({
        status: statusMapped,
        raw_payload: body,
      })
      .eq("id", aiCall.id);
    return NextResponse.json({ ok: true, status: statusMapped });
  }

  if (!isEndReport && !statusMapped) {
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  const mapped = mapVapiPayloadToOutcome(body);
  await applyEndOfCall(
    service,
    aiCall,
    mapped,
    extractTranscript(body),
    extractSummary(body),
    body
  );

  return NextResponse.json({
    ok: true,
    outcome: mapped.outcome,
    leadStatus: mapped.leadStatus,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("elevenlabs-signature");
  const rawText = await request.text();

  // ElevenLabs post-call (HMAC)
  if (signature) {
    const secret = getElevenLabsWebhookSecret();
    if (!secret || !verifyElevenLabsSignature(rawText, signature, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: WebhookBody;
    try {
      body = JSON.parse(rawText) as WebhookBody;
    } catch {
      return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
    }

    const service = createServiceClient();
    return handleElevenLabs(service, body);
  }

  // Vapi (shared secret)
  if (!verifyAiCallWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawText) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  // Fallback: EL payload uten signature-header (f.eks. manuell test)
  if (
    typeof body.type === "string" &&
    (body.type === "post_call_transcription" ||
      body.type === "call_initiation_failure" ||
      body.type === "post_call_audio")
  ) {
    const service = createServiceClient();
    return handleElevenLabs(service, body);
  }

  const service = createServiceClient();
  return handleVapi(service, body);
}
