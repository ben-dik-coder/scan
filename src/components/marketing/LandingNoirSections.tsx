import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  Zap,
} from "lucide-react";
import { HeroOrbitStage } from "@/components/marketing/HeroOrbitStage";
import { LandingNoirBand, LandingNoirCta } from "@/components/marketing/LandingNoirCta";
import { PricingSection } from "@/components/marketing/PricingSection";
import {
  FaqSection,
} from "@/components/marketing/LandingDeepContent";
import { Container } from "@/components/ui/Container";
import {
  COMPARISON,
  FEATURES,
  FEATURES_SECTION,
  HERO,
  HERO_AUDIENCES,
  HERO_STEPS,
  INTEGRATIONS,
  PLATFORM_INTRO,
  PLATFORM_PILLARS,
  SOURCES_SECTION,
  USE_CASES,
  WORKFLOW_DETAILED,
  WORKFLOW_INTRO,
} from "@/content/landing";
import { site } from "@/lib/site";
import { WorkflowStepIcon } from "@/components/marketing/WorkflowStepIcons";

const SOURCE_PILLS = [
  "Brønnøysund",
  "Google",
  "Nettsider",
  "Gulesider",
  "1881",
  "Timma",
  "Fixit",
  "Facebook",
  "Instagram",
] as const;

