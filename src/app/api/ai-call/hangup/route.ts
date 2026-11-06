import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hangUpElevenLabsConversation } from "@/lib/ai-call/hangup";
import { createServiceClient } from "@/lib/supabase/service";
import type { AiCall } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id er påkrevd" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: row, error } = await service
    .from("ai_calls")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Fant ikke AI-kall" }, { status: 404 });
  }

  const call = row as AiCall;
  const active =
    call.status === "queued" ||
    call.status === "ringing" ||
    call.status === "in_progress";

  if (!active) {
    return NextResponse.json({ ok: true, call, alreadyEnded: true });
  }

  const conversationId =
    typeof call.vapi_call_id === "string" ? call.vapi_call_id : null;

  if (!conversationId) {
    return NextResponse.json(
      { error: "Fant ingen aktiv ElevenLabs-samtale å legge på" },
      { status: 502 }
    );
  }

  try {
    await hangUpElevenLabsConversation(conversationId);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Kunne ikke legge på — linjen er fortsatt aktiv",
      },
      { status: 502 }
    );
  }

  const { data: updated, error: updateError } = await service
    .from("ai_calls")
    .update({
      status: "ended",
      outcome: "other",
      ended_at: new Date().toISOString(),
      summary: "Manuelt lagt på",
    })
    .eq("id", call.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    call: updated,
    hungUpVia: "elevenlabs-sip",
  });
}
