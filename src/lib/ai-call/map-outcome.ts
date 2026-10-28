import type { AiCallOutcome, LeadStatus } from "@/types/database";

export type MappedAiCallResult = {
  outcome: AiCallOutcome;
  leadStatus: LeadStatus;
  unqueue: boolean;
  description: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/** Tolker Vapi end-of-call / analyse til NyLead outcome. */
export function mapVapiPayloadToOutcome(
  payload: Record<string, unknown>
): MappedAiCallResult {
  const message = payload.message;
  const msg =
    message && typeof message === "object"
      ? (message as Record<string, unknown>)
      : payload;

  const endedReason = normalizeText(msg.endedReason ?? payload.endedReason);
  const analysis =
    msg.analysis && typeof msg.analysis === "object"
      ? (msg.analysis as Record<string, unknown>)
      : null;
  const structured =
    analysis?.structuredData && typeof analysis.structuredData === "object"
      ? (analysis.structuredData as Record<string, unknown>)
      : null;

  const structuredOutcome = normalizeText(structured?.outcome);
  if (
    structuredOutcome === "meeting" ||
    structuredOutcome === "not_interested" ||
    structuredOutcome === "no_answer" ||
    structuredOutcome === "voicemail" ||
    structuredOutcome === "other"
  ) {
    if (structuredOutcome === "meeting") {
      return {
        outcome: "meeting",
        leadStatus: "moete_booket",
        unqueue: true,
        description: "AI-samtale: møte booket",
      };
    }
    if (structuredOutcome === "not_interested") {
      return {
        outcome: "not_interested",
        leadStatus: "ikke_interessert",
        unqueue: true,
        description: "AI-samtale: ikke interessert",
      };
    }
    if (structuredOutcome === "voicemail") {
      return {
        outcome: "voicemail",
        leadStatus: "kontaktet",
        unqueue: false,
        description: "AI-samtale: telefonsvarer",
      };
    }
    if (structuredOutcome === "no_answer") {
      return {
        outcome: "no_answer",
        leadStatus: "kontaktet",
        unqueue: false,
        description: "AI-samtale: ikke svar",
      };
    }
    return {
      outcome: "other",
      leadStatus: "svarte",
      unqueue: false,
      description: "AI-samtale: annet utfall",
    };
  }

  const successEval = normalizeText(
    structured?.result ?? analysis?.successEvaluation ?? msg.successEvaluation
  );
  const summary = normalizeText(msg.summary ?? analysis?.summary ?? payload.summary);
  const blob = `${successEval} ${summary} ${endedReason}`;

  if (
    /voicemail|voice.?mail|svarer.?ikke|no.?answer|customer-did-not-answer|busy|failed/i.test(
      endedReason
    ) ||
    /voicemail|ikke svar|ingen svar|mobil.?svarer/i.test(blob)
  ) {
    if (/voicemail|voice.?mail|telefonsvarer/i.test(blob) || /voicemail/i.test(endedReason)) {
      return {
        outcome: "voicemail",
        leadStatus: "kontaktet",
        unqueue: false,
        description: "AI-samtale: telefonsvarer",
      };
    }
    return {
      outcome: "no_answer",
      leadStatus: "kontaktet",
      unqueue: false,
      description: "AI-samtale: ikke svar",
    };
  }

  if (
    /meeting|møte|moete|booket|booked|interested.?yes|ja.?til.?møte/i.test(blob) ||
    successEval === "true" ||
    successEval === "meeting"
  ) {
    return {
      outcome: "meeting",
      leadStatus: "moete_booket",
      unqueue: true,
      description: "AI-samtale: møte booket",
    };
  }

  if (
    /not.?interested|ikke interessert|nei|declined|rejected|do.?not.?call/i.test(blob)
  ) {
    return {
      outcome: "not_interested",
      leadStatus: "ikke_interessert",
      unqueue: true,
      description: "AI-samtale: ikke interessert",
    };
  }

  // Noen svarte, men uklart resultat → marker som kontaktet/svarte
  if (/customer-ended-call|assistant-ended-call|hangup|completed/i.test(endedReason)) {
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

export function extractTranscript(payload: Record<string, unknown>): string | null {
  const message = payload.message;
  const msg =
    message && typeof message === "object"
      ? (message as Record<string, unknown>)
      : payload;

  if (typeof msg.transcript === "string" && msg.transcript.trim()) {
    return msg.transcript.trim();
  }
  if (typeof payload.transcript === "string" && payload.transcript.trim()) {
    return payload.transcript.trim();
  }

  const artifact =
    msg.artifact && typeof msg.artifact === "object"
      ? (msg.artifact as Record<string, unknown>)
      : null;
  if (typeof artifact?.transcript === "string" && artifact.transcript.trim()) {
    return artifact.transcript.trim();
  }

  return null;
}

export function extractSummary(payload: Record<string, unknown>): string | null {
  const message = payload.message;
  const msg =
    message && typeof message === "object"
      ? (message as Record<string, unknown>)
      : payload;

  const analysis =
    msg.analysis && typeof msg.analysis === "object"
      ? (msg.analysis as Record<string, unknown>)
      : null;

  if (typeof msg.summary === "string" && msg.summary.trim()) return msg.summary.trim();
  if (typeof analysis?.summary === "string" && analysis.summary.trim()) {
    return analysis.summary.trim();
  }
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    return payload.summary.trim();
  }
  return null;
}

export function extractVapiCallId(payload: Record<string, unknown>): string | null {
  const message = payload.message;
  const msg =
    message && typeof message === "object"
      ? (message as Record<string, unknown>)
      : null;

  const call =
    (msg?.call && typeof msg.call === "object"
      ? (msg.call as Record<string, unknown>)
      : null) ??
    (payload.call && typeof payload.call === "object"
      ? (payload.call as Record<string, unknown>)
      : null);

  if (typeof call?.id === "string") return call.id;
  if (typeof payload.id === "string") return payload.id;
  if (typeof msg?.callId === "string") return msg.callId;
  return null;
}

export function mapVapiStatus(
  eventType: string | undefined
): "ringing" | "in_progress" | "ended" | null {
  const t = (eventType ?? "").toLowerCase();
  if (t.includes("ringing")) return "ringing";
  if (t.includes("in-progress") || t.includes("in progress")) {
    return "in_progress";
  }
  if (t.includes("end-of-call")) return "ended";
  return null;
}
