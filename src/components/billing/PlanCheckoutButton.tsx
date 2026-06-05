"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { PlanId } from "@/lib/billing/plans";
import {
  goToCheckoutUrl,
  parseCheckoutResponse,
} from "@/lib/billing/checkout-client";
import { cn } from "@/lib/utils";

type Props = {
  planId: PlanId;
  planName: string;
  className?: string;
  /** Vis «Aktiver test» i stedet for «Velg» (når du vet at fake er på) */
  fakeLabel?: boolean;
};

export function PlanCheckoutButton({
  planId,
  planName,
  className,
  fakeLabel = true,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capFull, setCapFull] = useState(false);
  const [useFake, setUseFake] = useState(fakeLabel);

  useEffect(() => {
    fetch("/api/subscriber-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { full?: boolean } | null) => {
        if (d?.full) setCapFull(true);
      })
      .catch(() => {});

    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { fakeBilling?: boolean } | null) => {
        if (d && typeof d.fakeBilling === "boolean") {
          setUseFake(d.fakeBilling);
        }
      })
      .catch(() => {});
  }, []);

  async function activate() {
    if (capFull) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await parseCheckoutResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke aktivere pakke");

      if (data.fake) {
        router.push("/app/abonnement?success=1");
        router.refresh();
        return;
      }
      goToCheckoutUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
      setLoading(false);
    }
  }

  if (capFull) {
    return (
      <div className="mt-8 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-center">
        <p className="font-sans text-sm font-semibold text-red-800">
          Alle sitteplasser er fullte
        </p>
        <p className="mt-1 font-sans text-xs text-red-700/80">
          Skriv til{" "}
          <a href="mailto:post@nylead.no" className="underline">
            post@nylead.no
          </a>{" "}
          for venteliste.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full">
      <button
        type="button"
        disabled={loading}
        onClick={activate}
        className={cn("btn-primary w-full disabled:opacity-60", className)}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {useFake ? `Aktiver ${planName} (test)` : `Velg ${planName} — betal med kort`}
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
