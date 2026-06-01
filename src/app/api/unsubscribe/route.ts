import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/utils";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const { token, reason } = (await request.json()) as {
    token?: string;
    reason?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "Token mangler" }, { status: 400 });
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return NextResponse.json({ error: "Ugyldig token" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("email_unsubscribes").upsert(
    {
      email: email.toLowerCase(),
      reason: reason ?? "avmeldt via lenke",
    },
    { onConflict: "email" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
