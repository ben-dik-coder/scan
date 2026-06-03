import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container } from "@/components/ui/Container";
import { legal } from "@/lib/legal";

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
            <Link href="/om-oss" className="hover:text-brand-navy">
              Om oss
            </Link>
            <span aria-hidden>/</span>
            <Link href="/personvern" className="hover:text-brand-navy">
              Personvern
            </Link>
            <span aria-hidden>/</span>
            <Link href="/vilkar" className="hover:text-brand-navy">
              Vilkår
            </Link>
          </nav>

          <header className="mb-10 max-w-3xl border-b border-slate-200 pb-8">
            <h1 className="font-display text-3xl font-bold text-brand-navy sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {legal.productName} · Sist oppdatert {legal.lastUpdated}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Behandlingsansvarlig / tilbyder:{" "}
              <strong className="text-slate-700">{legal.operatorName}</strong>
              {legal.orgNr ? ` · Org.nr ${legal.orgNr}` : ""}
            </p>
          </header>

          <article className="legal-prose max-w-3xl">{children}</article>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
