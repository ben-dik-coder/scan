"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import Link from "next/link";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function unsubscribe() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Feil");
      setEmail(data.email ?? null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-red-600">Ugyldig eller utløpt avmeldingslenke.</p>;
  }

  if (done) {
    return (
      <p className="text-emerald-700">
        {email ?? "Adressen"} er nå avmeldt. Du vil ikke motta flere e-poster fra oss.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-600">
        Klikk under for å melde deg av fremtidige markedsførings-e-poster.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={unsubscribe}
        disabled={loading}
        className="rounded-xl bg-brand-navy px-5 py-2.5 font-bold text-white disabled:opacity-50"
      >
        {loading ? "Melder av…" : "Ja, meld meg av"}
      </button>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16">
      <Container className="max-w-lg">
        <h1 className="font-display text-2xl font-extrabold text-brand-navy">Avmeld</h1>
        <div className="surface-panel mt-6 p-6 text-slate-700">
          <Suspense fallback={<p className="text-slate-500">Laster…</p>}>
            <UnsubscribeContent />
          </Suspense>
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-navy hover:underline">
          ← Til forsiden
        </Link>
      </Container>
    </div>
  );
}
