"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_AUTO_WEBSITE_SCAN,
  MAX_WEBSITE_SCAN_BATCH,
} from "@/lib/constants/market";
import { quickScanFromEmail } from "@/lib/website-scan/client-quick-scan";
import { isWebsiteScanCacheComplete } from "@/lib/website-scan/scan-cache";
import { isDemoMode } from "@/lib/demo/config";
import {
  DEFAULT_SCAN_SOCIAL_OPTIONS,
  type ScanSocialOptions,
} from "@/lib/website-scan/scan-social-options";
import type { Company } from "@/types/database";
import { shuffleScanBatch } from "@/lib/shuffle/scan-shuffle";
import {
  loadSavedWebsiteScans,
  persistWebsiteScan,
} from "@/lib/website-scan/saved-scans-client";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

type Progress = {
  done: number;
  total: number;
};

const SCAN_ONE_TIMEOUT_MS = 90_000;

/** Lar React tegne fremdriftslinjen mellom hvert firma */
function yieldToUi() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function buildScanKey(companies: Company[]): string {
  return companies
    .filter((c) => c.has_email)
    .slice(0, MAX_AUTO_WEBSITE_SCAN)
    .map((c) => c.orgnr)
    .join(",");
}

export function useAutoWebsiteScan(
  companies: Company[],
  options?: {
    /** Start ikke Google automatisk — bruker velger selv */
    autoScan?: boolean;
    socialOptions?: ScanSocialOptions;
  }
) {
  const autoScan = options?.autoScan ?? false;
  const socialOptionsRef = useRef<ScanSocialOptions>(
    options?.socialOptions ?? DEFAULT_SCAN_SOCIAL_OPTIONS
  );
  socialOptionsRef.current =
    options?.socialOptions ?? DEFAULT_SCAN_SOCIAL_OPTIONS;
  const [websiteScans, setWebsiteScans] = useState<Map<string, WebsiteScanResult>>(
    () => new Map()
  );
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [scanningName, setScanningName] = useState<string | null>(null);
  const scanGenRef = useRef(0);

  const scanKey = useMemo(() => buildScanKey(companies), [companies]);

  const scanTargetCount = useMemo(
    () =>
      companies.filter((c) => c.has_email).slice(0, MAX_AUTO_WEBSITE_SCAN).length,
    [companies]
  );

  const [scanningOrgnrs, setScanningOrgnrs] = useState<Set<string>>(() => new Set());

  const runScan = useCallback(
    async (
      targets: Company[],
      gen: number,
      options?: { merge?: boolean; forceRescan?: boolean }
    ) => {
      if (targets.length === 0) return [];

      const isActive = () => gen === scanGenRef.current;
      const merge = options?.merge ?? false;
      const forceRescan = options?.forceRescan ?? false;

      const social = socialOptionsRef.current;
      const needsFreshScan = (orgnr: string) => {
        const saved = websiteScansRef.current.get(orgnr);
        if (!saved) return true;
        return !isWebsiteScanCacheComplete(saved, social);
      };

      // Gjenbruk lagret skann — aldri kall SerpAPI på nytt uten «Sjekk på nytt».
      const toScan = forceRescan
        ? targets
        : targets.filter((c) => needsFreshScan(c.orgnr));

      if (toScan.length === 0) {
        if (isActive()) setScanComplete(true);
        return [];
      }

      setScanning(true);
      setError(null);
      setScanComplete(false);
      setProgress({ done: 0, total: toScan.length });
      if (!merge) setWebsiteScans(new Map());
      setScanningOrgnrs(new Set(toScan.map((c) => c.orgnr)));
      setScanningName(null);

      const allResults: WebsiteScanResult[] = [];
      let failedCount = 0;

      try {
        void fetch("/api/website-scan")
          .then((r) => r.json())
          .then((status) => {
            if (isActive()) setProviders(status.providers ?? []);
          })
          .catch((err) => {
            console.error("[website-scan] Kunne ikke hente provider-status:", err);
          });

        for (let i = 0; i < toScan.length; i++) {
          if (!isActive()) break;

          const company = toScan[i]!;
          setScanningName(company.name);
          setProgress({ done: i, total: toScan.length });

          const quick =
            isDemoMode() &&
            !social.includeFacebook &&
            !social.includeInstagram
              ? quickScanFromEmail(company)
              : null;
          if (quick) {
            allResults.push(quick);
            if (isActive()) {
              setProgress({ done: i + 1, total: toScan.length });
              setWebsiteScans((prev) => new Map(prev).set(company.orgnr, quick));
              persistWebsiteScan(quick);
              await yieldToUi();
            }
            continue;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), SCAN_ONE_TIMEOUT_MS);

          try {
            const res = await fetch("/api/website-scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                companies: [
                  {
                    orgnr: company.orgnr,
                    name: company.name,
                    email: company.email,
                    municipality_name: company.municipality_name,
                    city: company.city,
                    website: company.website,
                    industry_code: company.industry_code,
                  },
                ],
                social: socialOptionsRef.current,
                forceRescan,
              }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Google-skanning feilet");

            const batchResults = (data.results ?? []) as WebsiteScanResult[];
            const result = batchResults[0];
            if (!result) {
              failedCount += 1;
              if (isActive()) {
                setProgress({ done: i + 1, total: toScan.length });
                await yieldToUi();
              }
              continue;
            }

            allResults.push(result);

            if (isActive()) {
              setProgress({ done: i + 1, total: toScan.length });
              setWebsiteScans((prev) => new Map(prev).set(company.orgnr, result));
              persistWebsiteScan(result);
              await yieldToUi();
            }
          } catch (err) {
            if (!isActive()) break;
            failedCount += 1;
            console.error(`[website-scan] Feil for ${company.name}:`, err);
            if (isActive()) {
              setProgress({ done: i + 1, total: toScan.length });
              await yieldToUi();
            }
          } finally {
            clearTimeout(timeout);
          }
        }

        if (isActive()) {
          setScanComplete(true);
          if (failedCount > 0) {
            setError(
              failedCount === 1
                ? "1 firma feilet — prøv «Sjekk på nytt»"
                : `${failedCount} firma feilet — prøv «Sjekk på nytt»`
            );
          }
        }
        return allResults;
      } catch (err) {
        if (isActive()) {
          setError(err instanceof Error ? err.message : "Ukjent feil");
        }
        return allResults;
      } finally {
        if (isActive()) {
          setScanning(false);
          setScanningName(null);
          setScanningOrgnrs(new Set());
        }
      }
    },
    []
  );

  const companyListKey = useMemo(
    () => companies.map((c) => c.orgnr).join(","),
    [companies]
  );

  const websiteScansRef = useRef(websiteScans);
  websiteScansRef.current = websiteScans;

  useEffect(() => {
    const withEmail = companies.filter((c) => c.has_email);
    setTruncated(withEmail.length > MAX_WEBSITE_SCAN_BATCH);

    if (!autoScan) return;

    const toScan = shuffleScanBatch(withEmail, "auto").slice(
      0,
      MAX_AUTO_WEBSITE_SCAN
    );
    if (toScan.length === 0) {
      setScanComplete(false);
      setWebsiteScans(new Map());
      return;
    }

    const gen = ++scanGenRef.current;
    void runScan(toScan, gen, { merge: false });

    return () => {
      scanGenRef.current += 1;
    };
  }, [scanKey, runScan, autoScan, companies]);

  /** Hent lagrede skann når synlige firma endres (filter, side, liste). */
  useEffect(() => {
    const orgnrs = companies.map((c) => c.orgnr);
    const orgnrSet = new Set(orgnrs);

    setScanComplete(false);
    setError(null);

    if (orgnrs.length === 0) {
      setWebsiteScans(new Map());
      return;
    }

    const controller = new AbortController();

    void (async () => {
      const savedScans = await loadSavedWebsiteScans(orgnrs, controller.signal);
      if (controller.signal.aborted) return;

      setWebsiteScans((prev) => {
        const next = new Map<string, WebsiteScanResult>();
        for (const scan of savedScans) {
          if (orgnrSet.has(scan.orgnr)) next.set(scan.orgnr, scan);
        }
        // Behold skann fra samme økt (f.eks. nettopp ferdig) mens vi venter på DB
        prev.forEach((scan, orgnr) => {
          if (orgnrSet.has(orgnr)) next.set(orgnr, scan);
        });
        return next;
      });
    })();

    return () => controller.abort();
  }, [companyListKey, companies]);

  const rescan = useCallback(() => {
    const pool = companies.filter((c) => c.has_email);
    const toScan = shuffleScanBatch(pool, "rescan-all").slice(
      0,
      MAX_WEBSITE_SCAN_BATCH
    );
    const gen = ++scanGenRef.current;
    void runScan(toScan, gen, { merge: true, forceRescan: true });
  }, [companies, runScan]);

  /**
   * Google-sjekk for avhukede firma (maks 10).
   * Manuelt valg: behold rekkefølgen brukeren valgte.
   */
  const scanCompanies = useCallback(
    (targets: Company[], options?: { preserveOrder?: boolean }) => {
      if (targets.length === 0) {
        return {
          ok: false as const,
          message: "Velg minst ett firma",
        };
      }

      const saved = websiteScansRef.current;
      const social = socialOptionsRef.current;
      const needsScan = targets.filter((c) => {
        const scan = saved.get(c.orgnr);
        if (!scan) return true;
        return !isWebsiteScanCacheComplete(scan, social);
      });
      const cachedCount = targets.length - needsScan.length;

      if (needsScan.length === 0) {
        return {
          ok: true as const,
          scanned: 0,
          skipped: cachedCount,
          cachedOnly: true as const,
        };
      }

      const ordered =
        options?.preserveOrder === false
          ? shuffleScanBatch(needsScan, "scan-batch")
          : needsScan;
      const toScan = ordered.slice(0, MAX_WEBSITE_SCAN_BATCH);
      setTruncated(needsScan.length > MAX_WEBSITE_SCAN_BATCH);

      const gen = ++scanGenRef.current;
      void runScan(toScan, gen, { merge: true });
      return {
        ok: true as const,
        scanned: toScan.length,
        skipped: targets.length - toScan.length,
        cachedCount,
      };
    },
    [runScan]
  );

  return {
    websiteScans,
    scanning,
    scanComplete,
    progress,
    error,
    providers,
    truncated,
    rescan,
    scanCompanies,
    scanningOrgnrs,
    scanPending: autoScan && scanKey.length > 0 && !scanning && !scanComplete && !error,
    scanTargetCount,
    scanningName,
  };
}
