"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-brand-navy">
      <h1 className="font-display text-2xl font-semibold">Noe gikk galt</h1>
      <p className="mt-3 max-w-md text-center text-slate-600">
        Vi klarte ikke å laste siden. Prøv igjen, eller kontakt oss hvis det
        fortsetter.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-navy/90"
      >
        Prøv igjen
      </button>
    </div>
  );
}
