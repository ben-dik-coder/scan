import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://nylead.no").replace(/\/$/, "");
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

/** One-time NyLead welcome mail after the user confirms their email. */
export async function sendWelcomeEmailIfNeeded(userId: string): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const supabase = createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("welcome_email_sent_at, company_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[welcome-email] profile read", profileError.message);
    return { sent: false, reason: profileError.message };
  }

  if (profile?.welcome_email_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);
  if (authError || !authData.user?.email) {
    return { sent: false, reason: authError?.message ?? "missing_email" };
  }

  if (!authData.user.email_confirmed_at) {
    return { sent: false, reason: "not_confirmed" };
  }

  const resend = getResend();
  if (!resend) {
    console.warn("[welcome-email] RESEND_API_KEY mangler — hopper over");
    return { sent: false, reason: "missing_resend" };
  }

  const email = authData.user.email;
  const name =
    profile?.company_name?.trim() ||
    (typeof authData.user.user_metadata?.company_name === "string"
      ? authData.user.user_metadata.company_name.trim()
      : "") ||
    email.split("@")[0] ||
    "der";
  const base = appUrl();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "NyLead <onboarding@resend.dev>";

  const { error: sendError } = await resend.emails.send({
    from,
    to: email,
    subject: "Velkommen til NyLead",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;max-width:520px;color:#111">
        <h1 style="font-size:22px;margin:0 0 12px">Hei${name ? `, ${name}` : ""} 👋</h1>
        <p style="margin:0 0 12px;color:#333">
          Kontoen din er aktivert. Du er klar til å finne nye firma og ta kontakt.
        </p>
        <p style="margin:0 0 20px">
          <a href="${base}/app/oversikt"
             style="display:inline-block;background:#10b981;color:#000;font-weight:600;text-decoration:none;padding:12px 18px;border-radius:10px">
            Åpne NyLead
          </a>
        </p>
        <p style="margin:0 0 8px;color:#555;font-size:14px">
          Tips: Start i <strong>Skann</strong>, filtrer på område, og lagre de beste i en liste.
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#888">
          NyLead · <a href="${base}" style="color:#059669">${base.replace(/^https?:\/\//, "")}</a>
        </p>
      </div>
    `,
  });

  if (sendError) {
    console.error("[welcome-email] send failed", sendError);
    return { sent: false, reason: sendError.message };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", userId)
    .is("welcome_email_sent_at", null);

  if (updateError) {
    console.error("[welcome-email] mark sent", updateError.message);
  }

  return { sent: true };
}
