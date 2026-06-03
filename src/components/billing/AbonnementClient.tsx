"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanCheckoutButton } from "@/components/billing/PlanCheckoutButton";
import { PricingSection } from "@/components/marketing/PricingSection";
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
import { CreditCard, Loader2 } from "lucide-react";

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
    <div className="space-y-10">
      {dbReady === false && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
          <p className="font-semibold">Database mangler abonnementsfelt</p>
          <p className="mt-2 text-red-800">
            Du må kjøre én SQL-fil i Supabase (tar 1 minutt). Åpne SQL Editor, lim inn
            innholdet fra <code className="rounded bg-black/20 px-1">supabase/SETUP_BILLING.sql</code>{" "}
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
              ? "border border-red-200 bg-red-50 text-red-900"
              : "border border-brand-gold/30 bg-brand-gold/10 text-brand-navy"
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/15">
              <CreditCard className="h-6 w-6 text-brand-gold" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-brand-navy">
                {entitlements.isBillingFree ? "Gratis tilgang" : "Ditt abonnement"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {entitlements.isBillingFree ? (
                  <>
                    Du er plattform-eier og har full tilgang til{" "}
                    <strong>{NYLEAD_PLAN.name}</strong> uten betaling.
                  </>
                ) : (
                  <>
                    Du har{" "}
                    <strong>
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
              <p className="mt-3 text-sm text-slate-500">
                Bedrifter med tlf/e-post denne måneden:{" "}
                {entitlements.companiesWithContactUsed} av{" "}
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
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-md space-y-4 rounded-xl border border-brand-border bg-white p-5 shadow-card sm:p-6">
            <p className="text-sm font-medium text-slate-700">
              {fakeBilling
                ? "Du trenger NyLead-abonnement for å bruke appen. Test-modus aktiverer med én gang (ingen kort)."
                : "Du trenger NyLead-abonnement for å bruke appen. Betal trygt med kort via Stripe."}
            </p>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5 text-center">
              <p className="font-display text-lg font-bold uppercase text-brand-navy">
                {NYLEAD_PLAN.name}
              </p>
              <p className="mt-1 text-2xl font-black text-brand-gold">
                {NYLEAD_PLAN.priceNok} kr/mnd
              </p>
              <p className="mt-2 text-xs text-slate-600">{NYLEAD_PLAN.tagline}</p>
              <PlanCheckoutButton
                planId={DEFAULT_PLAN_ID}
                planName={NYLEAD_PLAN.name}
                fakeLabel={fakeBilling}
                className="!mt-4 !py-2.5 !text-xs"
              />
            </div>
          </div>
          <PricingSection loggedIn />
        </>
      )}
    </div>
  );
}
