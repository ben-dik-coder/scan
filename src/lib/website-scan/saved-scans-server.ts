import { createClient } from "@/lib/supabase/server";
import { forEachOrgnrBatch } from "@/lib/supabase/query-batches";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

type ScanRow = {
  orgnr: string;
  scan: WebsiteScanResult;
  scanned_at: string;
};

/**
 * Delt plattform-cache: én rad per orgnr i `company_website_scans`.
 * Når bruker A har sjekket et firma, gjenbruker bruker B samme resultat uten nye API-kall.
 * Re-skanning skjer bare ved «Sjekk på nytt» eller når cache mangler felt (f.eks. Gulesider).
 */
export const WEBSITE_SCAN_CACHE_POLICY = "shared_per_orgnr" as const;

export function isWebsiteScanResult(value: unknown): value is WebsiteScanResult {
  if (!value || typeof value !== "object") return false;
  const scan = value as Partial<WebsiteScanResult>;
  return typeof scan.orgnr === "string" && scan.orgnr.length > 0;
}

export function parseOrgnrs(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
}

export async function loadCachedWebsiteScans(
  orgnrs: string[]
): Promise<WebsiteScanResult[]> {
  if (orgnrs.length === 0) return [];

  const supabase = await createClient();
  const rows = await forEachOrgnrBatch<ScanRow>(orgnrs, 80, async (batch) => {
    const { data, error } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan, scanned_at")
      .in("orgnr", batch);

    if (error) {
      console.error("[website-scans] GET cache failed:", error.message);
      return [];
    }
    return (data ?? []) as ScanRow[];
  });

  return rows.map((row) => row.scan).filter(isWebsiteScanResult);
}

export async function persistCachedWebsiteScans(
  scans: WebsiteScanResult[],
  userId: string
): Promise<{ error?: string; saved: number }> {
  const valid = scans.filter(isWebsiteScanResult);
  if (valid.length === 0) {
    return { error: "Ingen gyldige skann", saved: 0 };
  }

  const rows = valid.map((scan) => ({
    orgnr: scan.orgnr,
    scan,
    scanned_at: scan.scannedAt || new Date().toISOString(),
    scanned_by: userId,
  }));

  const supabase = await createClient();
  const { error } = await supabase.from("company_website_scans").upsert(rows, {
    onConflict: "orgnr",
  });

  if (error) {
    console.error("[website-scans] POST cache failed:", error.message);
    return { error: error.message, saved: 0 };
  }

  return { saved: rows.length };
}
