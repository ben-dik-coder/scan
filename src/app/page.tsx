import type { Metadata } from "next";
import { LandingThemeReset } from "@/components/marketing/LandingThemeReset";
import {
  LandingNoirAgentStrip,
  LandingNoirComparison,
  LandingNoirFeatures,
  LandingNoirFinalBand,
  LandingNoirFaqBlock,
  LandingNoirHero,
  LandingNoirIntegrations,
  LandingNoirPlatform,
  LandingNoirPricingBlock,
  LandingNoirSources,
  LandingNoirUseCases,
  LandingNoirWorkflow,
} from "@/components/marketing/LandingNoirSections";
import { LandingResendMoments } from "@/components/marketing/LandingResendMoments";
import { LandingNoirBand } from "@/components/marketing/LandingNoirCta";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Finn nye kunder før konkurrentene",
  description:
    "NyLead finner nye firma i Norge, kontaktinfo og signaler du kan bruke. Skann markedet, filtrer, kontakt og følg opp fra egen innboks.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "NyLead — Finn nye kunder før konkurrentene",
    description:
      "Finn nye firma, se kontaktinfo og signaler, og følg opp fra ett sted.",
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
    title: "NyLead — Finn nye kunder før konkurrentene",
    description:
      "Skann nye firma, filtrer de beste, kontakt og følg opp fra egen innboks.",
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
      featureList: [
        "Finn nye firma fra Brønnøysundregistrene",
        "Finn telefon og e-post fra åpne kilder når det finnes",
        "Sjekk nettside, booking og andre enkle signaler",
        "Filtrer firma etter område, bransje og kontaktinfo",
        "Arbeidskø, pipeline og AI-ringemodus",
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <div className="landing-canvas landing-noir landing-noir-max min-h-screen">
      <LandingThemeReset />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader className="landing-noir-header" />

      <LandingNoirHero />
      <LandingResendMoments />
      <LandingNoirSources />
      <LandingNoirPlatform />

      <LandingNoirBand
        title="Stopp å lete. La AI ringe. Du lukker."
        body="Skann nye firma, få kontaktinfo, og start AI-ringemodus med manus laget for akkurat den bedriften."
        primaryLabel="Åpne Skann"
        secondaryLabel="Åpne AI-ring"
        secondaryHref="/app/ring"
      />

      <LandingNoirFeatures />
      <LandingNoirUseCases />
      <LandingNoirWorkflow />
      <LandingNoirComparison />
      <LandingNoirAgentStrip />
      <LandingNoirIntegrations />
      <LandingNoirPricingBlock />
      <LandingNoirFaqBlock />
      <LandingNoirFinalBand />

      <SiteFooter />
    </div>
  );
}
