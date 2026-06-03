import type { WebsiteScanResult } from "@/lib/website-scan/types";

export async function loadSavedWebsiteScans(
  orgnrs?: string[],
  signal?: AbortSignal
): Promise<WebsiteScanResult[]> {
  const query =
    orgnrs && orgnrs.length > 0
      ? `?orgnrs=${encodeURIComponent(orgnrs.join(","))}`
      : "";
  const res = await fetch(`/api/website-scans${query}`, { signal });
  if (!res.ok) {
    console.error("[website-scans] Henting feilet:", res.status, res.statusText);
    return [];
  }
  const data = (await res.json()) as { scans?: WebsiteScanResult[] };
  return data.scans ?? [];
}

export async function persistWebsiteScans(scans: WebsiteScanResult[]) {
  if (scans.length === 0) return;

  try {
    const res = await fetch("/api/website-scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scans }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      console.error(
        "[website-scans] Lagring feilet:",
        data.error ?? res.statusText
      );
    }
  } catch (err) {
    console.error("[website-scans] Lagring feilet:", err);
  }
}

export function persistWebsiteScan(scan: WebsiteScanResult) {
  void persistWebsiteScans([scan]);
}
