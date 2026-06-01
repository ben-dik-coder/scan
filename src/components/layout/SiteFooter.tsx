import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-brand-navyDark py-16 text-white">
      <Container wide>
        <div className="gold-divider mb-12" />

        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-gold font-display text-base font-black text-brand-navy">
                N
              </span>
              <span className="font-display text-2xl font-black uppercase tracking-wide">
                {site.name}
              </span>
            </div>
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-white/40">
              {site.tagline}
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="type-eyebrow !text-white/25">Produkt</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
                <li>
                  <Link href="/app/oversikt" className="transition hover:text-brand-goldLight">
                    Prøv demo
                  </Link>
                </li>
                <li>
                  <Link href="/innlogging" className="transition hover:text-brand-goldLight">
                    Logg inn
                  </Link>
                </li>
                <li>
                  <Link href="/registrer" className="transition hover:text-brand-goldLight">
                    Opprett konto
                  </Link>
                </li>
              </ul>
            </div>

            <div className="max-w-[200px]">
              <p className="type-eyebrow !text-white/25">Juridisk</p>
              <p className="mt-5 font-sans text-xs leading-relaxed text-white/35">
                Generelle bedriftsadresser er OK uten samtykke. Personlige adresser krever
                samtykke.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-14 font-display text-[10px] font-bold uppercase tracking-athletic text-white/20">
          © {new Date().getFullYear()} {site.name} · Brønnøysundregistrene
        </p>
      </Container>
    </footer>
  );
}
