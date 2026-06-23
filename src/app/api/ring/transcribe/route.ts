import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionUser } from "@/lib/auth";

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function whisperFileFromBlob(audio: Blob): File {
  const rawType = (audio.type || "").toLowerCase().split(";")[0]?.trim() ?? "";

  if (rawType.includes("mp4") || rawType.includes("m4a")) {
    return new File([audio], "chunk.m4a", { type: "audio/mp4" });
  }
  if (rawType.includes("ogg") || rawType === "application/ogg") {
    return new File([audio], "chunk.ogg", { type: "audio/ogg" });
  }
  if (rawType.includes("wav")) {
    return new File([audio], "chunk.wav", { type: "audio/wav" });
  }
  if (rawType.includes("mpeg") || rawType.includes("mp3")) {
    return new File([audio], "chunk.mp3", { type: "audio/mpeg" });
  }
  if (rawType.includes("webm")) {
    return new File([audio], "chunk.webm", { type: "audio/webm" });
  }

  // Ukjent/ tom type fra noen nettlesere — anta webm fra MediaRecorder.
  return new File([audio], "chunk.webm", { type: "audio/webm" });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    available: Boolean(getOpenAIClient()),
    engine: "whisper",
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json(
      { error: "AI-transkripsjon er ikke aktivert (mangler OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size < 500) {
    return NextResponse.json(
      { error: "Lydfilen er for kort eller mangler." },
      { status: 400 }
    );
  }

  if (audio.size > 12 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Lydfilen er for stor (maks 12 MB per del)." },
      { status: 400 }
    );
  }

  const file = whisperFileFromBlob(audio);

  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "no",
      temperature: 0,
      prompt:
        "Telefonsamtale på norsk mellom selger og bedrift. Transkriber ordrett med korrekt norsk rettskriving.",
    });

    const text =
      typeof result === "string"
        ? result
        : ((result as { text?: string }).text ?? "");

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transkripsjon feilet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
