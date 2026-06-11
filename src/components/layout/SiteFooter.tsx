import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { legal } from "@/lib/legal";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-app-ink py-16 text-white">
      <Container wide>
        <div className="gold-divider mb-12" />

        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div>
            <SiteLogo variant="dark" className="h-10 w-auto sm:h-11" />
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-white/40">
              {site.tagline}
            </p>
            {legal.orgNr ? (
              <p className="mt-2 font-sans text-sm text-white/40">Org.nr {legal.orgNr}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-16">
            <div>
              <p className="type-eyebrow !text-white/25">Produkt</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
                <li>
                  <Link href="/innlogging" className="transition hover:text-app-accentLight">
                    Logg inn
                  </Link>
                </li>
                <li>
                  <Link href="/registrer" className="transition hover:text-app-accentLight">
                    Opprett konto
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="type-eyebrow !text-white/25">Selskap</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
                <li>
                  <Link href="/om-oss" className="transition hover:text-app-accentLight">
                    Om oss
                  </Link>
                </li>
                <li>
                  <Link href="/hjelp" className="transition hover:text-app-accentLight">
                    Hjelp og support
                  </Link>
                </li>
                <li>
                  <Link href="/artikler" className="transition hover:text-app-accentLight">
                    Artikler
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="type-eyebrow !text-white/25">Juridisk</p>
              <ul className="mt-5 space-y-3 font-sans text-sm text-white/50">
                <li>
                  <Link href="/personvern" className="transition hover:text-app-accentLight">
                    Personvern
                  </Link>
                </li>
                <li>
                  <Link href="/vilkar" className="transition hover:text-app-accentLight">
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
