import { Resend } from "resend";
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

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendCampaign(
  userId: string,
  input: SendCampaignInput
): Promise<SendCampaignResult & { campaignId: string | null }> {
  const supabase = createServiceClient();
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

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
      errors: ["Ingen gyldige mottakere å sende til."],
    };
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .insert({
      user_id: userId,
      subject: input.subject,
      body: input.body,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Kunne ikke opprette kampanje");
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of toSend) {
    const bodyHtml = renderTemplate(input.body, {
      firmanavn: recipient.name,
      orgnr: recipient.orgnr,
    }).replace(/\n/g, "<br>");

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

    const { data: recipientRow } = await supabase
      .from("email_campaign_recipients")
      .insert({
        campaign_id: campaign.id,
        orgnr: recipient.orgnr,
        email: recipient.email,
        status: "pending",
      })
      .select("id")
      .single();

    if (!resend) {
      failed += 1;
      errors.push("RESEND_API_KEY mangler — e-post ble ikke sendt.");
      if (recipientRow) {
        await supabase
          .from("email_campaign_recipients")
          .update({
            status: "failed",
            error_message: "RESEND_API_KEY mangler",
          })
          .eq("id", recipientRow.id);
      }
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from,
        to: recipient.email,
        subject: renderTemplate(input.subject, { firmanavn: recipient.name }),
        html,
      });

      if (error) {
        failed += 1;
        errors.push(`${recipient.email}: ${error.message}`);
        if (recipientRow) {
          await supabase
            .from("email_campaign_recipients")
            .update({
              status: "failed",
              error_message: error.message,
            })
            .eq("id", recipientRow.id);
        }
      } else {
        sent += 1;
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
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "Ukjent feil";
      errors.push(`${recipient.email}: ${msg}`);
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
    errors,
  };
}
