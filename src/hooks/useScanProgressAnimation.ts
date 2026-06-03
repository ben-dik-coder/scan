"use client";

import { useEffect, useMemo, useState } from "react";

const STEP_INTERVAL_MS = 1800;

export function buildScanSteps(
  includeFacebook: boolean,
  includeInstagram: boolean
): string[] {
  const steps = ["Sjekker Google…"];
  if (includeFacebook) steps.push("Sjekker FB…");
  if (includeInstagram) steps.push("Sjekker Instagram…");
  return steps;
}

export function useScanProgressAnimation(options: {
  scanning: boolean;
  scanComplete: boolean;
  scanPending?: boolean;
  done: number;
  total: number;
  includeFacebook: boolean;
  includeInstagram: boolean;
}) {
  const {
    scanning,
    scanComplete,
    scanPending = false,
    done,
    total,
    includeFacebook,
    includeInstagram,
  } = options;

  const steps = useMemo(
    () => buildScanSteps(includeFacebook, includeInstagram),
    [includeFacebook, includeInstagram]
  );

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (scanPending || (scanning && done === 0 && !scanComplete)) {
      setStepIndex(0);
    }
  }, [scanPending, scanning, done, scanComplete]);

  useEffect(() => {
    if (!scanning) {
      setStepIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [scanning, steps.length]);

  const visualPercent =
    scanPending || (!scanning && !scanComplete)
      ? 0
      : scanning && total > 0
        ? Math.min(99, Math.round((done / total) * 100))
        : scanComplete && !scanning
          ? 100
          : 0;

  const currentStep = scanning ? (steps[stepIndex] ?? steps[0]) : null;

  return { currentStep, visualPercent, stepKey: stepIndex };
}
