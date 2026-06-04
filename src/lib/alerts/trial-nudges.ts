import { createServiceClient } from "@/lib/supabase/service";
import { sendEmailViaUserAccount } from "@/lib/email/send-via-account";
import { Resend } from "resend";
import { buildScanDeepLink } from "@/lib/alerts/scan-deep-link";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import type { FilterState } from "@/components/CompanyFilters";

const TRIAL_LENGTH_DAYS = 7;
const NUDGE_DAYS = [3, 5, 7] as const;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function trialDayNumber(periodEndIso: string | null): number | null {
  if (!periodEndIso) return null;
  const end = new Date(periodEndIso);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(end.getTime() - TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
  const day = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (day < 1 || day > TRIAL_LENGTH_DAYS) return null;
  return day;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return authUser?.user?.email ?? null;
}

function nudgeCopy(
  day: (typeof NUDGE_DAYS)[number],
  scanUrl: string
): { subject: string; html: string } {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://nylead.no").replace(/\/$/, "");
  if (day === 3) {
    return {
      subject: "Prøv å finne firma uten nettside — NyLead",
      html: `
        <div style="font-family:sans-serif;line-height:1.6;max-width:520px">
          <h2 style="margin:0 0 12px">Dag 3 av prøveperioden</h2>
          <p>Tips: Velg opptil 10 firma og kjør <strong>Google-sjekk</strong>. Filtrer til <strong>uten nettside</strong> — det er der webbyrå ofte vinner.</p>
          <p><a href="${scanUrl}"><strong>Åpne Skann</strong></a></p>
          <p style="font-size:12px;color:#888"><a href="${appUrl}/app/ko">Arbeidskø</a> · <a href="${appUrl}/app/innstillinger">Innstillinger</a></p>
        </div>
      `,
    };
  }
  if (day === 5) {
    return {
      subject: "Ta kontakt med 3 firma i dag — NyLead",
      html: `
        <div style="font-family:sans-serif;line-height:1.6;max-width:520px">
          <h2 style="margin:0 0 12px">Dag 5 — tid for oppfølging</h2>
          <p>Har du sendt til noen ennå? Mange starter med <strong>3 e-poster</strong> til firma uten nettside fra arbeidskøen.</p>
          <p><a href="${scanUrl}"><strong>Se leads på Skann</strong></a> · <a href="${appUrl}/app/ko"><strong>Arbeidskø</strong></a></p>
          <p style="font-size:12px;color:#888">Prøveperioden varer ca. ${TRIAL_LENGTH_DAYS} dager.</p>
        </div>
      `,
    };
  }
  return {
    subject: "Siste dag av prøveperioden — NyLead",
    html: `
      <div style="font-family:sans-serif;line-height:1.6;max-width:520px">
        <h2 style="margin:0 0 12px">Siste dag i prøven</h2>
        <p>I morgen avsluttes prøveperioden. Sørg for at du har testet Skann + minst én utsendelse fra din e-post.</p>
        <p><a href="${appUrl}/app/abonnement"><strong>Behold tilgang — 499 kr/mnd</strong></a></p>
        <p><a href="${scanUrl}">Åpne Skann</a></p>
      </div>
    `,
  };
}

export async function runTrialNudges(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, subscription_status, subscription_current_period_end")
    .eq("subscription_status", "trialing");

  if (profileErr) throw new Error(profileErr.message);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const day = trialDayNumber(profile.subscription_current_period_end);
    if (!day || !NUDGE_DAYS.includes(day as (typeof NUDGE_DAYS)[number])) {
      skipped += 1;
      continue;
    }

    const dayKey = String(day);

    try {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("trial_nudges_sent, weekly_alert_filters")
        .eq("user_id", profile.id)
        .maybeSingle();

      const sentMap = (settings?.trial_nudges_sent ?? {}) as Record<string, boolean>;
      if (sentMap[dayKey]) {
        skipped += 1;
        continue;
      }

      const toEmail = await getUserEmail(profile.id);
      if (!toEmail) {
        errors.push(`${profile.id}: ingen e-post`);
        continue;
      }

      const stored = settings?.weekly_alert_filters as Partial<FilterState> | null;
      const filters: Partial<FilterState> =
        stored && Object.keys(stored).length > 0
          ? stored
          : { ...DEFAULT_MARKET_FILTERS, days: 30, industryGroup: "" };

      const scanUrl = buildScanDeepLink(filters, {
        modus: "websites",
        web: "without",
      });

      const { subject, html } = nudgeCopy(
        day as (typeof NUDGE_DAYS)[number],
        scanUrl
      );

      try {
        await sendEmailViaUserAccount(profile.id, { to: toEmail, subject, html });
      } catch {
        const resend = getResend();
        const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
        if (!resend) throw new Error("Ingen e-postkanal");
        await resend.emails.send({ from, to: toEmail, subject, html });
      }

      await supabase.from("user_settings").upsert(
        {
          user_id: profile.id,
          trial_nudges_sent: { ...sentMap, [dayKey]: true },
        },
        { onConflict: "user_id" }
      );

      sent += 1;
    } catch (err) {
      errors.push(
        `${profile.id}: ${err instanceof Error ? err.message : "ukjent"}`
      );
    }
  }

  return { processed: profiles?.length ?? 0, sent, skipped, errors };
}
