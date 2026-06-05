"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanCheckoutButton } from "@/components/billing/PlanCheckoutButton";
import { SubscriberCapBanner } from "@/components/marketing/SubscriberCapBanner";
import {
  DEFAULT_PLAN_ID,
  NYLEAD_PLAN,
  formatPlanName,
  isValidPlanId,
  type PlanId,
} from "@/lib/billing/plans";
import {
  goToCheckoutUrl,
  parseCheckoutResponse,
} from "@/lib/billing/checkout-client";
import type { Entitlements } from "@/lib/billing/entitlements";
import type { StoredPlanId } from "@/types/database";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";

type BillingProfile = {
  plan: StoredPlanId | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
};

type Props = {
  profile: BillingProfile;
  entitlements: Entitlements;
  fakeBilling?: boolean;
};

export function AbonnementClient({ profile, entitlements, fakeBilling = true }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState<boolean | null>(null);

  const sqlEditorUrl =
    "https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new";

  useEffect(() => {
    fetch("/api/billing/db-check")
      .then((r) => r.json())
      .then((d) => setDbReady(Boolean(d.ready)))
      .catch(() => setDbReady(null));
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    async function handleReturn() {
      if (searchParams.get("success") === "1") {
        if (sessionId && !fakeBilling) {
          try {
            const res = await fetch("/api/billing/confirm-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error ?? "Kunne ikke bekrefte betaling");
            }
          } catch (err) {
            setMessage(
              err instanceof Error
                ? `${err.message} Webhook kan fortsatt aktivere abonnementet om noen sekunder — prøv å laste siden på nytt.`
                : "Betaling mottatt, men aktivering feilet. Last siden på nytt om litt."
            );
            router.replace("/app/abonnement");
            return;
          }
        }
        setMessage("Takk! Abonnementet ditt er aktivert.");
        router.replace("/app/abonnement");
        router.refresh();
        return;
      }

      if (searchParams.get("canceled") === "1") {
        setMessage("Betalingen ble avbrutt. Du kan prøve igjen når du vil.");
        router.replace("/app/abonnement");
      }
    }

    void handleReturn();

    const planParam = searchParams.get("plan");
    if (
      planParam &&
      isValidPlanId(planParam) &&
      !entitlements.hasAccess &&
      !checkoutBusy &&
      searchParams.get("success") !== "1"
    ) {
      void startCheckout(planParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(planId: PlanId) {
    setCheckoutBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await parseCheckoutResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke starte betaling");
      if (data.fake) {
        setMessage("Test-betaling: NyLead er aktivert.");
        router.push("/app/abonnement?success=1");
        router.refresh();
        return;
      }
      goToCheckoutUrl(data.url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Noe gikk galt");
      setCheckoutBusy(false);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke åpne portal");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Noe gikk galt");
      setPortalLoading(false);
    }
  }

  const periodEnd = profile.subscription_current_period_end
    ? new Date(profile.subscription_current_period_end).toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {dbReady === false && (
        <div className="app-settings-card px-4 py-4 text-sm">
          <p className="scan-glass-strong font-semibold">Database mangler abonnementsfelt</p>
          <p className="scan-glass-muted mt-2">
            Du må kjøre én SQL-fil i Supabase (tar 1 minutt). Åpne SQL Editor, lim inn
            innholdet fra <code className="rounded bg-white/10 px-1">supabase/SETUP_BILLING.sql</code>{" "}
            i prosjektet, og trykk <strong>Run</strong>.
          </p>
          <Link
            href={sqlEditorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4 inline-flex !py-2.5 text-xs"
          >
            Åpne Supabase SQL Editor
          </Link>
        </div>
      )}

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.includes("mangler") || message.includes("SETUP_BILLING")
              ? "border border-red-400/30 bg-red-950/40 text-red-100"
              : "border border-sky-400/30 bg-sky-950/30 text-sky-100"
          }`}
        >
          {message}
          {(message.includes("mangler") || message.includes("SETUP_BILLING")) && (
            <Link
              href={sqlEditorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-semibold underline"
            >
              Åpne Supabase og kjør migrasjon →
            </Link>
          )}
        </div>
      )}

      {entitlements.hasAccess ? (
        <section className="app-settings-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
              <CreditCard className="h-6 w-6 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="scan-glass-strong font-display text-2xl font-bold">
                {entitlements.isBillingFree ? "Gratis tilgang" : "Ditt abonnement"}
              </h1>
              <p className="scan-glass-muted mt-2 text-sm">
                {entitlements.isBillingFree ? (
                  <>
                    Du er plattform-eier og har full tilgang til{" "}
                    <strong className="text-white">{NYLEAD_PLAN.name}</strong> uten betaling.
                  </>
                ) : (
                  <>
                    Du har{" "}
                    <strong className="text-white">
                      {profile.plan ? formatPlanName(profile.plan) : NYLEAD_PLAN.name}
                    </strong>
                    {profile.subscription_status === "trialing" && " (prøveperiode)"}
                    {periodEnd && (
                      <>
                        {" "}
                        · Fornyes {periodEnd}
                      </>
                    )}
                  </>
                )}
              </p>
              <p className="scan-glass-muted mt-3 text-sm">
                Bedrifter med tlf/e-post denne måneden:{" "}
                <span className="text-white">{entitlements.companiesWithContactUsed}</span> av{" "}
                {entitlements.maxCompaniesWithContactPerMonth}
                {entitlements.emailIntegration && (
                  <>
                    {" "}
                    · E-post sendt: {entitlements.emailsSentThisMonth} av{" "}
                    {entitlements.maxEmailsPerMonth} · Maks{" "}
                    {entitlements.maxRecipientsPerSend} per utsendelse
                  </>
                )}
              </p>
              {!entitlements.isBillingFree && !fakeBilling && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="btn-primary !py-2.5"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Administrer abonnement"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-header-title">Abonnement</h1>
              <p className="scan-glass-muted mt-1 text-sm">
                {fakeBilling
                  ? "Du trenger NyLead-abonnement for å bruke appen. Test-modus aktiverer med én gang (ingen kort)."
                  : "Du trenger NyLead-abonnement for å bruke appen. Betal trygt med kort via Stripe."}
              </p>
            </div>
          </div>

          <SubscriberCapBanner compact variant="glass" className="mx-auto max-w-md" />

          <section className="app-settings-card mx-auto max-w-md space-y-5 p-5 sm:p-6">
            <div className="text-center">
              <p className="type-eyebrow text-sky-400">Pris</p>
              <h2 className="scan-glass-strong mt-2 font-display text-xl font-bold">
                Én pakke — alt inkludert
              </h2>
              <p className="scan-glass-muted mt-2 text-xs">
                Brønnøysund-data er gratis — du betaler for verktøyet. Pris eks. mva.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="scan-glass-strong font-display text-lg font-bold uppercase">
                {NYLEAD_PLAN.name}
              </p>
              <p className="mt-1 text-3xl font-black text-sky-400">
                {NYLEAD_PLAN.priceNok} kr/mnd
              </p>
              <p className="scan-glass-muted mt-2 text-xs">{NYLEAD_PLAN.tagline}</p>
            </div>

            <ul className="space-y-2.5">
              {NYLEAD_PLAN.features.map((feature) => (
                <li
                  key={feature}
                  className="scan-glass-muted flex items-start gap-2.5 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  {feature}
                </li>
              ))}
            </ul>

            <PlanCheckoutButton
              planId={DEFAULT_PLAN_ID}
              planName={NYLEAD_PLAN.name}
              fakeLabel={fakeBilling}
              className="!mt-0"
            />
          </section>
        </>
      )}
    </div>
  );
}
