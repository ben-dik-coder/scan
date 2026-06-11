import { Container } from "@/components/ui/Container";
import { LandingAnimationPause } from "@/components/marketing/LandingAnimationPause";
import { SourcesEnrichmentAnimation } from "@/components/marketing/SourcesEnrichmentAnimation";
import { SOURCES_SECTION } from "@/content/landing";

export function LandingSourcesSection() {
  return (
    <section
      id="kilder"
      className="landing-section-deferred border-b border-brand-border bg-white py-14 sm:py-20 md:py-24"
    >
      <Container wide>
        <div className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow">{SOURCES_SECTION.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-app-ink">{SOURCES_SECTION.title}</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-slate-600 sm:text-lg">
            {SOURCES_SECTION.subtitle}
          </p>
        </div>

        <figure className="sources-section-figure mx-auto mt-10 max-w-6xl sm:mt-12">
          <div className="overflow-hidden rounded-2xl border border-brand-border bg-[#f8fafc] shadow-card lg:rounded-3xl">
            <LandingAnimationPause>
              <SourcesEnrichmentAnimation className="block h-auto w-full" />
            </LandingAnimationPause>
          </div>
          <figcaption className="mt-4 text-center font-sans text-sm text-slate-500">
            {SOURCES_SECTION.caption}
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
