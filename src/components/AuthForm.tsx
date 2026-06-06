"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { site } from "@/lib/site";
import { ArrowRight } from "lucide-react";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import { isStoredPlanId } from "@/lib/billing/plans";

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setError("Passordene er ikke like. Skriv samme passord to ganger.");
      return;
    }
    if (mode === "register" && !acceptedTerms) {
      setError("Du må bekrefte at du har lest vilkårene og personvernerklæringen.");
      return;
    }
    setLoading(true);
    setError(null);

    const planParam = searchParams.get("plan");
    const redirectParam = searchParams.get("redirect");
    const redirect =
      planParam && isStoredPlanId(planParam)
        ? `/app/abonnement?plan=nylead`
        : redirectParam ?? "/app/oversikt";

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      if (mode === "register") {
        const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
        const baseUrl = configuredAppUrl?.startsWith("http")
          ? configuredAppUrl.replace(/\/$/, "")
          : window.location.origin;
        const emailRedirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(redirect)}`;
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { company_name: companyName || null },
            emailRedirectTo,
          },
        });
        if (signUpError) throw signUpError;
        router.push("/innlogging?registered=1");
        router.refresh();
        return;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-navy via-[#1a3a5c] to-brand-navy text-white">
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-navy lg:flex lg:flex-col lg:justify-end">
        <div className="relative px-10 pb-16 pt-10">
          <h2 className="type-h2 text-white">
            Selg til nye
            <br />
            <span className="text-brand-goldLight">bedrifter først</span>
          </h2>
          <p className="mt-5 max-w-md font-sans text-sm font-medium leading-relaxed text-white/55">
            Finn firma fra Brønnøysund, filtrer på område, og send tilbud til mange
            på én gang.
          </p>
          <div className="mt-10 max-w-sm origin-left scale-90">
            <HeroPreview />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-12 sm:py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-gold hover:underline lg:hidden"
        >
          ← Tilbake til {site.name}
        </Link>

        {searchParams.get("registered") === "1" && mode === "login" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Konto opprettet! Sjekk e-posten for bekreftelse (hvis påkrevd), deretter logg inn her.
          </div>
        )}

        <h1 className="type-h2 !text-3xl text-white">
          {mode === "login" ? "Logg inn" : "Opprett konto"}
        </h1>
        <p className="mt-2 font-sans text-sm font-medium text-white/50">
          {mode === "login"
            ? "Velkommen tilbake!"
            : "Kom i gang på under ett minutt."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 w-full max-w-md space-y-4">
          {mode === "register" && (
            <label className="block text-sm">
              <span className="font-semibold text-white/70">Firmanavn</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ditt firma AS"
                className="input-dark mt-1.5"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-semibold text-white/70">E-post</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deg@firma.no"
              required
              className="input-dark mt-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-white/70">Passord</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="input-dark mt-1.5"
            />
          </label>

          {mode === "register" && (
            <label className="block text-sm">
              <span className="font-semibold text-white/70">Bekreft passord</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Skriv passordet på nytt"
                className="input-dark mt-1.5"
              />
            </label>
          )}

          {mode === "register" && (
            <label className="flex items-start gap-3 text-sm text-white/60">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                Jeg bekrefter at jeg har lest og godtar{" "}
                <Link href="/vilkar" target="_blank" className="text-brand-gold hover:underline">
                  vilkårene
                </Link>{" "}
                og{" "}
                <Link href="/personvern" target="_blank" className="text-brand-gold hover:underline">
                  personvernerklæringen
                </Link>
                . Jeg forstår at jeg selv er ansvarlig for lovlig e-post jeg sender.
              </span>
            </label>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || (mode === "register" && !acceptedTerms)}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {loading ? "Vent…" : mode === "login" ? "Logg inn" : "Registrer"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-sm text-white/50">
          {mode === "login" ? (
            <>
              Ny bruker?{" "}
              <Link href="/registrer" className="font-semibold text-brand-gold hover:underline">
                Registrer deg
              </Link>
            </>
          ) : (
            <>
              Har konto?{" "}
              <Link href="/innlogging" className="font-semibold text-brand-gold hover:underline">
                Logg inn
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-brand-navy text-white/60">Laster…</div>}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
