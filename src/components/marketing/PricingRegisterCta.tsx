"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export function PricingRegisterCta() {
  const [capFull, setCapFull] = useState(false);

  useEffect(() => {
    fetch("/api/subscriber-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { full?: boolean } | null) => {
        if (d?.full) setCapFull(true);
      })
      .catch(() => {});
  }, []);

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
    <Link href="/registrer?plan=nylead" className="btn-primary mt-8 w-full">
      Start og finn nye kunder
      <ArrowRight className="h-4 w-4 stroke-[2.5]" />
    </Link>
  );
}
