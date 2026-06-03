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

export async function postExportWebhook(
  url: string,
  payload: ExportWebhookPayload
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
