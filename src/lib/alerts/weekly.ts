import { createServiceClient } from "@/lib/supabase/service";
import { sendEmailViaUserAccount } from "@/lib/email/send-via-account";
import { Resend } from "resend";
import type { FilterState } from "@/components/CompanyFilters";
import { regionLabel } from "@/lib/constants/regions";
import { industryGroupLabel } from "@/lib/constants/industries";
import { professionSearchLabel } from "@/lib/constants/professions";
import { kommuneBelongsToRegion } from "@/lib/constants/regions";
import { buildScanDeepLink } from "@/lib/alerts/scan-deep-link";

type AlertFilters = Partial<FilterState>;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function filterSummary(filters: AlertFilters): string {
  const parts: string[] = [];
  if (filters.regionId) parts.push(regionLabel(filters.regionId));
  if (filters.municipalityCode) parts.push(`kommune ${filters.municipalityCode}`);
  if (filters.industryGroup) parts.push(industryGroupLabel(filters.industryGroup));
  if (filters.professionSearch?.trim()) {
    parts.push(
      professionSearchLabel(filters.professionSearch.trim()) ??
        `yrke: ${filters.professionSearch.trim()}`
    );
  }
  if (filters.days === 0) parts.push("alle firma");
  else if (filters.days) parts.push(`siste ${filters.days} dager`);
  if (filters.hasEmail) parts.push("kun med e-post");
  if (filters.genericEmailOnly) parts.push("kun post@/info@");
  return parts.length > 0 ? parts.join(" · ") : "standardfilter";
}

async function countNewCompanies(
  filters: AlertFilters,
  sinceIso: string
): Promise<number> {
  const supabase = createServiceClient();
  const sinceDate = sinceIso.slice(0, 10);

  let query = supabase
    .from("companies")
    .select("orgnr, municipality_code, industry_code, registered_at, has_email, email_is_generic", {
      count: "exact",
      head: false,
    })
    .gte("registered_at", sinceDate);

  if (filters.municipalityCode) {
    query = query.eq("municipality_code", filters.municipalityCode);
  }
  if (filters.hasEmail) query = query.eq("has_email", true);
  if (filters.genericEmailOnly) query = query.eq("email_is_generic", true);

  const { data, count, error } = await query.limit(5000);
  if (error) throw new Error(error.message);

  let rows = data ?? [];
  if (filters.regionId && !filters.municipalityCode) {
    rows = rows.filter((r) =>
      r.municipality_code
        ? kommuneBelongsToRegion(r.municipality_code, filters.regionId!)
        : false
    );
  }

  return count != null && !filters.regionId ? count : rows.length;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return authUser?.user?.email ?? null;
}

export async function runWeeklyAlerts(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("user_id, weekly_alert_enabled, weekly_alert_filters, weekly_alert_last_sent_at")
    .eq("weekly_alert_enabled", true);

  if (error) throw new Error(error.message);

  /** Minst 4 dager mellom varsler (cron mandag + torsdag). */
  const defaultSince = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of settings ?? []) {
    const filters = (row.weekly_alert_filters ?? {}) as AlertFilters;
    const sinceIso = row.weekly_alert_last_sent_at ?? defaultSince;

    try {
      const count = await countNewCompanies(filters, sinceIso);
      if (count === 0) {
        skipped += 1;
        await supabase
          .from("user_settings")
          .update({ weekly_alert_last_sent_at: new Date().toISOString() })
          .eq("user_id", row.user_id);
        continue;
      }

      const toEmail = await getUserEmail(row.user_id);
      if (!toEmail) {
        errors.push(`${row.user_id}: ingen e-post på konto`);
        continue;
      }

      const summary = filterSummary(filters);
      const scanUrl = buildScanDeepLink(filters, {
        modus: "websites",
        web: "without",
      });
      const queueUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://nylead.no").replace(/\/$/, "")}/app/ko`;
      const subject = `${count} nye firma i ditt filter — NyLead`;
      const html = `
        <div style="font-family:sans-serif;line-height:1.6;max-width:520px">
          <h2 style="margin:0 0 12px">Nye leads i målgruppen din</h2>
          <p>Det er <strong>${count}</strong> nye firma siden forrige varsel:</p>
          <p style="color:#555">${summary}</p>
          <p>
            <a href="${scanUrl}"><strong>Åpne Skann</strong></a>
            (kjør Google-sjekk og se uten nettside)
            · <a href="${queueUrl}">Arbeidskø</a>
          </p>
          <p style="font-size:12px;color:#888">Du får varsel ca. 2 ganger i uken. Slå av under Innstillinger.</p>
        </div>
      `;

      try {
        await sendEmailViaUserAccount(row.user_id, { to: toEmail, subject, html });
      } catch {
        const resend = getResend();
        const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
        if (!resend) throw new Error("Ingen e-postkanal tilgjengelig");
        await resend.emails.send({ from, to: toEmail, subject, html });
      }

      sent += 1;
      await supabase
        .from("user_settings")
        .update({ weekly_alert_last_sent_at: new Date().toISOString() })
        .eq("user_id", row.user_id);
    } catch (err) {
      errors.push(
        `${row.user_id}: ${err instanceof Error ? err.message : "ukjent feil"}`
      );
    }
  }

  return { processed: settings?.length ?? 0, sent, skipped, errors };
}
