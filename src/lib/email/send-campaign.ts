import { Resend } from "resend";
import { buildCampaignVars } from "./campaign-vars";
import {
  buildUnsubscribeUrl,
  renderTemplate,
  sleep,
  type SendCampaignInput,
  type SendCampaignResult,
  validateRecipientsForSend,
} from "./utils";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity, upsertUserLead } from "@/lib/sales/activities";
import { getPreferredMailAccount } from "@/lib/email/oauth/accounts";
import { sendViaGmail } from "@/lib/email/oauth/google";
import { sendViaMicrosoft } from "@/lib/email/oauth/microsoft";
import { sendViaOutlookSmtp } from "@/lib/email/smtp/outlook";
import type { MailProvider } from "@/lib/email/oauth/config";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendCampaign(
  userId: string,
  input: SendCampaignInput & {
    mailProvider?: MailProvider;
    mailAccountId?: string;
  }
): Promise<SendCampaignResult & { campaignId: string | null; fromEmail?: string }> {
  const supabase = createServiceClient();
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const userMail = await getPreferredMailAccount(
    userId,
    input.mailAccountId
      ? { accountId: input.mailAccountId }
      : input.mailProvider
  );

  const { data: unsubRows } = await supabase
    .from("email_unsubscribes")
    .select("email");

  const unsubscribedEmails = new Set(
    (unsubRows ?? []).map((r) => r.email.toLowerCase())
  );

  const { toSend, blocked, unsubscribed } = validateRecipientsForSend(
    input.recipients,
    unsubscribedEmails,
    input.allowPersonal ?? false
  );

  if (toSend.length === 0) {
    return {
      campaignId: null,
      sent: 0,
      failed: 0,
      blocked,
      unsubscribed,
      sentOrgnrs: [] as string[],
      errors: ["Ingen gyldige mottakere å sende til."],
    };
  }

  const subjectB = input.subjectB?.trim() || null;
  const useAb = Boolean(subjectB);

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .insert({
      user_id: userId,
      subject: input.subject,
      subject_b: subjectB,
      body: input.body,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Kunne ikke opprette kampanje");
  }

  let sent = 0;
  let failed = 0;
  const sentOrgnrs: string[] = [];
  const errors: string[] = [];

  for (const recipient of toSend) {
    const vars = buildCampaignVars({ name: recipient.name, orgnr: recipient.orgnr });
    const bodyHtml = renderTemplate(input.body, vars).replace(/\n/g, "<br>");

    const unsubscribeUrl = buildUnsubscribeUrl(recipient.email);
    const html = `
      <div style="font-family:sans-serif;line-height:1.6">
        ${bodyHtml}
        <hr style="margin:24px 0;border:none;border-top:1px solid #ddd" />
        <p style="font-size:12px;color:#666">
          Dette er en markedsføringshenvendelse.
          <a href="${unsubscribeUrl}">Meld deg av</a> fremtidige e-poster.
        </p>
      </div>
    `;

    const abVariant: "a" | "b" | null = useAb
      ? Math.random() < 0.5
        ? "a"
        : "b"
      : null;
    const subjectTemplate =
      abVariant === "b" && subjectB ? subjectB : input.subject;

    const { data: recipientRow } = await supabase
      .from("email_campaign_recipients")
      .insert({
        campaign_id: campaign.id,
        orgnr: recipient.orgnr,
        email: recipient.email,
        status: "pending",
        ab_variant: abVariant,
      })
      .select("id")
      .single();

    const renderedSubject = renderTemplate(subjectTemplate, vars);

    if (!userMail && !resend) {
      failed += 1;
      const msg =
        "Koble Gmail eller Outlook under Innstillinger (eller SMTP app-passord), eller sett RESEND_API_KEY.";
      errors.push(msg);
      if (recipientRow) {
        await supabase
          .from("email_campaign_recipients")
          .update({ status: "failed", error_message: msg })
          .eq("id", recipientRow.id);
      }
      continue;
    }

    try {
      if (userMail) {
        if (userMail.provider === "google") {
          await sendViaGmail({
            accessToken: userMail.accessToken,
            fromEmail: userMail.email,
            to: recipient.email,
            subject: renderedSubject,
            html,
            attachments: input.attachments,
          });
        } else if (userMail.provider === "smtp") {
          await sendViaOutlookSmtp({
            email: userMail.email,
            appPassword: userMail.accessToken,
            to: recipient.email,
            subject: renderedSubject,
            html,
            attachments: input.attachments,
          });
        } else {
          await sendViaMicrosoft({
            accessToken: userMail.accessToken,
            to: recipient.email,
            subject: renderedSubject,
            html,
            attachments: input.attachments,
          });
        }
      } else if (resend) {
        const { error } = await resend.emails.send({
          from,
          to: recipient.email,
          subject: renderedSubject,
          html,
        });
        if (error) {
          throw new Error(error.message);
        }
      }

      sent += 1;
      sentOrgnrs.push(recipient.orgnr);
      const now = new Date().toISOString();
      if (recipientRow) {
        await supabase
          .from("email_campaign_recipients")
          .update({
            status: "sent",
            sent_at: now,
          })
          .eq("id", recipientRow.id);
      }
      await upsertUserLead(userId, recipient.orgnr, {
        status: "kontaktet",
        last_contacted_at: now,
      });
      await logActivity(
        userId,
        recipient.orgnr,
        "email_sent",
        `E-post sendt: ${input.subject}`,
        { campaign_id: campaign.id }
      );
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "Ukjent feil";
      errors.push(`${recipient.email}: ${msg}`);
      if (recipientRow) {
        await supabase
          .from("email_campaign_recipients")
          .update({ status: "failed", error_message: msg })
          .eq("id", recipientRow.id);
      }
    }

    await sleep(100);
  }

  await supabase
    .from("email_campaigns")
    .update({ sent_count: sent, failed_count: failed })
    .eq("id", campaign.id);

  return {
    campaignId: campaign.id,
    sent,
    failed,
    blocked,
    unsubscribed,
    sentOrgnrs,
    errors,
    fromEmail: userMail?.email,
  };
}
