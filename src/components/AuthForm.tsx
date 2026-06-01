"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { site } from "@/lib/site";
import { isDemoMode } from "@/lib/demo/config";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroPreview } from "@/components/marketing/HeroPreview";

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirect = searchParams.get("redirect") ?? "/app/oversikt";

    if (isDemoMode()) {
      router.push(redirect);
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      if (mode === "register") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { company_name: companyName || null } },
        });
        if (signUpError) throw signUpError;
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
    <div className="flex min-h-screen bg-gradient-to-br from-brand-navy via-brand-navyLight to-brand-navy">
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-navy lg:flex lg:flex-col lg:justify-between">
        <div className="relative p-10">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gold font-display text-sm font-black text-brand-navy">
              N
            </span>
            <span className="font-display text-lg font-black uppercase tracking-wide text-white">{site.name}</span>
          </Link>
        </div>
        <div className="relative px-10 pb-16">
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

        {isDemoMode() && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4 text-sm text-brand-gold">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Demo-modus</p>
              <p className="mt-1 text-brand-gold/80">
                Backend er ikke koblet til ennå. Klikk under for å gå rett inn i demo.
              </p>
            </div>
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
              required={!isDemoMode()}
              className="input-dark mt-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-white/70">Passord</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isDemoMode()}
              minLength={6}
              placeholder="••••••••"
              className="input-dark mt-1.5"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {loading
              ? "Vent…"
              : isDemoMode()
                ? "Gå til demo"
                : mode === "login"
                  ? "Logg inn"
                  : "Registrer"}
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
