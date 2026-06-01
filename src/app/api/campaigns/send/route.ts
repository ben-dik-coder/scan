import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
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

  const entitlements = await getEntitlements(user.id);
  if (!entitlements.hasAccess) {
    return NextResponse.json(
      { error: "Aktivt abonnement kreves. Gå til Abonnement." },
      { status: 403 }
    );
  }

  const emailError = requireFeature(entitlements, "email");
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 403 });
  }

  if (orgnrs.length > entitlements.maxRecipientsPerSend) {
    return NextResponse.json(
      {
        error: `Maks ${entitlements.maxRecipientsPerSend} mottakere per utsendelse på din pakke.`,
      },
      { status: 400 }
    );
  }

  if (orgnrs.length > entitlements.emailsRemainingThisMonth) {
    return NextResponse.json(
      {
        error: `Du har ${entitlements.emailsRemainingThisMonth} e-poster igjen denne måneden (${entitlements.maxEmailsPerMonth} totalt). Oppgrader pakken for mer.`,
      },
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
