import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AiCall } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const orgnr = url.searchParams.get("orgnr")?.trim() ?? "";
  const callId = url.searchParams.get("id")?.trim() ?? "";

  const service = createServiceClient();

  if (callId) {
    const { data, error } = await service
      .from("ai_calls")
      .select("*")
      .eq("id", callId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ call: (data as AiCall | null) ?? null });
  }

  let query = service
    .from("ai_calls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (orgnr) {
    query = query.eq("orgnr", orgnr);
  }

  const { data: latestRows, error: latestError } = await query;
  if (latestError) {
    return NextResponse.json({ error: latestError.message }, { status: 500 });
  }

  const latest = (latestRows?.[0] as AiCall | undefined) ?? null;

  const { data: activeRows } = await service
    .from("ai_calls")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["queued", "ringing", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1);

  const active = (activeRows?.[0] as AiCall | undefined) ?? null;

  return NextResponse.json({
    call: active ?? latest,
    active: active ?? null,
    latest: latest ?? null,
  });
}
