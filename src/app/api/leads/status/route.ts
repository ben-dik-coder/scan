import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { upsertUserLead } from "@/lib/sales/activities";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const orgnr = typeof body.orgnr === "string" ? body.orgnr.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";

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
  } = { status };

  if (status === "kontaktet") {
    updates.last_contacted_at = new Date().toISOString();
  }

  await upsertUserLead(user.id, orgnr, updates);

  return NextResponse.json({ ok: true });
}
