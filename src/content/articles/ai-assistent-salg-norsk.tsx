import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function AiAssistentSalgArticle() {
  return (
    <>
      <p>
        «AI i salg» høres stort ut. Mange tenker chatbot som sender masse e-post, eller noe som
        erstatter selgeren. I praksis — for de fleste B2B-selgere i Norge — handler AI om noe
        enklere: <strong>finne riktige firma raskere, på vanlig norsk</strong>.
      </p>

      <h2>Hva AI faktisk er god til her</h2>
      <p>
        Tenk på det som en assistent som forstår hva du mener når du skriver «frisører i Bergen
        uten nettside» eller «nye restauranter i Trondheim med telefon». Du slipper å klikke deg
        gjennom ti filtre og eksportere til Excel.
      </p>
      <p>
        AI er <em>ikke</em> magi som ringer og lukker salg for deg. Den hjelper deg med det
        kjedelige: søke, filtrere, samle — så du bruker tid på mennesker, ikke på faner.
      </p>

      <h2>Spør på norsk — få svar du kan bruke</h2>
      <p>
        Norske selgere trenger norske søk. «Finn byggfirma i Innlandet» skal gi mening. «Vis meg
        firma uten nettside i Oslo» skal fungere. Du skal ikke måtte lære et nytt språk eller et
        komplisert grensesnitt.
      </p>
      <p>
        Når assistenten forstår intensjonen din, blir leadgenerering mer som en samtale og mindre
        som et regneark.
      </p>

      <h2>AI + ekte data = leads du kan ringe</h2>
      <p>
        AI alene er verdiløs uten gode data. Du trenger fortsatt Brreg, kontaktinfo fra åpne
        kilder, og filtre som gir relevante treff — ikke tilfeldige firma.
      </p>
      <p>
        Den beste kombinasjonen: offentlige registre og berikelse i bunn, norsk språkforståelse
        på topp, og en tabell med telefon og e-post du kan handle på med én gang.
      </p>

      <h2>Når du fortsatt må gjøre jobben selv</h2>
      <p>
        Samtalen, tilbudet, oppfølgingen — det er fortsatt deg. AI fjerner ikke salget. Den
        fjerner tiden du bruker på å finne ut <em>hvem</em> du skal ringe.
      </p>
      <p>
        <Link href="/">NyLead</Link> har en norsk assistent innebygd. Spør hva du leter etter, få
        en liste med firma, kontaktinfo og signaler — klar til å ringe.
      </p>

      <ArticleCta />
      <RelatedArticles slug="ai-assistent-salg-norsk" />
    </>
  );
}
