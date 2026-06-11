import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/marketing/ArticleLayout";
import { getArticleContent } from "@/content/articles";
import { getAllArticleSlugs, getArticleBySlug } from "@/lib/articles";
import { site } from "@/lib/site";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const url = `${site.url}/artikler/${article.slug}`;

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/artikler/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: "article",
      publishedTime: article.publishedAt,
      locale: "nb_NO",
      siteName: site.name,
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.description,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const Content = getArticleContent(slug);
  if (!Content) notFound();

  return (
    <ArticleLayout article={article}>
      <Content />
    </ArticleLayout>
  );
}
