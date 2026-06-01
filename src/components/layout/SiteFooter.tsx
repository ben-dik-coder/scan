import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-brand-navyDark py-16 text-white">
      <Container wide>
        <div className="gold-divider mb-12" />

        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div>
            <SiteLogo className="h-10 w-auto sm:h-11" />
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-white/40">
              {site.tagline}
            </p>
          </div>

          <div className="flex flex-wrap gap-16">
            <div>
              <p className="type-eyebrow !text-white/25">Produkt</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
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

            <div>
              <p className="type-eyebrow !text-white/25">Juridisk</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
                <li>
                  <Link href="/personvern" className="transition hover:text-brand-goldLight">
                    Personvern
                  </Link>
                </li>
                <li>
                  <Link href="/vilkar" className="transition hover:text-brand-goldLight">
                    Vilkår for bruk
                  </Link>
                </li>
              </ul>
              <p className="mt-5 max-w-[220px] font-sans text-xs leading-relaxed text-white/35">
                Du er selv ansvarlig for lovlig markedsføring. Vi er en teknisk plattform.
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
