import { createServiceClient } from "@/lib/supabase/service";
import { computeLeadScore } from "@/lib/sales/lead-score";
import type { Company } from "@/types/database";

export type QueueWebhookPayload = {
  event: "lead.queued";
  queuedAt: string;
  lead: {
    orgnr: string;
    name: string;
    email: string | null;
    phone: string | null;
    municipalityName: string | null;
    registeredAt: string | null;
    score: number;
    status: string;
  };
};

export type ExportWebhookPayload = {
  event: "export";
  exportedAt: string;
  count: number;
  companies: Array<{
    orgnr: string;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    score: number | null;
    dagligLeder: string | null;
  }>;
};

export async function postWebhook(
  url: string,
  payload: QueueWebhookPayload | ExportWebhookPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook svarte ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Webhook feilet",
    };
  }
}

export async function getUserWebhookUrl(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_settings")
    .select("webhook_url")
    .eq("user_id", userId)
    .maybeSingle();
  const url = data?.webhook_url?.trim();
  return url || null;
}

/** Send webhook når et lead legges i arbeidskø (status «ny»). */
export async function notifyLeadQueued(userId: string, orgnr: string): Promise<void> {
  const webhookUrl = await getUserWebhookUrl(userId);
  if (!webhookUrl) return;

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("orgnr", orgnr)
    .maybeSingle();

  if (!company) return;

  const c = company as Company;
  const score = computeLeadScore(c);

  await postWebhook(webhookUrl, {
    event: "lead.queued",
    queuedAt: new Date().toISOString(),
    lead: {
      orgnr: c.orgnr,
      name: c.name,
      email: c.email,
      phone: c.phone ?? c.mobile,
      municipalityName: c.municipality_name,
      registeredAt: c.registered_at,
      score,
      status: "ny",
    },
  });
}
