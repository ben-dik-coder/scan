"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { site } from "@/lib/site";
import { ArrowRight, Mail } from "lucide-react";
import { SignalPulseIcon } from "@/components/marketing/SignalPulseIcon";
import { isStoredPlanId } from "@/lib/billing/plans";

function authErrorMessage(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("email not confirmed") || t.includes("email_not_confirmed")) {
    return "Du må bekrefte e-posten først. Sjekk innboksen (og søppelpost) for lenken fra NyLead.";
  }
  if (t.includes("invalid login") || t.includes("invalid credentials")) {
    return "Feil e-post eller passord.";
  }
  if (t.includes("user already registered") || t.includes("already been registered")) {
    return "Denne e-posten er allerede registrert. Logg inn i stedet.";
  }
  return raw;
}

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
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(authErrorMessage(decodeURIComponent(urlError)));
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
      if (mode === "register") {
        // Bypass hung Supabase SMTP — our API sends confirm mail via Resend
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            companyName: companyName || null,
            next: redirect,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          email?: string;
        };
        if (!res.ok) {
          throw new Error(
            payload.error ||
              (res.status === 504
                ? "Tjeneren brukte for lang tid. Prøv igjen."
                : "Kunne ikke registrere."),
          );
        }
        setCheckEmail((payload.email || email).trim());
        setLoading(false);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      router.push(redirect);
      router.refresh();
    } catch (err) {
      let raw = "Noe gikk galt";
      if (err instanceof Error && err.message.trim()) raw = err.message;
      else if (typeof err === "string" && err.trim()) raw = err;
      setError(authErrorMessage(raw));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-x-clip bg-[#0a0a0a] text-zinc-100">
      <div className="relative hidden w-1/2 border-r border-white/[0.06] bg-[#070908] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="relative z-10 w-full max-w-md px-10 py-12 xl:px-12">
          <h2 className="type-h2 text-zinc-100">
            Selg til nye
            <br />
            <span className="text-emerald-400">bedrifter først</span>
          </h2>
          <p className="mt-5 font-sans text-sm font-medium leading-relaxed text-zinc-500">
            Finn firma fra Brønnøysund, filtrer på område, og send tilbud til mange
            på én gang.
          </p>
          <div className="mt-12">
            <SignalPulseIcon />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-[#0a0a0a] px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-12 sm:py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:underline lg:hidden"
        >
          ← Tilbake til {site.name}
        </Link>

        {searchParams.get("registered") === "1" && mode === "login" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Konto opprettet! Sjekk e-posten din og trykk på lenken for å aktivere
            kontoen, deretter logg inn her.
          </div>
        )}

        {checkEmail ? (
          <div className="w-full max-w-md">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="type-h2 !text-3xl text-white">Sjekk e-posten din</h1>
            <p className="mt-3 font-sans text-sm font-medium leading-relaxed text-white/55">
              Vi har sendt en aktiveringslenke til{" "}
              <span className="text-emerald-400">{checkEmail}</span>. Trykk på
              lenken for å aktivere kontoen. Etterpå får du en velkomstmail fra
              NyLead.
            </p>
            <p className="mt-4 font-sans text-sm text-zinc-500">
              Ser du den ikke? Sjekk søppelpost / spam.
            </p>
            <Link
              href="/innlogging"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Gå til innlogging
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
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
                    <Link
                      href="/vilkar"
                      target="_blank"
                      className="text-emerald-400 hover:underline"
                    >
                      vilkårene
                    </Link>{" "}
                    og{" "}
                    <Link
                      href="/personvern"
                      target="_blank"
                      className="text-emerald-400 hover:underline"
                    >
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? "Vent…" : mode === "login" ? "Logg inn" : "Registrer"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-sm text-zinc-500">
              {mode === "login" ? (
                <>
                  Ny bruker?{" "}
                  <Link
                    href="/registrer"
                    className="font-semibold text-emerald-400 hover:underline"
                  >
                    Registrer deg
                  </Link>
                </>
              ) : (
                <>
                  Har konto?{" "}
                  <Link
                    href="/innlogging"
                    className="font-semibold text-emerald-400 hover:underline"
                  >
                    Logg inn
                  </Link>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-zinc-500">
          Laster…
        </div>
      }
    >
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
