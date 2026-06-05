import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { upsertUserLead } from "@/lib/sales/activities";
import { notifyLeadQueued } from "@/lib/webhooks/dispatch";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const orgnr = typeof body.orgnr === "string" ? body.orgnr.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const queue = body.queue === true;
  const unqueue = body.unqueue === true;

  if (!orgnr || !status) {
    return NextResponse.json({ error: "orgnr og status er påkrevd" }, { status: 400 });
  }

  const allowed = [
    "ny",
    "kontaktet",
    "svarte",
    "moete_booket",
    "vunnet",
    "tapt",
    "ikke_interessert",
  ];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Ugyldig status" }, { status: 400 });
  }

  const updates: {
    status: string;
    last_contacted_at?: string;
    queued_at?: string | null;
  } = { status };

  if (status === "kontaktet") {
    updates.last_contacted_at = new Date().toISOString();
  }

  if (queue && status === "ny") {
    updates.queued_at = new Date().toISOString();
  }

  if (unqueue || status === "ikke_interessert") {
    updates.queued_at = null;
  }

  let shouldNotifyQueue = false;
  if (queue && status === "ny") {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("user_leads")
      .select("status, queued_at")
      .eq("user_id", user.id)
      .eq("orgnr", orgnr)
      .maybeSingle();
    shouldNotifyQueue = !existing?.queued_at;
  }

  await upsertUserLead(user.id, orgnr, updates);

  if (shouldNotifyQueue) {
    void notifyLeadQueued(user.id, orgnr).catch((err) => {
      console.warn("[webhook] lead.queued failed:", err);
    });
  }

  return NextResponse.json({ ok: true });
}
