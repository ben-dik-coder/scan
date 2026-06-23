import type { QueueItemResponse } from "@/lib/sales/queue-score";

export function applyManusPlaceholders(
  html: string,
  item: Pick<
    QueueItemResponse,
    "name" | "orgnr" | "phone" | "email" | "dagligLeder"
  >
): string {
  const today = new Date().toLocaleDateString("nb-NO");
  return html
    .replaceAll("{{firma}}", escapeHtml(item.name))
    .replaceAll("{{kontakt}}", escapeHtml(item.dagligLeder ?? "kontaktperson"))
    .replaceAll("{{telefon}}", escapeHtml(item.phone ?? ""))
    .replaceAll("{{epost}}", escapeHtml(item.email ?? ""))
    .replaceAll("{{orgnr}}", escapeHtml(item.orgnr))
    .replaceAll("{{dato}}", escapeHtml(today));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function phoneTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}
