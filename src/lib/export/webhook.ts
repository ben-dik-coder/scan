import {
  postWebhook,
  type ExportWebhookPayload,
} from "@/lib/webhooks/dispatch";

export type { ExportWebhookPayload };

export async function postExportWebhook(
  url: string,
  payload: ExportWebhookPayload
): Promise<{ ok: boolean; error?: string }> {
  return postWebhook(url, payload);
}
