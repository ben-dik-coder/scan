import { createHmac, randomBytes } from "crypto";
import { isPersonalEmail } from "@/lib/brreg/map-company";

const UNSUBSCRIBE_SECRET =
  process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret";

export function createUnsubscribeToken(email: string): string {
  const payload = Buffer.from(email.toLowerCase()).toString("base64url");
  const sig = createHmac("sha256", UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase())
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const email = Buffer.from(payload, "base64url").toString("utf8");
  const expected = createHmac("sha256", UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase())
    .digest("base64url");

  if (sig !== expected) return null;
  return email;
}

export function buildUnsubscribeUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = createUnsubscribeToken(email);
  return `${base}/avmeld?token=${encodeURIComponent(token)}`;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export type SendCampaignInput = {
  subject: string;
  subjectB?: string;
  body: string;
  recipients: Array<{ orgnr: string; email: string; name: string }>;
  allowPersonal?: boolean;
};

export type SendCampaignResult = {
  sent: number;
  failed: number;
  blocked: number;
  unsubscribed: number;
  errors: string[];
};

export function validateRecipientsForSend(
  recipients: SendCampaignInput["recipients"],
  unsubscribedEmails: Set<string>,
  allowPersonal: boolean
): {
  toSend: SendCampaignInput["recipients"];
  blocked: number;
  unsubscribed: number;
} {
  const toSend: SendCampaignInput["recipients"] = [];
  let blocked = 0;
  let unsubscribed = 0;

  for (const r of recipients) {
    const email = r.email.toLowerCase();
    if (unsubscribedEmails.has(email)) {
      unsubscribed += 1;
      continue;
    }
    if (!allowPersonal && isPersonalEmail(email)) {
      blocked += 1;
      continue;
    }
    toSend.push(r);
  }

  return { toSend, blocked, unsubscribed };
}

export function generateCampaignId(): string {
  return randomBytes(16).toString("hex");
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
