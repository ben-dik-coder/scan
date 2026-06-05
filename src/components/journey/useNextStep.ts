"use client";

import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/config";
import { useDemo } from "@/lib/demo/store";
import { computeNextStep, type NextStep } from "@/lib/sales/next-step";

export function useNextStep() {
  const demo = useDemo();
  const [step, setStep] = useState<NextStep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      const queued = demo.companies.filter((c) => c.user_lead?.queued_at);
      const queuedNy = queued.filter((c) => c.user_lead?.status === "ny");
      const dueFollowUps = demo.companies.filter((c) => {
        const fu = c.user_lead?.next_follow_up_at;
        if (!fu) return false;
        const d = new Date(fu);
        const now = new Date();
        return d <= now;
      }).length;

      setStep(
        computeNextStep({
          emailConnected: true,
          queuedCount: queued.length,
          queuedNyCount: queuedNy.length,
          dueFollowUps,
          totalLeads: demo.companies.filter((c) => c.user_lead).length,
          totalSent: 0,
        })
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/journey/next-step")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Kunne ikke hente"))))
      .then((data: NextStep) => {
        if (!cancelled) setStep(data);
      })
      .catch(() => {
        if (!cancelled) setStep(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demo.companies]);

  return { step, loading };
}
