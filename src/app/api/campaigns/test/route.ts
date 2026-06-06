import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import { buildCampaignVars } from "@/lib/email/campaign-vars";
import { getPreferredMailAccount } from "@/lib/email/oauth/accounts";
import { sendViaGmail } from "@/lib/email/oauth/google";
import { sendViaMicrosoft } from "@/lib/email/oauth/microsoft";
import { sendViaOutlookSmtp } from "@/lib/email/smtp/outlook";
import { renderTemplate } from "@/lib/email/utils";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    subject,
    body: emailBody,
    previewOrgnr,
    mailProvider,
    mailAccountId,
  } = body as {
    subject?: string;
    body?: string;
    previewOrgnr?: string;
    mailProvider?: "google" | "microsoft" | "smtp";
    mailAccountId?: string;
  };

  if (!subject?.trim() || !emailBody?.trim() || !previewOrgnr?.trim()) {
    return NextResponse.json(
      { error: "Emne, melding og firma for forhåndsvisning er påkrevd." },
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

  if (entitlements.emailsRemainingThisMonth < 1) {
    return NextResponse.json(
      {
        error: `Du har ${entitlements.emailsRemainingThisMonth} e-poster igjen denne måneden.`,
      },
      { status: 400 }
    );
  }

  const userMail = await getPreferredMailAccount(
    user.id,
    typeof mailAccountId === "string" && mailAccountId.trim()
      ? { accountId: mailAccountId.trim() }
      : mailProvider === "google" ||
          mailProvider === "microsoft" ||
          mailProvider === "smtp"
        ? mailProvider
        : undefined
  );

  if (!userMail) {
    return NextResponse.json(
      { error: "Koble Gmail eller Outlook under Innstillinger først." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("orgnr, name")
    .eq("orgnr", previewOrgnr)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Fant ikke firma for forhåndsvisning." }, { status: 404 });
  }

  const vars = buildCampaignVars(company);
  const renderedSubject = `[TEST] ${renderTemplate(subject.trim(), vars)}`;
  const bodyHtml = renderTemplate(emailBody.trim(), vars).replace(/\n/g, "<br>");
  const html = `
    <div style="font-family:sans-serif;line-height:1.6">
      <p style="font-size:12px;color:#888;margin-bottom:16px">
        Dette er en test-e-post fra NyLead. Den ble ikke sendt til noen kunde.
      </p>
      ${bodyHtml}
    </div>
  `;

  try {
    if (userMail.provider === "google") {
      await sendViaGmail({
        accessToken: userMail.accessToken,
        fromEmail: userMail.email,
        to: userMail.email,
        subject: renderedSubject,
        html,
      });
    } else if (userMail.provider === "smtp") {
      await sendViaOutlookSmtp({
        email: userMail.email,
        appPassword: userMail.accessToken,
        to: userMail.email,
        subject: renderedSubject,
        html,
      });
    } else {
      await sendViaMicrosoft({
        accessToken: userMail.accessToken,
        to: userMail.email,
        subject: renderedSubject,
        html,
      });
    }

    return NextResponse.json({
      ok: true,
      to: userMail.email,
      subject: renderedSubject,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test-sending feilet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
