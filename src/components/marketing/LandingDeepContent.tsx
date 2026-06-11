import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PlatformFeatureVideo } from "@/components/marketing/PlatformFeatureVideo";
import { WorkflowStepIcon } from "@/components/marketing/WorkflowStepIcons";
import { Container } from "@/components/ui/Container";
import {
  COMPARISON,
  FAQ_ITEMS,
  FAQ_SECTION,
  INTEGRATIONS,
  PLATFORM_INTRO,
  PLATFORM_PILLARS,
  USE_CASES,
  WORKFLOW_DETAILED,
  WORKFLOW_INTRO,
} from "@/content/landing";

export function PlatformSection({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      id="plattform"
      className={
        embedded
          ? "landing-section-embedded py-14 sm:py-20 md:py-28"
          : "border-t border-brand-border bg-white py-16 sm:py-24 md:py-32"
      }
    >
      <Container wide>
        <div className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow">{PLATFORM_INTRO.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-app-ink">{PLATFORM_INTRO.title}</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-slate-600 sm:text-lg">
            {PLATFORM_INTRO.subtitle}
          </p>
        </div>

        <div className="-mx-5 sm:-mx-8">
          <PlatformFeatureVideo className="mt-4 sm:mt-6" />
        </div>

        <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-2">
          {PLATFORM_PILLARS.map(({ id, icon: Icon, title, lead, bullets }) => (
            <article
              key={id}
              className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface"
            >
              <div className="flex flex-col px-6 py-6 sm:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-app-accent/10">
                    <Icon className="h-6 w-6 text-app-accent" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-app-ink">{title}</h3>
                    <p className="mt-2 font-sans text-sm leading-relaxed text-slate-600">{lead}</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-2.5 border-t border-brand-border pt-6">
                  {bullets.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 font-sans text-sm text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section id="bruksomrader" className="bg-brand-surface py-16 sm:py-24 md:py-32">
      <Container wide>
        <div className="max-w-2xl">
          <p className="type-eyebrow">{USE_CASES.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-app-ink">{USE_CASES.title}</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.items.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-brand-border bg-white p-6 shadow-card"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-app-accent/10">
                <Icon className="h-5 w-5 text-app-accent" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-app-ink">{title}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function WorkflowDetailedSection() {
  return (
    <section
      id="slik-funker-det"
      className="bg-app-ink pb-8 pt-16 sm:pb-10 sm:pt-24 md:pb-12 md:pt-32"
    >
      <Container wide>
        <div className="text-center">
          <p className="type-eyebrow">Slik funker det</p>
          <h2 className="type-h2 mt-3 text-white">{WORKFLOW_INTRO.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-sm leading-relaxed text-white/60 sm:text-base">
            {WORKFLOW_INTRO.subtitle}
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_DETAILED.map(({ step, title, description }) => (
            <div
              key={step}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-app-accent/25 bg-app-accent/10">
                <WorkflowStepIcon step={step} />
              </div>
              <h3 className="type-h3 mt-4 !text-lg text-white">{title}</h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-white/55">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center sm:mt-16">
          <Link href="/registrer" className="btn-primary">
            Opprett konto og se innsiden
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

export function ComparisonSection({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      className={
        embedded
          ? "landing-section-embedded py-14 sm:py-20 md:py-28"
          : "border-t border-brand-border bg-white py-16 sm:py-24 md:py-32"
      }
    >
      <Container wide>
        <div className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow">{COMPARISON.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-app-ink">{COMPARISON.title}</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-slate-600">
            {COMPARISON.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {COMPARISON.points.map(({ title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-brand-border bg-brand-surface p-6 text-center"
            >
              <h3 className="font-display text-lg font-bold text-app-ink">{title}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function IntegrationsSection() {
  return (
    <section className="bg-brand-surface py-16 sm:py-20">
      <Container wide>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <p className="type-eyebrow">{INTEGRATIONS.eyebrow}</p>
            <h2 className="type-h2 mt-3 text-app-ink">{INTEGRATIONS.title}</h2>
          </div>
          <ul className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            {INTEGRATIONS.items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 rounded-xl border border-brand-border bg-white px-4 py-3 font-sans text-sm font-medium text-slate-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-app-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

export function FaqSection({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      id="faq"
      className={
        embedded
          ? "landing-section-embedded py-14 sm:py-20 md:py-28"
          : "border-t border-brand-border bg-white py-16 sm:py-24 md:py-32"
      }
    >
      <Container wide>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="type-eyebrow">Ofte stilte spørsmål</p>
            <h2 className="type-h2 mt-3 text-app-ink">{FAQ_SECTION.title}</h2>
            <p className="mt-4 font-sans text-sm text-slate-600 sm:text-base">
              {FAQ_SECTION.subtitle}
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-brand-border bg-brand-surface px-5 py-4 open:bg-white open:shadow-card"
              >
                <summary className="cursor-pointer list-none font-sans text-sm font-semibold text-app-ink marker:content-none sm:text-base [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span className="shrink-0 text-app-accent transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 font-sans text-sm leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
