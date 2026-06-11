import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function FinnKunderMedTelefonArticle() {
  return (
    <>
      <p>
        Du har en liste med 100 firma. Halvparten har ingen telefon. En fjerdedel har bare en
        gammel e-post du ikke vet om fungerer. Plutselig er «100 leads» egentlig 25 du kan faktisk
        kontakte. Frustrerende — og helt unødvendig hvis du samler kontaktinfo riktig fra start.
      </p>

      <h2>Telefon er fortsatt kongen i B2B</h2>
      <p>
        E-post er fint for dokumenter og oppfølging. Men når du vil vite om noen er interessert
        <em> i dag</em>, ringer du. Én samtale på to minutter slår ti e-poster som ikke blir
        lest.
      </p>
      <p>
        Problemet er at telefonnummer til bedrifter er spredt overalt — nettside, Google Maps,
        Gulesider, Brreg (noen ganger), sosiale medier. Å finne det firma for firma tar tid.
      </p>

      <h2>E-post — når og hvordan</h2>
      <p>
        E-post fungerer best når du har noe konkret å sende: et tilbud, en artikkel, en
        invitasjon. Generisk «Hei, vi selger X» til <code>post@firma.no</code> har lav respons.
      </p>
      <p>
        Hvis du har direkte e-post til daglig leder eller kontaktperson, er det bedre. Noen
        ganger finner du det på nettsiden under «Om oss» eller «Kontakt».
      </p>

      <h2>Én tabell, ikke ti faner</h2>
      <p>
        Det smarteste du kan gjøre er å samle firmanavn, org.nr, telefon og e-post på ett sted.
        Da ser du med én gang hvem du kan ringe i dag — og hvem som mangler info.
      </p>
      <p>
        Filtrer gjerne på «har telefon» eller «har e-post» så du ikke kaster tid på firma du ikke
        kan nå.
      </p>

      <h2>Fra research til ring i samme økt</h2>
      <p>
        Mange selgere deler dagen: morgen research, ettermiddag ringing. Bedre: ha listen klar
        med kontaktinfo, så du kan ringe med én gang du finner et godt firma.
      </p>
      <p>
        <Link href="/">NyLead</Link> viser telefon og e-post sammen med firma og signaler i én
        tabell. Du slipper å hoppe mellom Brreg, Google og Gulesider for hvert eneste firma.
      </p>

      <ArticleCta />
      <RelatedArticles slug="finn-kunder-med-telefon" />
    </>
  );
}
