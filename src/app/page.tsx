import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { HeroAudienceChips } from "@/components/marketing/HeroAudienceChips";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import { LandingSourcesSection } from "@/components/marketing/LandingSourcesSection";
import { HeroValueStrip } from "@/components/marketing/HeroValueStrip";
import {
  ComparisonSection,
  FaqSection,
  IntegrationsSection,
  PlatformSection,
  UseCasesSection,
  WorkflowDetailedSection,
} from "@/components/marketing/LandingDeepContent";
import { LandingFoldTransition } from "@/components/marketing/LandingFoldTransition";
import { LandingSheet } from "@/components/marketing/LandingSheet";
import { NyleadRoiCalculator } from "@/components/marketing/NyleadRoiCalculator";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Container } from "@/components/ui/Container";
import { FEATURES, FEATURES_SECTION, HERO, TRUST } from "@/content/landing";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Finn nye firma med telefon og e-post",
  description:
    "Finn nye firma i Norge fra Brønnøysund. NyLead henter kontaktinfo, sjekker nettside med Google og lar deg ringe eller sende tilbud fra egen innboks.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NyLead — Finn nye firma med telefon og e-post",
    description:
      "Brreg, Google-sjekk, kontaktinfo, arbeidskø, pipeline og e-post i ett verktøy for B2B-salg.",
    url: site.url,
    images: [
      {
        url: site.ogImage,
        width: 1991,
        height: 790,
        alt: "NyLead dashboard med nye firma, kontaktinfo og nettside-sjekk.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NyLead — Finn nye firma med telefon og e-post",
    description:
      "Finn nye firma fra Brreg, hent kontaktinfo og send fra egen innboks.",
    images: [site.ogImage],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/favicon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      name: site.name,
      url: site.url,
      inLanguage: "nb-NO",
      publisher: { "@id": `${site.url}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${site.url}/#software`,
      name: site.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: site.url,
      description: site.description,
      offers: {
        "@type": "Offer",
        price: "499",
        priceCurrency: "NOK",
        availability: "https://schema.org/InStock",
      },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "B2B-selgere, rådgivere, webbyrå, regnskap, IT og markedsføring",
      },
      featureList: [
        "Finn nye firma fra Brønnøysundregistrene",
        "Hent telefon og trygg e-post fra flere kilder",
        "Sjekk nettside med Google",
        "Filtrer leads etter område, bransje og kontaktinfo",
        "Arbeidskø, pipeline og e-post fra egen innboks",
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <div className="landing-canvas min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <section
        className="relative overflow-hidden bg-brand-surface pt-[7.5rem] text-brand-navy sm:pt-[6.5rem] md:pt-[7rem]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #f6f9fc 0%, #e0e7ff 45%, #f6f9fc 100%)",
        }}
      >
        <Container wide className="relative py-12 sm:py-20 md:py-16 lg:py-20">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 xl:gap-14">
            <div className="order-2 lg:order-1 lg:col-span-5 lg:max-w-none">
              <p className="type-eyebrow">{HERO.eyebrow}</p>

              <h1 className="hero-title mt-4 sm:mt-6">
                <span className="block">{HERO.titleLine1}</span>
                <span className="block text-brand-gold">{HERO.titleLine2}</span>
              </h1>

              <HeroValueStrip className="mt-6 sm:mt-8" />

              <p className="mt-5 max-w-lg font-sans text-base font-medium leading-relaxed text-slate-600 sm:mt-6 sm:text-lg">
                {HERO.tagline}
              </p>

              <HeroAudienceChips className="mt-4" />

              <div className="mt-8 flex flex-col gap-3 sm:mt-10">
                <Link href="/app" className="btn-primary w-full sm:w-auto">
                  {HERO.ctaPrimary}
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
                <p className="text-center sm:text-left">
                  <Link
                    href="/registrer"
                    className="font-sans text-sm font-semibold text-slate-500 underline-offset-2 hover:text-brand-navy hover:underline"
                  >
                    {HERO.ctaSecondary}
                  </Link>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-sans text-sm text-slate-400">{HERO.trustLine}</span>
                </p>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-3 border-t border-brand-border pt-8 sm:mt-14 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-5">
                {site.stats.map((s) => (
                  <div key={s.label}>
                    <p className="type-stat !text-2xl !text-brand-gold sm:!text-4xl lg:!text-5xl">
                      {s.value}
                    </p>
                    <p className="type-label mt-1 text-[10px] normal-case leading-snug !text-slate-500 sm:mt-1.5 sm:max-w-[120px] sm:text-[11px]">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 w-full lg:order-2 lg:col-span-7">
              <HeroPreview />
            </div>
          </div>
        </Container>
      </section>

      <LandingSourcesSection />

      <section className="overflow-hidden border-y border-brand-border bg-white py-4">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...TRUST, ...TRUST].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="mx-8 font-display text-sm font-bold uppercase tracking-[0.12em] text-slate-400"
            >
              {item}
              <span className="ml-8 text-brand-gold">◆</span>
            </span>
          ))}
        </div>
      </section>

      <LandingSheet overlap>
        <PlatformSection embedded />
      </LandingSheet>

      <section id="funksjoner" className="py-16 sm:py-24 md:py-32">
        <Container wide>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="type-eyebrow">{FEATURES_SECTION.eyebrow}</p>
              <h2 className="type-h2 mt-3 max-w-lg text-brand-navy">
                {FEATURES_SECTION.title}
              </h2>
            </div>
            <p className="max-w-md font-sans text-sm font-medium leading-relaxed text-slate-500 md:text-right">
              {FEATURES_SECTION.subtitle}
            </p>
          </div>

          <div className="mt-16 space-y-3">
            {FEATURES.map(({ icon: Icon, title, text, featured }, i) => (
              <div
                key={title}
                className={`feature-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
              >
                <div
                  className={`relative flex shrink-0 items-center justify-center rounded-[10px] bg-brand-goldPale ${
                    featured ? "h-[72px] w-[72px]" : "h-14 w-14"
                  }`}
                >
                  <Icon className={`text-brand-gold ${featured ? "h-8 w-8" : "h-6 w-6"}`} />
                </div>
                <div className="relative flex-1">
                  <h3 className={`type-h3 text-brand-navy ${featured ? "!text-2xl" : ""}`}>
                    {title}
                  </h3>
                  <p className="type-body mt-2 max-w-lg !text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <UseCasesSection />
      <div className="landing-workflow-before-fold">
        <WorkflowDetailedSection />
      </div>

      <div className="landing-fold-zone">
        <LandingFoldTransition variant="dark-to-light" />
      </div>

      <LandingSheet belowFold overlap={false} className="landing-sheet-after-fold">
        <NyleadRoiCalculator embedded />
      </LandingSheet>

      <LandingSheet overlap>
        <ComparisonSection embedded />
      </LandingSheet>

      <IntegrationsSection />

      <LandingSheet overlap className="landing-sheet-before-light-fold">
        <PricingSection embedded />
      </LandingSheet>

      <div className="landing-fold-zone landing-fold-zone-light">
        <LandingFoldTransition variant="light-to-light" />
      </div>

      <LandingSheet
        belowFold
        overlap={false}
        className="landing-sheet-after-fold pb-12 sm:pb-16 md:pb-28"
      >
        <FaqSection embedded />
      </LandingSheet>

      <SiteFooter />
    </div>
  );
}
