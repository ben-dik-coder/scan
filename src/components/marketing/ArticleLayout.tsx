import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container } from "@/components/ui/Container";
import type { ArticleMeta } from "@/lib/articles";
import { site } from "@/lib/site";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildArticleJsonLd(article: ArticleMeta) {
  const url = `${site.url}/artikler/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: article.publishedAt,
        inLanguage: "nb-NO",
        url,
        mainEntityOfPage: url,
        author: {
          "@type": "Organization",
          name: site.name,
          url: site.url,
        },
        publisher: {
          "@type": "Organization",
          name: site.name,
          url: site.url,
          logo: {
            "@type": "ImageObject",
            url: `${site.url}/favicon.svg`,
          },
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
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: url,
          },
        ],
      },
    ],
  };
}

export function ArticleLayout({
  article,
  children,
}: {
  article: ArticleMeta;
  children: React.ReactNode;
}) {
  const jsonLd = buildArticleJsonLd(article);

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="pt-14 sm:pt-[72px]">
        <Container className="py-12 sm:py-16">
          <nav aria-label="Brødsmulesti" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-app-accent">
              Forside
            </Link>
            <span aria-hidden>/</span>
            <Link href="/artikler" className="hover:text-app-accent">
              Artikler
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-700">{article.title}</span>
          </nav>

          <header className="mb-10 max-w-3xl border-b border-slate-200 pb-8">
            <h1 className="font-display text-3xl font-bold text-app-ink sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              {article.description}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {formatDate(article.publishedAt)} · {article.readingMinutes} min lesetid
            </p>
          </header>

          <article className="legal-prose max-w-3xl">{children}</article>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
