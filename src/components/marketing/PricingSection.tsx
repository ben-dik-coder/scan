import { CheckCircle2 } from "lucide-react";
import { PricingRegisterCta } from "@/components/marketing/PricingRegisterCta";
import { PlanCheckoutButton } from "@/components/billing/PlanCheckoutButton";
import { SubscriberCapBanner } from "@/components/marketing/SubscriberCapBanner";
import { Container } from "@/components/ui/Container";
import { DEFAULT_PLAN_ID, NYLEAD_PLAN } from "@/lib/billing/plans";

type Props = {
  /** Innlogget: lenke til checkout via abonnement-siden */
  loggedIn?: boolean;
};

export function PricingSection({
  loggedIn = false,
  embedded = false,
}: Props & { embedded?: boolean }) {
  const plan = NYLEAD_PLAN;

  return (
    <section
      id="pris"
      className={
        embedded
          ? "landing-section-embedded bg-brand-surface pt-14 sm:pt-20 md:pt-28 pb-20 sm:pb-28 md:pb-36"
          : "bg-brand-surface py-16 sm:py-24 md:py-32"
      }
    >
      <Container wide>
        {!embedded && (
          <SubscriberCapBanner compact className="mb-8 overflow-hidden rounded-lg border border-app-accent/15" />
        )}

        <div className="text-center">
          <p className="type-eyebrow">Pris</p>
          <h2 className="type-h2 mt-3 text-app-ink">Én enkel pris. Hele verktøyet.</h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm font-medium text-slate-500">
            Du betaler for å finne, sortere, kontakte og følge opp nye firma raskere.
            Pris eks. mva.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-md">
          <div className="relative flex flex-col overflow-hidden rounded-xl border border-app-accent/40 bg-white shadow-premium ring-1 ring-app-accent/20">
            <div className="bg-app-accent px-4 py-2 text-center font-sans text-[10px] font-semibold uppercase tracking-wider text-white">
              NyLead
            </div>

            <div className="bg-app-ink px-6 py-8 text-white sm:px-8">
              <h3 className="font-display text-xl font-bold uppercase tracking-wide">
                {plan.name}
              </h3>
              <p className="mt-1 font-sans text-sm text-white/55">{plan.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-black leading-none text-app-accentLight">
                  {plan.priceNok.toLocaleString("nb-NO")}
                </span>
                <span className="font-sans text-sm font-medium text-white/45">
                  kr / mnd
                </span>
              </p>
            </div>

            <div className="flex flex-1 flex-col px-6 py-8 sm:px-8">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 font-sans text-sm font-medium text-slate-600"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              {loggedIn ? (
                <PlanCheckoutButton planId={DEFAULT_PLAN_ID} planName={plan.name} />
              ) : (
                <PricingRegisterCta />
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
