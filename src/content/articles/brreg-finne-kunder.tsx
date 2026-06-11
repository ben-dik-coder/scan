import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function BrregFinneKunderArticle() {
  return (
    <>
      <p>
        Brønnøysundregistrene — ofte bare kalt Brreg — er registeret over alle norske
        foretak. For B2B-selgere er det den viktigste kilden når du vil finne <em>nye</em> firma.
        Alt er offentlig. Gratis. Oppdatert løpende.
      </p>

      <h2>Hva finner du i Brreg?</h2>
      <p>For hvert firma får du typisk:</p>
      <ul>
        <li>Firmanavn og organisasjonsnummer</li>
        <li>Bransjekode (NACE)</li>
        <li>Forretningsadresse og kommune</li>
        <li>Stiftelsesdato og registreringsdato</li>
        <li>Antall ansatte (når det er rapportert)</li>
      </ul>
      <p>
        Det du <em>ikke</em> alltid får: telefon, e-post, nettside, eller et bilde av om de
        trenger det du selger.
      </p>

      <h2>Søk etter nyregistrerte firma</h2>
      <p>
        Den smarteste måten å bruke Brreg på i salg er å følge med på <strong>nye
        registreringer</strong>. Hver dag dukker det opp nye AS, ENK og andre enheter. De har
        nettopp startet — de trenger ofte leverandører, verktøy og hjelp.
      </p>
      <p>
        Filtrer på kommune hvis du selger lokalt. Filtrer på bransjekode hvis du vet hvem du vil
        treffe. «Alle nye firma i Oslo» er for bredt. «Nye restauranter i Oslo» er bedre.
      </p>

      <h2>Bransjekoder — kort forklart</h2>
      <p>
        NACE-koder forteller hva firmaet driver med. Kode 56.10 er restauranter. 69.20 er
        regnskap. 43.21 er elektrikerarbeid. Når du vet koden for målgruppen din, kan du søke
        presist i stedet for å gjette på navn.
      </p>

      <h2>Grensen til Brreg alene</h2>
      <p>
        Brreg er startpunktet, ikke sluttpunktet. Du må fortsatt finne kontaktinfo og vurdere om
        firmaet er relevant. Mange selgere eksporterer fra Brreg til Excel og fyller inn resten
        manuelt — time for time.
      </p>
      <p>
        <Link href="/artikler/nyregistrerte-firma-norge">Les mer om nyregistrerte firma</Link> og
        hvordan du bruker dem i salg.
      </p>

      <h2>Brreg + berikelse = leads du kan ringe</h2>
      <p>
        <Link href="/">NyLead</Link> henter data fra Brreg og beriker med telefon, e-post og
        signaler fra åpne kilder. Du søker på norsk — «frisører i Bergen uten nettside» — og får
        en tabell klar til bruk.
      </p>

      <ArticleCta />
      <RelatedArticles slug="brreg-finne-kunder" />
    </>
  );
}
