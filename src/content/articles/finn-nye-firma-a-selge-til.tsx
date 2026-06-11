import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function FinnNyeFirmaArticle() {
  return (
    <>
      <p>
        Du vet hva som er vanskeligst i B2B-salg? Ikke selve salget. Det er å finne <em>hvem</em> du
        skal ringe. Hver uke dukker det opp nye firma i Norge — og de fleste selgere bruker for
        mye tid på å lete, og for lite tid på å faktisk ta kontakt.
      </p>

      <h2>Start med hvem du vil selge til</h2>
      <p>
        Før du åpner Excel eller begynner å scrolle på Proff, må du vite to ting: <strong>hvilken
        bransje</strong> og <strong>hvilket område</strong>. «Alle firma i Norge» er for bredt. «Nye
        restauranter i Trondheim» eller «regnskapsfirma uten nettside i Vestfold» — det er noe du
        kan handle på.
      </p>
      <p>
        Jo tydeligere du er, jo raskere finner du firma som faktisk kan kjøpe det du selger. Og jo
        mindre tid kaster du bort på feil samtaler.
      </p>

      <h2>Bruk offentlige kilder smart</h2>
      <p>
        I Norge er Brønnøysundregistrene den viktigste kilden for nye firma. Dataene er offentlige
        og gratis. Men Brreg alene gir deg sjelden telefon, e-post eller et tydelig bilde av om
        firmaet trenger det du selger.
      </p>
      <p>
        Derfor må du ofte kombinere Brreg med andre åpne kilder: nettsider, Gulesider, Google,
        sosiale profiler og booking-tjenester. Det er her de fleste selgere bruker timer hver uke —
        manuelt, firma for firma.
      </p>

      <h2>Filtrer hardt — kvalitet slår kvantitet</h2>
      <p>
        En liste med 500 firma høres imponerende ut. Men hvis bare 20 av dem er relevante, har du
        egentlig en liste med 20 og 480 distraksjoner. Bedre å starte med 30–50 gode leads enn 500
        tilfeldige navn.
      </p>
      <p>Spør deg selv for hvert firma:</p>
      <ul>
        <li>Er dette riktig bransje?</li>
        <li>Er det i riktig område?</li>
        <li>Har jeg telefon eller e-post?</li>
        <li>Finnes det et tydelig behov akkurat nå?</li>
      </ul>

      <h2>Ta kontakt raskt når du har funnet dem</h2>
      <p>
        Nye firma er som ferske bolter — de forsvinner fort. Konkurrentene dine leter også. Når du
        først har en god liste, bør du ringe eller sende e-post innen få dager — ikke lagre den til
        «neste uke».
      </p>
      <p>
        Det hjelper å ha ett sted å samle firma, kontaktinfo og status. Da slipper du å spørre deg
        selv «har jeg ringt denne før?» hver gang du åpner innboksen.
      </p>

      <h2>Slik gjør NyLead det enklere</h2>
      <p>
        <Link href="/">NyLead</Link> starter med nye firma fra Brreg, beriker med åpne kilder, og
        gir deg telefon, e-post og signaler i én tabell. Du filtrerer på kommune og bransje, lagrer
        lister, og følger opp fra din egen innboks.
      </p>

      <ArticleCta />
      <RelatedArticles slug="finn-nye-firma-a-selge-til" />
    </>
  );
}
