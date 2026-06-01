import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Props = {
  /** Innlogget: lenke til checkout via abonnement-siden */
  loggedIn?: boolean;
};

export function PricingSection({ loggedIn = false }: Props) {
  return (
    <section id="pris" className="bg-[#f8f9fb] py-16 sm:py-24 md:py-32">
      <Container wide>
        <div className="text-center">
          <p className="type-eyebrow">Pris</p>
          <h2 className="type-h2 mt-3 text-brand-navy">Velg pakken som passer deg</h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm font-medium text-slate-500">
            Brønnøysund-data er gratis — du betaler for verktøyet. Alle priser eks. mva.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-card",
                plan.popular
                  ? "border-brand-gold/40 shadow-premium ring-1 ring-brand-gold/20 lg:scale-[1.02]"
                  : "border-slate-200/80"
              )}
            >
              {plan.popular && (
                <div className="bg-brand-gold px-4 py-2 text-center font-display text-[10px] font-bold uppercase tracking-athletic text-brand-navy">
                  Mest populær
                </div>
              )}

              <div
                className={cn(
                  "px-6 py-8 sm:px-8",
                  plan.popular && "bg-brand-navy text-white"
                )}
              >
                <h3
                  className={cn(
                    "font-display text-xl font-bold uppercase tracking-wide",
                    plan.popular ? "text-white" : "text-brand-navy"
                  )}
                >
                  {plan.name}
                </h3>
                <p
                  className={cn(
                    "mt-1 font-sans text-sm",
                    plan.popular ? "text-white/55" : "text-slate-500"
                  )}
                >
                  {plan.tagline}
                </p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span
                    className={cn(
                      "font-display text-5xl font-black leading-none",
                      plan.popular ? "text-brand-goldLight" : "text-brand-navy"
                    )}
                  >
                    {plan.priceNok.toLocaleString("nb-NO")}
                  </span>
                  <span
                    className={cn(
                      "font-sans text-sm font-medium",
                      plan.popular ? "text-white/45" : "text-slate-400"
                    )}
                  >
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
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={
                    loggedIn
                      ? `/app/abonnement?plan=${plan.id}`
                      : `/registrer?plan=${plan.id}`
                  }
                  className={cn(
                    "btn-primary mt-8 w-full",
                    !plan.popular && "!bg-brand-navy"
                  )}
                >
                  Velg {plan.name}
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
