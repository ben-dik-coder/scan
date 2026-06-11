import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container } from "@/components/ui/Container";
import { ARTICLES } from "@/lib/articles";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Artikler om B2B-salg og leadgenerering",
  description:
    "Guider for B2B-selgere i Norge: finn nye firma, kontaktinfo, Brreg, kald kontakt og oppfølging.",
  alternates: {
    canonical: "/artikler",
  },
  openGraph: {
    title: `Artikler — ${site.name}`,
    description:
      "Praktiske guider for å finne nye firma, kontaktinfo og leads i Norge.",
    url: `${site.url}/artikler`,
    type: "website",
  },
};

const hubJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: "Artikler",
      description:
        "Guider for B2B-selgere i Norge om leadgenerering, Brreg og kontaktinfo.",
      url: `${site.url}/artikler`,
      inLanguage: "nb-NO",
      isPartOf: {
        "@type": "WebSite",
        name: site.name,
        url: site.url,
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Forside",
          item: site.url,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Artikler",
          item: `${site.url}/artikler`,
        },
      ],
    },
  ],
};

export default function ArtiklerPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubJsonLd) }}
      />
      <SiteHeader />
      <main className="pt-14 sm:pt-[72px]">
        <Container className="py-12 sm:py-16">
          <nav aria-label="Brødsmulesti" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-app-accent">
              Forside
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-700">Artikler</span>
          </nav>

          <header className="mb-10 max-w-3xl border-b border-slate-200 pb-8">
            <h1 className="font-display text-3xl font-bold text-app-ink sm:text-4xl">
              Artikler
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Praktiske guider for B2B-selgere i Norge — finn nye firma, kontaktinfo, og
              hold oversikt i salgsarbeidet.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 lg:max-w-5xl">
            {ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/artikler/${article.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-app-accent/30 hover:shadow-md"
              >
                <h2 className="font-display text-lg font-bold text-app-ink group-hover:text-app-accent">
                  {article.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {article.description}
                </p>
                <p className="mt-4 text-xs font-medium text-slate-400">
                  {article.readingMinutes} min lesetid
                </p>
              </Link>
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
