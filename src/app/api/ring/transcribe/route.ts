import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionUser } from "@/lib/auth";

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
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
  if (!(audio instanceof Blob) || audio.size < 1000) {
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

  const mime = audio.type || "audio/webm";
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
  const file = new File([audio], `ring-chunk.${ext}`, { type: mime });

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
