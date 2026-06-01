"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanCheckoutButton } from "@/components/billing/PlanCheckoutButton";
import { PricingSection } from "@/components/marketing/PricingSection";
import { PLANS, formatPlanName, isValidPlanId, type PlanId } from "@/lib/billing/plans";
import type { Entitlements } from "@/lib/billing/entitlements";
import type { PlanId as ProfilePlanId } from "@/types/database";
import { CreditCard, Loader2 } from "lucide-react";

type BillingProfile = {
  plan: ProfilePlanId | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
};

type Props = {
  profile: BillingProfile;
  entitlements: Entitlements;
};

export function AbonnementClient({ profile, entitlements }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setMessage("Takk! Abonnementet ditt er aktivert.");
      router.replace("/app/abonnement");
    }
    if (searchParams.get("canceled") === "1") {
      setMessage("Betalingen ble avbrutt. Du kan prøve igjen når du vil.");
      router.replace("/app/abonnement");
    }
    const planParam = searchParams.get("plan");
    if (
      planParam &&
      isValidPlanId(planParam) &&
      !entitlements.hasAccess &&
      loading === null
    ) {
      void startCheckout(planParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(planId: PlanId) {
    setLoading(planId);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke starte betaling");
      if (data.url) {
        if (data.fake) {
          setMessage(`Test-betaling: ${planId} er aktivert.`);
          router.push(data.url);
          router.refresh();
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Noe gikk galt");
      setLoading(null);
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
      {message && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-brand-navy">
          {message}
        </div>
      )}

      {entitlements.hasAccess ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/15">
              <CreditCard className="h-6 w-6 text-brand-gold" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-brand-navy">Ditt abonnement</h1>
              <p className="mt-2 text-sm text-slate-600">
                Du har pakken{" "}
                <strong>{profile.plan ? formatPlanName(profile.plan) : "—"}</strong>
                {profile.subscription_status === "trialing" && " (prøveperiode)"}
                {periodEnd && (
                  <>
                    {" "}
                    · Fornyes {periodEnd}
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
            </div>
          </div>

          {entitlements.plan !== "agency" && (
            <div className="mt-8 border-t border-slate-100 pt-8">
              <p className="text-sm font-semibold text-slate-700">Oppgrader</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {PLANS.filter((p) => p.id !== entitlements.plan).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={loading !== null}
                    onClick={() => startCheckout(plan.id)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-gold hover:text-brand-navy"
                  >
                    {loading === plan.id ? (
                      <Loader2 className="inline h-4 w-4 animate-spin" />
                    ) : (
                      `${plan.name} — ${plan.priceNok} kr/mnd`
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="glass space-y-4 p-5 sm:p-6">
            <p className="text-sm font-medium text-white/90">
              Du trenger en pakke for å bruke appen. Trykk på en knapp — test-modus aktiverer med
              én gang (ingen kort).
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col rounded-xl border border-white/15 bg-white/10 p-4"
                >
                  <p className="font-display text-sm font-bold uppercase text-white">
                    {plan.name}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    {plan.priceNok} kr/mnd
                  </p>
                  <PlanCheckoutButton
                    planId={plan.id}
                    planName={plan.name}
                    popular={plan.popular}
                    className="!mt-4 !py-2.5 !text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <PricingSection loggedIn />
        </>
      )}
    </div>
  );
}
