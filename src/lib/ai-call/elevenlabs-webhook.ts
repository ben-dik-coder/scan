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
    const rawRole = typeof row.role === "string" ? row.role.toLowerCase() : "";
    const label =
      rawRole === "user" || rawRole === "customer"
        ? "Kunde"
        : rawRole === "agent" || rawRole === "assistant" || rawRole === "ai"
          ? "AI"
          : rawRole || "?";
    // Fjern uttrykks-tagger fra expressive mode ([Warm], [laugh] …) — de leses ikke opp.
    const message =
      typeof row.message === "string"
        ? row.message.replace(/\[[A-Za-zæøåÆØÅ ]{2,24}\]\s*/g, "").trim()
        : "";
    if (!message) continue;
    lines.push(`${label}: ${message}`);
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

/** Hent avtalt tid fra data collection hvis ElevenLabs sendte den. */
export function extractElevenLabsMeetingTime(
  payload: Record<string, unknown>
): string | null {
  const analysis = asRecord(asRecord(payload.data)?.analysis);
  if (!analysis) return null;

  const results = asRecord(analysis.data_collection_results);
  if (results) {
    for (const key of ["meeting_time", "meetingBookedTime", "meeting_booked_time"]) {
      const row = asRecord(results[key]);
      const value =
        (typeof row?.value === "string" && row.value) ||
        (typeof row?.result === "string" && row.result) ||
        (typeof results[key] === "string" ? String(results[key]) : "");
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }

  const list = analysis.data_collection_results_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      const row = asRecord(item);
      const id = String(row?.data_collection_id ?? row?.id ?? row?.name ?? "");
      if (!/meeting.?time|meetingBookedTime/i.test(id)) continue;
      const value =
        (typeof row?.value === "string" && row.value) ||
        (typeof row?.result === "string" && row.result) ||
        "";
      if (value.trim()) return value.trim();
    }
  }

  return null;
}

const CHANNEL_NO: Record<string, string> = {
  phone: "telefon",
  email: "e-post",
  sms: "SMS",
};

/** Hent avtalt kanal (telefon/e-post/SMS) og kontaktinfo, f.eks. «e-post: ola@firma.no». */
export function extractElevenLabsMeetingContact(
  payload: Record<string, unknown>
): string | null {
  const analysis = asRecord(asRecord(payload.data)?.analysis);
  if (!analysis) return null;

  const read = (key: string): string => {
    const results = asRecord(analysis.data_collection_results);
    const row = asRecord(results?.[key]);
    if (typeof row?.value === "string" && row.value.trim()) return row.value.trim();
    const list = analysis.data_collection_results_list;
    if (Array.isArray(list)) {
      for (const item of list) {
        const r = asRecord(item);
        const id = String(r?.data_collection_id ?? r?.id ?? r?.name ?? "");
        if (id === key && typeof r?.value === "string" && r.value.trim()) {
          return r.value.trim();
        }
      }
    }
    return "";
  };

  const channelRaw = read("meeting_channel").toLowerCase();
  const detail = read("contact_detail");
  const channel = CHANNEL_NO[channelRaw];
  if (!channel && !detail) return null;
  return [channel, detail].filter(Boolean).join(": ");
}

function outcomeFromText(blob: string): MappedAiCallResult | null {
  // «scheduled / follow-up / callback / noterer jeg …» = møte/oppfølging avtalt
  if (
    /meeting|møte|moete|booket|booked|scheduled|schedul|follow[-\s]?up|callback|tilbake.?ring|oppfølg|oppfolg|noterer jeg|vi ringer (deg )?tilbake|avtalt (møte|samtale|oppfølging)/i.test(
      blob
    )
  ) {
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

function collectDataCollectionValues(
  analysis: Record<string, unknown> | null
): string[] {
  if (!analysis) return [];
  const values: string[] = [];

  const results = asRecord(analysis.data_collection_results);
  if (results) {
    for (const [key, value] of Object.entries(results)) {
      const row = asRecord(value);
      const raw =
        (typeof row?.value === "string" && row.value) ||
        (typeof row?.result === "string" && row.result) ||
        (typeof value === "string" ? value : "");
      if (raw.trim()) values.push(`${key}:${raw.trim()}`);
      else if (raw.trim() === "" && key.toLowerCase() === "outcome") {
        /* skip empty */
      }
    }
  }

  const list = analysis.data_collection_results_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      const row = asRecord(item);
      const id = String(row?.data_collection_id ?? row?.id ?? row?.name ?? "field");
      const raw =
        (typeof row?.value === "string" && row.value) ||
        (typeof row?.result === "string" && row.result) ||
        "";
      if (raw.trim()) values.push(`${id}:${raw.trim()}`);
    }
  }

  return values;
}

