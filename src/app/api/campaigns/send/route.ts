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
  const {
    subject,
    subjectB,
    body: emailBody,
    orgnrs,
    recipients: clientRecipients,
    allowPersonal,
    mailProvider,
  } = body as {
    subject?: string;
    subjectB?: string;
    body?: string;
    orgnrs?: string[];
    recipients?: Array<{ orgnr: string; email: string; name: string }>;
    allowPersonal?: boolean;
    mailProvider?: "google" | "microsoft" | "smtp";
  };

  const hasClientRecipients = Boolean(clientRecipients?.length);
  const targetOrgnrs = hasClientRecipients
    ? clientRecipients!.map((r) => r.orgnr)
    : orgnrs;

  if (!subject?.trim() || !emailBody?.trim() || !targetOrgnrs?.length) {
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

  if (targetOrgnrs.length > entitlements.maxRecipientsPerSend) {
    return NextResponse.json(
      {
        error: `Maks ${entitlements.maxRecipientsPerSend} mottakere per utsendelse på din pakke.`,
      },
      { status: 400 }
    );
  }

  if (targetOrgnrs.length > entitlements.emailsRemainingThisMonth) {
    return NextResponse.json(
      {
        error: `Du har ${entitlements.emailsRemainingThisMonth} e-poster igjen denne måneden (${entitlements.maxEmailsPerMonth} totalt).`,
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  let recipients: Array<{ orgnr: string; email: string; name: string }>;

  if (hasClientRecipients) {
    const { data: companies, error } = await supabase
      .from("companies")
      .select("orgnr, name")
      .in("orgnr", targetOrgnrs);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const companyByOrgnr = new Map((companies ?? []).map((c) => [c.orgnr, c.name]));
    recipients = clientRecipients!
      .filter((r) => companyByOrgnr.has(r.orgnr) && r.email?.trim())
      .map((r) => ({
        orgnr: r.orgnr,
        email: r.email.trim(),
        name: r.name?.trim() || companyByOrgnr.get(r.orgnr) || r.orgnr,
      }));
  } else {
    const { data: companies, error } = await supabase
      .from("companies")
      .select("orgnr, name, email, has_email")
      .in("orgnr", targetOrgnrs!)
      .eq("has_email", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    recipients = (companies ?? [])
      .filter((c) => c.email)
      .map((c) => ({
        orgnr: c.orgnr,
        email: c.email as string,
        name: c.name,
      }));
  }

  try {
    const result = await sendCampaign(user.id, {
      subject,
      subjectB: subjectB?.trim() || undefined,
      body: emailBody,
      recipients,
      allowPersonal: Boolean(allowPersonal),
      mailProvider:
        mailProvider === "google" ||
        mailProvider === "microsoft" ||
        mailProvider === "smtp"
          ? mailProvider
          : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
