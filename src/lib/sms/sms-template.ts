import type { QueueItemResponse } from "@/lib/sales/queue-score";

const STORAGE_KEY = "nylead-sms-template-v1";

export const DEFAULT_SMS_TEMPLATE = `Hei {{kontakt}}! Jeg tar kontakt angående {{firma}}. Har du tid til en kort prat?`;

export function loadSmsTemplate(): string {
  if (typeof window === "undefined") return DEFAULT_SMS_TEMPLATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw?.trim() ? raw : DEFAULT_SMS_TEMPLATE;
  } catch {
    return DEFAULT_SMS_TEMPLATE;
  }
}

export function saveSmsTemplate(text: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, text);
}

export function applySmsPlaceholders(
  text: string,
  item: Pick<QueueItemResponse, "name" | "orgnr" | "phone" | "email" | "dagligLeder">
): string {
  const today = new Date().toLocaleDateString("nb-NO");
  const kontakt = item.dagligLeder?.trim() || "du";
  return text
    .replaceAll("{{firma}}", item.name)
    .replaceAll("{{kontakt}}", kontakt)
    .replaceAll("{{telefon}}", item.phone ?? "")
    .replaceAll("{{epost}}", item.email ?? "")
    .replaceAll("{{orgnr}}", item.orgnr)
    .replaceAll("{{dato}}", today);
}

export function smsHref(phone: string, body: string): string {
  const digits = phone.replace(/\s/g, "");
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}

export function smsSegmentCount(text: string): number {
  if (!text.length) return 0;
  const hasUnicode = /[^\x00-\x7F]/.test(text);
  const perSegment = hasUnicode ? 70 : 160;
  return Math.ceil(text.length / perSegment);
}
