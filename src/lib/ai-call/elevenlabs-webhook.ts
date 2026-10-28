import { createHmac, timingSafeEqual } from "crypto";
import type { AiCallOutcome, LeadStatus } from "@/types/database";
import type { MappedAiCallResult } from "./map-outcome";

/** Verifiser ElevenLabs-Signature (HMAC-SHA256 over `timestamp.rawBody`). */
export function verifyElevenLabsSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith("v0="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Math.abs(Date.now() - ts * 1000);
  if (ageMs > 30 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return signatures.some((sig) => {
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function extractElevenLabsConversationId(
  payload: Record<string, unknown>
): string | null {
  const data = asRecord(payload.data);
  if (typeof data?.conversation_id === "string") return data.conversation_id;
  if (typeof payload.conversation_id === "string") return payload.conversation_id;
  return null;
}

export function extractElevenLabsAiCallId(
  payload: Record<string, unknown>
): string | null {
  const data = asRecord(payload.data);
  const init = asRecord(data?.conversation_initiation_client_data);
  const vars = asRecord(init?.dynamic_variables);
  if (typeof vars?.ai_call_id === "string") return vars.ai_call_id;
  if (typeof vars?.aiCallId === "string") return vars.aiCallId;
  return null;
}

export function extractElevenLabsTranscript(
  payload: Record<string, unknown>
): string | null {
  const data = asRecord(payload.data);
  const turns = data?.transcript;
  if (!Array.isArray(turns)) return null;

  const lines: string[] = [];
  for (const turn of turns) {
    const row = asRecord(turn);
    if (!row) continue;
    const role = typeof row.role === "string" ? row.role : "?";
    const message = typeof row.message === "string" ? row.message.trim() : "";
    if (!message) continue;
    lines.push(`${role}: ${message}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

export function extractElevenLabsSummary(
  payload: Record<string, unknown>
): string | null {
  const data = asRecord(payload.data);
  const analysis = asRecord(data?.analysis);
  if (typeof analysis?.transcript_summary === "string") {
    const s = analysis.transcript_summary.trim();
    if (s) return s;
  }
  return null;
}

function outcomeFromText(blob: string): MappedAiCallResult | null {
  if (/meeting|møte|moete|booket|booked/i.test(blob)) {
    return {
      outcome: "meeting",
      leadStatus: "moete_booket",
      unqueue: true,
      description: "AI-samtale: møte booket",
    };
  }
  if (/not.?interested|ikke interessert|nei takk|declined/i.test(blob)) {
    return {
      outcome: "not_interested",
      leadStatus: "ikke_interessert",
      unqueue: true,
      description: "AI-samtale: ikke interessert",
    };
  }
  if (/voicemail|telefonsvarer|voice.?mail/i.test(blob)) {
    return {
      outcome: "voicemail",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: telefonsvarer",
    };
  }
  if (/no.?answer|ikke svar|ingen svar|busy|no-answer/i.test(blob)) {
    return {
      outcome: "no_answer",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: ikke svar",
    };
  }
  return null;
}

function fromDataCollection(
  analysis: Record<string, unknown> | null
): MappedAiCallResult | null {
  if (!analysis) return null;
  const results = asRecord(analysis.data_collection_results);
  if (!results) return null;

  for (const value of Object.values(results)) {
    const row = asRecord(value);
    const raw =
      (typeof row?.value === "string" && row.value) ||
      (typeof row?.result === "string" && row.result) ||
      (typeof value === "string" ? value : "");
    const normalized = raw.toLowerCase().trim();
    if (
      normalized === "meeting" ||
      normalized === "not_interested" ||
      normalized === "no_answer" ||
      normalized === "voicemail" ||
      normalized === "other"
    ) {
      return mapExactOutcome(normalized as AiCallOutcome);
    }
    const fromText = outcomeFromText(normalized);
    if (fromText) return fromText;
  }
  return null;
}

function mapExactOutcome(outcome: AiCallOutcome): MappedAiCallResult {
  if (outcome === "meeting") {
    return {
      outcome: "meeting",
      leadStatus: "moete_booket",
      unqueue: true,
      description: "AI-samtale: møte booket",
    };
  }
  if (outcome === "not_interested") {
    return {
      outcome: "not_interested",
      leadStatus: "ikke_interessert",
      unqueue: true,
      description: "AI-samtale: ikke interessert",
    };
  }
  if (outcome === "voicemail") {
    return {
      outcome: "voicemail",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: telefonsvarer",
    };
  }
  if (outcome === "no_answer") {
    return {
      outcome: "no_answer",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: ikke svar",
    };
  }
  return {
    outcome: "other",
    leadStatus: "svarte" as LeadStatus,
    unqueue: false,
    description: "AI-samtale: annet utfall",
  };
}

export function mapElevenLabsPayloadToOutcome(
  payload: Record<string, unknown>
): MappedAiCallResult {
  const type = typeof payload.type === "string" ? payload.type : "";
  const data = asRecord(payload.data);

  if (type === "call_initiation_failure") {
    const reason = String(data?.failure_reason ?? "").toLowerCase();
    if (reason === "busy" || reason === "no-answer") {
      return {
        outcome: "no_answer",
        leadStatus: "kontaktet",
        unqueue: false,
        description: "AI-samtale: ikke svar",
      };
    }
    return {
      outcome: "other",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: oppstart feilet",
    };
  }

  const analysis = asRecord(data?.analysis);
  const fromCollection = fromDataCollection(analysis);
  if (fromCollection) return fromCollection;

  const summary =
    (typeof analysis?.transcript_summary === "string"
      ? analysis.transcript_summary
      : "") || "";
  const successful =
    typeof analysis?.call_successful === "string"
      ? analysis.call_successful
      : "";
  const termination =
    typeof asRecord(data?.metadata)?.termination_reason === "string"
      ? String(asRecord(data?.metadata)?.termination_reason)
      : "";

  const blob = `${summary} ${successful} ${termination}`.toLowerCase();
  const fromBlob = outcomeFromText(blob);
  if (fromBlob) return fromBlob;

  if (successful === "success") {
    return {
      outcome: "other",
      leadStatus: "svarte",
      unqueue: false,
      description: "AI-samtale: avsluttet uten klar booking",
    };
  }

  return {
    outcome: "other",
    leadStatus: "kontaktet",
    unqueue: false,
    description: "AI-samtale: ukjent utfall",
  };
}
