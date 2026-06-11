import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function KaldKontaktNyeFirmaArticle() {
  return (
    <>
      <p>
        Kald kontakt betyr å ta kontakt med noen som ikke har bedt om det. Mange hater det.
        Mange selgere hater det også. Men når det gjøres riktig — til riktige firma, med riktig
        budskap — fungerer det fortsatt i B2B i Norge.
      </p>

      <h2>Hva skiller bra kald kontakt fra spam?</h2>
      <p>
        <strong>Spam:</strong> masse e-post til alle, generisk tekst, ingen grunn til at de
        skulle bry seg.
      </p>
      <p>
        <strong>Bra kald kontakt:</strong> du vet hvem de er, du har en konkret grunn til å ta
        kontakt, og du respekterer tiden deres.
      </p>
      <p>
        Forskjellen er research. Når du ringer et nyregistrert firma og sier «Gratulerer med
        oppstart — mange nye restauranter trenger hjelp med X», høres det annerledes ut enn «Hei,
        vi er ledende leverandør av…»
      </p>

      <h2>Telefon eller e-post?</h2>
      <p>
        <strong>Telefon</strong> gir rask tilbakemelding. Ja, nei, eller «ring tilbake». Du
        bruker 2–3 minutter og vet hvor du står.
      </p>
      <p>
        <strong>E-post</strong> er bedre når du vil sende mer info, eller når du ikke får tak i
        noen på telefon. Kort, personlig, med én tydelig grunn til å svare.
      </p>
      <p>
        Mange selgere ringer først og følger opp med e-post. Eller motsatt — e-post først, ring
        hvis de åpner eller svarer.
      </p>

      <h2>Tre ting som fungerer til nye firma</h2>
      <ol>
        <li>
          <strong>Gratuler med oppstart.</strong> Nye firma er stolte. Vis at du har sett at de
          er nye.
        </li>
        <li>
          <strong>Nevn noe konkret.</strong> «Jeg ser dere ikke har nettside ennå» eller «Dere
          ligger i [kommune]» — det viser at du har gjort leksa.
        </li>
        <li>
          <strong>Ett spørsmål, ikke ti.</strong> «Er det noe dere sliter med akkurat nå rundt
          [tema]?» er bedre enn en lang pitch.
        </li>
      </ol>

      <h2>Følg opp — eller gi opp tydelig</h2>
      <p>
        De fleste svarer ikke første gang. Det er normalt. Én oppfølging etter 3–5 dager er
        greit. Tre e-poster uten svar er spam. Vit når du skal stoppe — og ha oversikt så du
        ikke ringer samme firma seks ganger uten å vite det.
      </p>
      <p>
        <Link href="/artikler/folge-opp-leads">Les mer om oppfølging av leads</Link>.
      </p>

      <h2>Ha kontaktinfo klar før du ringer</h2>
      <p>
        Kald kontakt feiler ofte fordi selgeren ikke har telefon eller e-post.{" "}
        <Link href="/">NyLead</Link> samler kontaktinfo og signaler så du kan fokusere på
        samtalen — ikke på research.
      </p>

      <ArticleCta />
      <RelatedArticles slug="kald-kontakt-nye-firma" />
    </>
  );
}
