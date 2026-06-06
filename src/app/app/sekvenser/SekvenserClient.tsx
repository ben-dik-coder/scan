"use client";

import { useEffect, useState } from "react";
import { SequencesManager } from "@/components/SequencesManager";
import { useDemo } from "@/lib/demo/store";

type Step = { step_order: number; delay_days: number; subject: string; body: string };
type Sequence = { id: string; name: string; active: boolean; steps: Step[] };

type Props = {
  initialSequences: Sequence[];
  isDemo: boolean;
};

export function SekvenserClient({ initialSequences, isDemo }: Props) {
  const demo = useDemo();
  const [sequences, setSequences] = useState<Sequence[]>(initialSequences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemo) return;
    setSequences(demo.sequences);
  }, [isDemo, demo.sequences]);

  async function refresh() {
    if (isDemo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sequences");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente sekvenser");
      if (Array.isArray(data)) setSequences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SequencesManager
      sequences={sequences}
      loading={loading}
      error={error}
      isDemo={isDemo}
      onProcessed={refresh}
    />
  );
}
