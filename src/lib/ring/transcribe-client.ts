export type TranscriptEngine = "whisper" | "browser";

export function isMediaRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Safari støtter ofte mp4 bedre enn webm for Whisper. */
export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function audioUploadName(blob: Blob): string {
  const type = (blob.type || "").toLowerCase();
  if (type.includes("mp4") || type.includes("m4a")) return "chunk.m4a";
  if (type.includes("ogg")) return "chunk.ogg";
  if (type.includes("wav")) return "chunk.wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "chunk.mp3";
  return "chunk.webm";
}

export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, audioUploadName(blob));
  const res = await fetch("/api/ring/transcribe", {
    method: "POST",
    body: formData,
  });
  const data = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Kunne ikke transkribere");
  }
  return data.text?.trim() ?? "";
}

export async function fetchWhisperAvailability(): Promise<boolean> {
  try {
    const res = await fetch("/api/ring/transcribe");
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export function appendTranscriptChunk(previous: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return previous;
  if (!previous.trim()) return next;
  return `${previous.trimEnd()} ${next}`.trim();
}
