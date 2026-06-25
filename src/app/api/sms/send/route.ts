import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/config";
import { sendSmsMessage } from "@/lib/sms/send-sms";
import { upsertUserLead } from "@/lib/sales/activities";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { to?: string; message?: string; orgnr?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const orgnr = typeof body.orgnr === "string" ? body.orgnr.trim() : "";

  if (!to || !message) {
    return NextResponse.json({ error: "Telefon og melding er påkrevd" }, { status: 400 });
  }

  try {
    let messageId = `demo-${Date.now()}`;
    if (!isDemoMode()) {
      const result = await sendSmsMessage(to, message);
      messageId = result.id;
    }

    if (orgnr) {
      await upsertUserLead(user.id, orgnr, {
        status: "kontaktet",
        last_contacted_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, id: messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke sende SMS" },
      { status: 500 }
    );
  }
}
