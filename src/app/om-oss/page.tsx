import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container } from "@/components/ui/Container";
import { OmOssContent } from "@/content/om-oss";
import { legal } from "@/lib/legal";

export const metadata = {
  title: "Om oss — NyLead",
  description: "Hvem står bak NyLead, og hvorfor tjenesten finnes.",
};

export default function OmOssPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="pt-14 sm:pt-[72px]">
        <Container className="py-12 sm:py-16">
          <nav className="mb-8 flex flex-wrap gap-4 text-sm text-slate-500">
            <Link href="/" className="hover:text-brand-navy">
              Forside
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-700">Om oss</span>
          </nav>

          <header className="mb-10 max-w-3xl border-b border-slate-200 pb-8">
            <h1 className="font-display text-3xl font-bold text-brand-navy sm:text-4xl">
              Om oss
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {legal.productName} · {legal.operatorName}
            </p>
          </header>

          <article className="legal-prose max-w-3xl">
            <OmOssContent />
          </article>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
