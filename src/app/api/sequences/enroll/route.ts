import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import { enrollInSequence } from "@/lib/sales/sequences";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sequenceId, orgnrs } = (await request.json()) as {
    sequenceId?: string;
    orgnrs?: string[];
  };

  const entitlements = await getEntitlements(user.id);
  const featureError = requireFeature(entitlements, "sequences");
  if (featureError) {
    return NextResponse.json({ error: featureError }, { status: 403 });
  }

  if (!sequenceId || !orgnrs?.length) {
    return NextResponse.json(
      { error: "Sekvens og minst ett firma er påkrevd" },
      { status: 400 }
    );
  }

  if (orgnrs.length > entitlements.maxRecipientsPerSend) {
    return NextResponse.json(
      { error: `Maks ${entitlements.maxRecipientsPerSend} firma per gang på din pakke` },
      { status: 400 }
    );
  }

  try {
    await enrollInSequence(user.id, sequenceId, orgnrs);
    return NextResponse.json({ ok: true, enrolled: orgnrs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
