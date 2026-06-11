import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AgentPromoMockup } from "@/components/marketing/AgentPromoMockup";
import { LandingAnimationPause } from "@/components/marketing/LandingAnimationPause";
import { Container } from "@/components/ui/Container";

const BULLETS = [
  "Skriv vanlig norsk, ikke avanserte søk",
  "Finn firma etter sted, bransje og behov",
  "Be om forslag til hvem du bør kontakte først",
  "Lagre gode lister rett inn i arbeidsflyten",
] as const;

export function LandingAgentPromo() {
  return (
    <section
      id="ai-assistent"
      className="landing-agent-promo landing-section-deferred border-b border-black/10 py-16 sm:py-24 md:py-28"
    >
      <Container wide className="relative z-[1]">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          <div className="landing-agent-promo__copy order-1">
            <p className="type-eyebrow">AI-assistent</p>
            <h2 className="type-h2 mt-3 max-w-lg text-white">
              Spør som et menneske. Få en liste du kan jobbe med.
            </h2>
            <p className="mt-4 max-w-lg font-sans text-base font-medium leading-relaxed text-white/75 sm:text-lg">
              Si hva du selger og hvem du vil nå. Assistenten kan hjelpe deg å finne
              relevante firma, forklare hvorfor de passer, og gjøre listen klar for
              kontakt og oppfølging.
            </p>

            <ul className="mt-8 space-y-3">
              {BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 font-sans text-sm font-medium text-white/85 sm:text-base"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-app-accent" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/registrer" className="btn-primary w-full sm:w-auto">
                Prøv gratis
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </Link>
              <Link
                href="/app"
                className="text-center font-sans text-sm font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline sm:text-left"
              >
                Se hvordan den jobber
              </Link>
            </div>
          </div>

          <div className="landing-agent-promo__visual order-2 flex w-full justify-center overflow-visible lg:justify-end">
            <LandingAnimationPause className="landing-agent-promo__mockup-wrap w-full max-w-full sm:max-w-[400px] lg:max-w-[440px]">
              <div className="agent-promo-3d-scene w-full">
                <div className="agent-promo-3d-orb" aria-hidden />
                <div className="agent-promo-3d-card">
                  <div className="agent-promo-3d-glow" aria-hidden />
                  <div className="agent-promo-3d-floor" aria-hidden />
                  <div className="agent-promo-3d-frame">
                    <AgentPromoMockup />
                  </div>
                </div>
              </div>
            </LandingAnimationPause>
          </div>
        </div>
      </Container>
    </section>
  );
}
