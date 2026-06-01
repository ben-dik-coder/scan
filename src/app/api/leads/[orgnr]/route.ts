import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import { upsertUserLead, logActivity } from "@/lib/sales/activities";
import { pauseEnrollmentsOnReply } from "@/lib/sales/sequences";
import type { LeadStatus } from "@/types/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgnr: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlements = await getEntitlements(user.id);
  const featureError = requireFeature(entitlements, "pipeline");
  if (featureError) {
    return NextResponse.json({ error: featureError }, { status: 403 });
  }

  const { orgnr } = await params;
  const body = await request.json();
  const { status, notes, next_follow_up_at } = body as {
    status?: LeadStatus;
    notes?: string;
    next_follow_up_at?: string | null;
  };

  try {
    await upsertUserLead(user.id, orgnr, {
      status,
      notes,
      next_follow_up_at,
    });

    if (status === "svarte") {
      await pauseEnrollmentsOnReply(user.id, orgnr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgnr: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgnr } = await params;
  const { description } = (await request.json()) as { description?: string };

  if (!description?.trim()) {
    return NextResponse.json({ error: "Beskrivelse mangler" }, { status: 400 });
  }

  await logActivity(user.id, orgnr, "call", description);
  await upsertUserLead(user.id, orgnr, {
    last_contacted_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
