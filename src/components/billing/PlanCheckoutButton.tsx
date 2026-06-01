"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Props = {
  planId: PlanId;
  planName: string;
  popular?: boolean;
  className?: string;
  /** Vis «Aktiver test» i stedet for «Velg» (når du vet at fake er på) */
  fakeLabel?: boolean;
};

export function PlanCheckoutButton({
  planId,
  planName,
  popular,
  className,
  fakeLabel = true,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke aktivere pakke");

      if (data.fake) {
        router.push("/app/oversikt");
        router.refresh();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Mangler betalingslenke");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 w-full">
      <button
        type="button"
        disabled={loading}
        onClick={activate}
        className={cn(
          "btn-primary w-full disabled:opacity-60",
          !popular && "!bg-brand-navy",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {fakeLabel ? `Aktiver ${planName} (test)` : `Velg ${planName}`}
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
