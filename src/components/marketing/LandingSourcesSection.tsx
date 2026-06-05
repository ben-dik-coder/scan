import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SOURCES_SECTION, SOURCES_SECTION_IMAGE } from "@/content/landing";

export function LandingSourcesSection() {
  return (
    <section
      id="kilder"
      className="border-b border-brand-border bg-white py-14 sm:py-20 md:py-24"
    >
      <Container wide>
        <div className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow">{SOURCES_SECTION.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-brand-navy">{SOURCES_SECTION.title}</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-slate-600 sm:text-lg">
            {SOURCES_SECTION.subtitle}
          </p>
        </div>

        <figure className="sources-section-figure mx-auto mt-10 max-w-6xl sm:mt-12">
          <div className="overflow-hidden rounded-2xl border border-brand-border bg-[#f8fafc] shadow-card lg:rounded-3xl">
            <Image
              src={SOURCES_SECTION_IMAGE}
              alt="NyLead henter bedriftsinfo fra Google, sosiale medier, Timma, Fixit og andre kilder — og samler alt i én oversikt"
              width={2400}
              height={1200}
              className="block h-auto w-full object-contain"
              sizes="(max-width: 1280px) 100vw, 1152px"
            />
          </div>
          <figcaption className="mt-4 text-center font-sans text-sm text-slate-500">
            {SOURCES_SECTION.caption}
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
