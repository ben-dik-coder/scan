import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendCampaign } from "@/lib/email/send-campaign";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { subject, body: emailBody, orgnrs, allowPersonal } = body as {
    subject?: string;
    body?: string;
    orgnrs?: string[];
    allowPersonal?: boolean;
  };

  if (!subject?.trim() || !emailBody?.trim() || !orgnrs?.length) {
    return NextResponse.json(
      { error: "Emne, melding og minst ett firma er påkrevd." },
      { status: 400 }
    );
  }

  if (orgnrs.length > 100) {
    return NextResponse.json(
      { error: "Maks 100 mottakere per utsendelse." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("orgnr, name, email, has_email")
    .in("orgnr", orgnrs)
    .eq("has_email", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recipients = (companies ?? [])
    .filter((c) => c.email)
    .map((c) => ({
      orgnr: c.orgnr,
      email: c.email as string,
      name: c.name,
    }));

  try {
    const result = await sendCampaign(user.id, {
      subject,
      body: emailBody,
      recipients,
      allowPersonal: Boolean(allowPersonal),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
