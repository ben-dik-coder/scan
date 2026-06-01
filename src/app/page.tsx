import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Filter,
  Globe,
  Mail,
  MapPin,
  MousePointerClick,
  Send,
} from "lucide-react";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Container } from "@/components/ui/Container";
import { site, WORKFLOW_STEPS } from "@/lib/site";

const FEATURES = [
  {
    icon: Building2,
    title: "Data fra Brønnøysund",
    text: "Nye firma med e-post og telefon — gratis og oppdatert. Ingen dyre Proff-abonnement.",
    featured: true,
  },
  {
    icon: MapPin,
    title: "Skann ditt marked",
    text: "Filtrer på kommune og dato. Se kun firma med e-post — klart på sekunder.",
    featured: true,
  },
  {
    icon: MousePointerClick,
    title: "Huk av og send",
    text: "Velg 20, 50 eller 100 firma. Én felles melding til alle — med {firmanavn} automatisk.",
    featured: true,
  },
  {
    icon: Send,
    title: "Fra din e-postkonto",
    text: "Send som deg selv (Gmail/Outlook). Kunden svarer til din adresse — ikke en robot.",
    featured: true,
  },
  {
    icon: Mail,
    title: "Maler for nettside-tilbud",
    text: "Lagre tekster du bruker om igjen. «Gratulerer med oppstart — trenger dere nettside?»",
    featured: false,
  },
  {
    icon: Globe,
    title: "Lovlig kontakt",
    text: "post@ og info@ er OK uten samtykke. Appen advarer hvis adressen er personlig.",
    featured: false,
  },
];

const TRUST = [
  "Brønnøysundregistrene",
  "For webdesignere",
  "Pro: send fra din mail",
  "Velg 20 på ett klikk",
  "Norsk regelverk",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative overflow-hidden bg-brand-navy pt-14 text-white sm:pt-[72px]">
        <Container wide className="relative py-12 sm:py-20 md:py-28 lg:py-36">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-20">
            <div className="order-2 lg:order-1 lg:max-w-[560px]">
              <p className="type-eyebrow">{site.audience}</p>

              <h1 className="type-hero mt-4 text-white sm:mt-6">
                Skann markedet.
                <br />
                Velg firma.
                <br />
                <span className="text-brand-goldLight">Send tilbud.</span>
              </h1>

              <p className="mt-5 max-w-lg font-sans text-base font-medium leading-relaxed text-white/60 sm:mt-8 sm:text-lg">
                {site.tagline}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
                <Link href="/app" className="btn-primary w-full sm:w-auto">
                  Skann markedet nå
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
                <Link href="/registrer" className="btn-secondary w-full sm:w-auto">
                  Opprett konto
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/10 pt-8 sm:mt-14 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-5">
                {site.stats.map((s) => (
                  <div key={s.label}>
                    <p className="type-stat !text-2xl !text-brand-goldLight sm:!text-4xl lg:!text-5xl">
                      {s.value}
                    </p>
                    <p className="type-label mt-1 text-[10px] normal-case leading-snug !text-white/40 sm:mt-1.5 sm:max-w-[120px] sm:text-[11px]">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 w-full lg:order-2 lg:max-w-[480px] lg:flex-1">
              <HeroPreview />
            </div>
          </div>
        </Container>
      </section>

      <section className="overflow-hidden border-y border-slate-100 bg-brand-navyDark py-4">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...TRUST, ...TRUST].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="mx-8 font-display text-sm font-bold uppercase tracking-[0.12em] text-white/30"
            >
              {item}
              <span className="ml-8 text-brand-gold">◆</span>
            </span>
          ))}
        </div>
      </section>

      <section id="funksjoner" className="bg-[#f8f9fb] py-16 sm:py-24 md:py-32">
        <Container wide>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="type-eyebrow">Hvorfor NyLead</p>
              <h2 className="type-h2 mt-3 max-w-lg text-brand-navy">
                Bygget for å selge nettsider
              </h2>
            </div>
            <p className="max-w-sm font-sans text-sm font-medium leading-relaxed text-slate-500 md:text-right">
              Slutt å lete manuelt på Proff. Finn nye firma som trenger nettside — raskt.
            </p>
          </div>

          <div className="mt-16 space-y-3">
            {FEATURES.map(({ icon: Icon, title, text, featured }, i) => (
              <div
                key={title}
                className={`feature-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
              >
                <div
                  className={`relative flex shrink-0 items-center justify-center rounded-lg bg-brand-navy ${
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

      <section id="slik-funker-det" className="bg-brand-navy py-16 sm:py-24 md:py-32">
        <Container wide>
          <div className="text-center">
            <p className="type-eyebrow">Slik funker det</p>
            <h2 className="type-h2 mt-3 text-white">Tre steg. Noen få klikk.</h2>
            <p className="mx-auto mt-4 max-w-md font-sans text-sm text-white/50">
              Fra Brønnøysund til utsendt tilbud — uten Excel og manuelt kopiering.
            </p>
          </div>

          <div className="mt-16 flex flex-col divide-y divide-white/10 md:mt-20 md:flex-row md:divide-x md:divide-y-0">
            {WORKFLOW_STEPS.map(({ step, title, description }) => (
              <div
                key={step}
                className="flex-1 px-0 py-10 md:px-10 md:py-0 first:md:pl-0 last:md:pr-0"
              >
                <p className="font-display text-6xl font-black leading-none text-brand-gold/20">
                  {String(step).padStart(2, "0")}
                </p>
                <h3 className="type-h3 mt-4 text-white">{title}</h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-white/50">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center sm:mt-16">
            <Link href="/innlogging" className="btn-primary">
              Logg inn og kom i gang
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </Link>
          </div>
        </Container>
      </section>

      <PricingSection />

      <section className="border-t border-slate-100 bg-[#f8f9fb] py-16">
        <Container wide>
          <div className="mx-auto flex max-w-3xl items-start gap-4 border-l-4 border-brand-gold bg-white px-6 py-5">
            <Filter className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
            <p className="font-sans text-sm leading-relaxed text-slate-500">
              E-post til generelle bedriftsadresser (post@, info@) er tillatt uten
              samtykke. Personlige adresser krever samtykke — appen advarer og
              blokkerer dette som standard.
            </p>
          </div>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
