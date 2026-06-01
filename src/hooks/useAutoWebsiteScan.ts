"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_AUTO_WEBSITE_SCAN,
  MAX_WEBSITE_SCAN_BATCH,
} from "@/lib/constants/market";
import { quickScanFromEmail } from "@/lib/website-scan/client-quick-scan";
import type { Company } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

type Progress = {
  done: number;
  total: number;
};

const SCAN_ONE_TIMEOUT_MS = 30_000;

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
  options?: { /** Start ikke Google automatisk — bruker velger selv */ autoScan?: boolean }
) {
  const autoScan = options?.autoScan ?? false;
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
    async (targets: Company[], gen: number, options?: { merge?: boolean }) => {
    if (targets.length === 0) return [];

    const isActive = () => gen === scanGenRef.current;
    const merge = options?.merge ?? false;

    setScanning(true);
    setError(null);
    if (!merge) setScanComplete(false);
    setProgress({ done: 0, total: targets.length });
    if (!merge) setWebsiteScans(new Map());
    setScanningOrgnrs(new Set(targets.map((c) => c.orgnr)));
    setScanningName(null);

    const allResults: WebsiteScanResult[] = [];

    try {
      void fetch("/api/website-scan")
        .then((r) => r.json())
        .then((status) => {
          if (isActive()) setProviders(status.providers ?? []);
        })
        .catch(() => {});

      for (let i = 0; i < targets.length; i++) {
        if (!isActive()) break;

        const company = targets[i]!;
        setScanningName(company.name);
        setProgress({ done: i, total: targets.length });

        const quick = quickScanFromEmail(company);
        if (quick) {
          allResults.push(quick);
          if (isActive()) {
            setProgress({ done: i + 1, total: targets.length });
            setWebsiteScans((prev) => new Map(prev).set(company.orgnr, quick));
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
                },
              ],
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Google-skanning feilet");

          const batchResults = (data.results ?? []) as WebsiteScanResult[];
          const result = batchResults[0];
          if (!result) continue;

          allResults.push(result);

          if (isActive()) {
            setProgress({ done: i + 1, total: targets.length });
            setWebsiteScans((prev) => new Map(prev).set(company.orgnr, result));
            await yieldToUi();
          }
        } catch (err) {
          if (!isActive()) break;
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error(
              `Tidsavbrudd på ${company.name} — prøv «Sjekk på nytt» eller sjekk SerpAPI-nøkkel`
            );
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }
      }

      if (isActive()) setScanComplete(true);
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

    const toScan = withEmail.slice(0, MAX_AUTO_WEBSITE_SCAN);
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

  /** Nullstill skann når filter/liste byttes (kun manuell modus) */
  useEffect(() => {
    if (autoScan) return;
    setWebsiteScans(new Map());
    setScanComplete(false);
    setError(null);
  }, [companyListKey, autoScan]);

  const rescan = useCallback(() => {
    const scanned = websiteScansRef.current;
    const unscanned = companies
      .filter((c) => c.has_email && !scanned.has(c.orgnr))
      .slice(0, MAX_WEBSITE_SCAN_BATCH);
    const toScan =
      unscanned.length > 0
        ? unscanned
        : companies.filter((c) => c.has_email).slice(0, MAX_WEBSITE_SCAN_BATCH);
    const gen = ++scanGenRef.current;
    void runScan(toScan, gen, { merge: true });
  }, [companies, runScan]);

  /** Google-sjekk for avhukede firma (maks 10, beholder andre skannresultater) */
  const scanCompanies = useCallback(
    (targets: Company[]) => {
      const withEmail = targets.filter((c) => c.has_email);
      const toScan = withEmail.slice(0, MAX_WEBSITE_SCAN_BATCH);
      setTruncated(withEmail.length > MAX_WEBSITE_SCAN_BATCH);

      if (toScan.length === 0) {
        return {
          ok: false as const,
          message: "Velg minst ett firma med e-post",
        };
      }

      const gen = ++scanGenRef.current;
      void runScan(toScan, gen, { merge: true });
      return {
        ok: true as const,
        scanned: toScan.length,
        skipped: withEmail.length - toScan.length,
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