export function LandingNoirHero() {
  return (
    <section className="landing-noir-hero relative overflow-hidden pt-[5.75rem] sm:pt-[6.5rem]">
      <div className="landing-noir-hero-glow" aria-hidden />
      <div className="landing-noir-hero-grid" aria-hidden />
      <Container wide className="relative pb-16 pt-10 sm:pb-24 sm:pt-14 lg:pb-28 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" aria-hidden />
              {HERO.eyebrow}
            </div>

            <p className="landing-noir-brand mt-6">{site.name}</p>

            <h1 className="landing-noir-title mt-3">
              {HERO.titleLine1}
              <span className="landing-noir-title-accent"> {HERO.titleLine2}</span>
            </h1>

            <p className="landing-noir-lede mt-5 max-w-lg sm:mt-6 sm:text-lg">
              {HERO.tagline}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {HERO_AUDIENCES.map((a) => (
                <span key={a} className="landing-noir-chip">
                  {a}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <LandingNoirCta href="/app" className="w-full sm:w-auto">
                {HERO.ctaPrimary}
              </LandingNoirCta>
              <LandingNoirCta
                href="/app/ring"
                variant="accent"
                className="w-full sm:w-auto"
              >
                AI-ringemodus
              </LandingNoirCta>
              <LandingNoirCta
                href="/registrer"
                variant="ghost"
                className="w-full sm:w-auto"
              >
                {HERO.ctaSecondary}
              </LandingNoirCta>
            </div>
            <Link
              href="#ai-ring"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Se hvordan AI ringer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <p className="mt-3 text-sm text-zinc-500">{HERO.trustLine}</p>

            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/10 pt-8">
              {site.stats.map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl text-white sm:text-3xl">{s.value}</p>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>

            <ul className="mt-8 space-y-2.5">
              {HERO_STEPS.map(({ step, icon: Icon, label, detail }) => (
                <li key={step} className="flex items-start gap-3 text-sm text-zinc-400">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icon className="h-3.5 w-3.5 text-zinc-200" aria-hidden />
                  </span>
                  <span>
                    <strong className="font-semibold text-zinc-200">{label}.</strong>{" "}
                    {detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <HeroOrbitStage />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirSources() {
  return (
    <section id="kilder" className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <p className="landing-noir-eyebrow">{SOURCES_SECTION.eyebrow}</p>
            <h2 className="landing-noir-h2 mt-3">{SOURCES_SECTION.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              {SOURCES_SECTION.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingNoirCta href="/app">Start skanning</LandingNoirCta>
              <LandingNoirCta href="#plattform" variant="ghost">
                Se hva du får
              </LandingNoirCta>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="landing-noir-bento">
              <div className="landing-noir-bento-main">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <Zap className="h-3.5 w-3.5 text-zinc-300" />
                  Enrichment
                </div>
                <p className="mt-3 font-display text-2xl text-white sm:text-3xl">
                  Fra orgnr til kontaktkort
                </p>
                <p className="mt-2 text-sm text-zinc-500">{SOURCES_SECTION.caption}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {SOURCE_PILLS.map((p) => (
                    <span key={p} className="landing-noir-pill">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="landing-noir-bento-side">
                {[
                  { icon: Building2, t: "Firma", d: "Navn, sted, bransje, alder" },
                  { icon: Phone, t: "Telefon", d: "Når vi finner det åpent" },
                  { icon: Mail, t: "E-post", d: "post@ / info@ først" },
                  { icon: Globe, t: "Signaler", d: "Nettside, booking, sosialt" },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="landing-noir-signal">
                    <Icon className="h-4 w-4 text-zinc-300" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-white">{t}</p>
                      <p className="text-xs text-zinc-500">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirPlatform() {
  return (
    <section id="plattform" className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="landing-noir-eyebrow">{PLATFORM_INTRO.eyebrow}</p>
          <h2 className="landing-noir-h2 mt-3">{PLATFORM_INTRO.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            {PLATFORM_INTRO.subtitle}
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {PLATFORM_PILLARS.map(({ id, icon: Icon, title, lead, bullets }) => (
            <article key={id} className="landing-noir-card landing-noir-card--glow">
              <div className="flex items-start gap-4">
                <div className="landing-noir-icon">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-display text-xl text-white sm:text-2xl">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{lead}</p>
                </div>
              </div>
              <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-100" />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <LandingNoirCta href="/app">Gå til Skann nå</LandingNoirCta>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirFeatures() {
  return (
    <section id="funksjoner" className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="landing-noir-eyebrow">{FEATURES_SECTION.eyebrow}</p>
            <h2 className="landing-noir-h2 mt-3 max-w-xl">{FEATURES_SECTION.title}</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-zinc-500 md:text-right">
            {FEATURES_SECTION.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, featured }) => (
            <div
              key={title}
              className={`landing-noir-feature ${featured ? "landing-noir-feature--hot" : ""}`}
            >
              <div className="landing-noir-icon">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirUseCases() {
  return (
    <section id="bruksomrader" className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="landing-noir-eyebrow">{USE_CASES.eyebrow}</p>
          <h2 className="landing-noir-h2 mt-3">{USE_CASES.title}</h2>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.items.map(({ icon: Icon, title, text }) => (
            <div key={title} className="landing-noir-feature">
              <div className="landing-noir-icon">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirWorkflow() {
  return (
    <section id="slik-funker-det" className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="text-center">
          <p className="landing-noir-eyebrow">Slik funker det</p>
          <h2 className="landing-noir-h2 mt-3">{WORKFLOW_INTRO.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
            {WORKFLOW_INTRO.subtitle}
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_DETAILED.map(({ step, title, description }) => (
            <div key={step} className="landing-noir-card relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="landing-noir-icon overflow-hidden">
                  <WorkflowStepIcon step={step} className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold tabular-nums text-zinc-600">
                  0{step}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <LandingNoirCta href="/app">Start i Skann</LandingNoirCta>
          <LandingNoirCta href="/app/ko" variant="ghost">
            Se arbeidskø
          </LandingNoirCta>
          <LandingNoirCta href="/app/ring" variant="ghost">
            Åpne ringemodus
          </LandingNoirCta>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirComparison() {
  return (
    <section className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="landing-noir-eyebrow">{COMPARISON.eyebrow}</p>
          <h2 className="landing-noir-h2 mt-3">{COMPARISON.title}</h2>
          <p className="mt-4 text-base text-zinc-400">{COMPARISON.subtitle}</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {COMPARISON.points.map((p, i) => (
            <div key={p.title} className="landing-noir-card">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                0{i + 1}
              </span>
              <h3 className="mt-4 font-display text-xl text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{p.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirIntegrations() {
  return (
    <section className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-16 sm:py-20">
        <div className="landing-noir-card flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="landing-noir-eyebrow">{INTEGRATIONS.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">
              {INTEGRATIONS.title}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTEGRATIONS.items.map((item) => (
              <span key={item} className="landing-noir-pill">
                {item}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirAgentStrip() {
  return (
    <section className="landing-noir-section border-t border-white/[0.06]">
      <Container wide className="py-20 sm:py-28">
        <div className="landing-noir-agent">
          <div className="landing-noir-agent-glow" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                <Phone className="h-3.5 w-3.5" />
                AI-ringemodus
              </div>
              <h2 className="landing-noir-h2 mt-5">
                Research → script → stemme.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-zinc-400">
                Bygg lister, la AI finne bransjesmerter og firmasignaler, og send
                skreddersydd manus rett til ElevenLabs-agenten før den ringer.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Bransjebibliotek (f.eks. malere) med konkrete pain points",
                  "Firma-brief før hvert anrop",
                  "Ringemodus + arbeidskø i samme produkt",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <LandingNoirCta href="/app/ring">Åpne ringemodus</LandingNoirCta>
                <LandingNoirCta href="/app" variant="ghost">
                  Finn leads først
                </LandingNoirCta>
              </div>
            </div>
            <div className="landing-noir-agent-panel">
              {[
                { k: "Scout", v: "Nye firma i ditt område" },
                { k: "Research", v: "Nettside, telefon, bransje" },
                { k: "Script", v: "Skreddersydd åpning" },
                { k: "Voice", v: "ElevenLabs outbound" },
              ].map((row, i) => (
                <div key={row.k} className="landing-noir-agent-row">
                  <span className="tabular-nums text-zinc-600">0{i + 1}</span>
                  <span className="font-semibold text-white">{row.k}</span>
                  <span className="text-zinc-500">{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function LandingNoirPricingBlock() {
  return (
    <div className="border-t border-white/[0.06]">
      <PricingSection embedded />
      <Container wide className="pb-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <LandingNoirCta href="/registrer">Start gratis</LandingNoirCta>
          <LandingNoirCta href="/app" variant="ghost">
            Se produktet uten kort
          </LandingNoirCta>
        </div>
      </Container>
    </div>
  );
}

export function LandingNoirFaqBlock() {
  return (
    <div className="border-t border-white/[0.06] pb-6">
      <FaqSection embedded />
    </div>
  );
}

export function LandingNoirFinalBand() {
  return (
    <LandingNoirBand
      title="Klar til å skanne — og la AI ringe?"
      body="Finn nye firma i ditt område, få kontaktinfo, og start AI-ringemodus med manus laget for hver bedrift."
      primaryLabel="Åpne Skann"
      secondaryLabel="Åpne AI-ring"
      secondaryHref="/app/ring"
    />
  );
}