function fromDataCollection(
  analysis: Record<string, unknown> | null
): MappedAiCallResult | null {
  // Kun «outcome»-feltet styrer utfallet. Andre felt (innvending, interesse …)
  // er kun statistikk og skal ikke kunne trigge feil lead-status.
  const values = collectDataCollectionValues(analysis).filter((v) =>
    v.toLowerCase().startsWith("outcome:")
  );
  for (const raw of values) {
    const normalized = raw.includes(":")
      ? raw.slice(raw.indexOf(":") + 1).toLowerCase().trim()
      : raw.toLowerCase().trim();
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

function wantsDoNotCall(analysis: Record<string, unknown> | null): boolean {
  const isTrue = (v: unknown) => v === true || String(v).toLowerCase() === "true";
  const results = asRecord(analysis?.data_collection_results);
  if (results && isTrue(asRecord(results.do_not_call)?.value)) return true;
  const list = analysis?.data_collection_results_list;
  if (Array.isArray(list)) {
    return list.some((item) => {
      const row = asRecord(item);
      const id = String(row?.data_collection_id ?? row?.id ?? row?.name ?? "");
      return id === "do_not_call" && isTrue(row?.value);
    });
  }
  return false;
}

export function mapElevenLabsPayloadToOutcome(
  payload: Record<string, unknown>
): MappedAiCallResult {
  const type = typeof payload.type === "string" ? payload.type : "";
  const data = asRecord(payload.data);

  if (type === "call_initiation_failure") {
    const reason = String(data?.failure_reason ?? "").toLowerCase();
    const blob = JSON.stringify(data ?? {}).toLowerCase();
    if (
      /quota_exceeded|out of credits|run out of credits|insufficient.?credit/.test(
        blob
      )
    ) {
      return {
        outcome: "other",
        leadStatus: "kontaktet",
        unqueue: false,
        description:
          "ElevenLabs tom for credits — samtalen ble avbrutt ved opptak",
      };
    }
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

  // Kunden ba om å ikke bli ringt igjen → aldri tilbake i køen.
  if (wantsDoNotCall(analysis)) {
    return {
      outcome: "not_interested",
      leadStatus: "ikke_interessert",
      unqueue: true,
      description: "AI-samtale: ba om å ikke bli ringt igjen",
    };
  }

  const fromCollection = fromDataCollection(analysis);
  if (fromCollection && fromCollection.outcome !== "other") {
    return fromCollection;
  }

  const summary =
    (typeof analysis?.transcript_summary === "string"
      ? analysis.transcript_summary
      : "") || "";
  const title =
    (typeof analysis?.call_summary_title === "string"
      ? analysis.call_summary_title
      : "") || "";
  const successful =
    typeof analysis?.call_successful === "string"
      ? analysis.call_successful
      : "";
  const termination =
    typeof asRecord(data?.metadata)?.termination_reason === "string"
      ? String(asRecord(data?.metadata)?.termination_reason)
      : "";
  const transcriptText = extractElevenLabsTranscript(payload) ?? "";

  const blob = `${summary}\n${title}\n${successful}\n${termination}\n${transcriptText}`.toLowerCase();
  const fromBlob = outcomeFromText(blob);
  if (fromBlob) return fromBlob;

  if (fromCollection) return fromCollection;

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
