import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function LeadgenereringB2bArticle() {
  return (
    <>
      <p>
        «Leadgenerering» høres fancy ut. Men for de fleste B2B-selgere betyr det noe ganske
        enkelt: <strong>finne folk du kan selge til, og få tak i dem</strong>. Resten er detaljer.
      </p>

      <h2>Hva er en god lead?</h2>
      <p>En god B2B-lead er ikke bare et firmanavn. Det er et firma der:</p>
      <ul>
        <li>Du vet hvem de er og hva de driver med</li>
        <li>Du har en måte å kontakte dem på (telefon eller e-post)</li>
        <li>Det er en grunn til at de kan trenge det du selger</li>
        <li>Du kan ta kontakt innen rimelig tid</li>
      </ul>
      <p>
        En dårlig lead er «AS med org.nr 123» uten telefon, uten e-post, og uten at du aner om de
        trenger noe som helst.
      </p>

      <h2>Leadgenerering vs. salg</h2>
      <p>
        Mange blander disse. Leadgenerering er <em>før</em> salget: finne, filtrere, samle
        kontaktinfo. Salg er <em>etterpå</em>: ringe, sende tilbud, følge opp, lukke.
      </p>
      <p>
        Hvis du bruker 80 % av uken på å lete og 20 % på å selge, har du et leadgenereringsproblem
        — ikke et salgsproblem.
      </p>

      <h2>Tre kilder de fleste overser</h2>
      <p>
        <strong>1. Nyregistrerte firma.</strong> Hver uke kommer det nye AS og ENK i Brreg. De er
        ofte de mest motiverte kundene — de trenger hjelp med alt fra nettside til regnskap.
      </p>
      <p>
        <strong>2. Firma uten nettside.</strong> Hvis du selger digitale tjenester, er dette
        gull. Men selv om du selger noe annet, kan mangel på nettside være et tegn på at firmaet
        er lite digitalt — og kanskje mer mottakelig for personlig kontakt.
      </p>
      <p>
        <strong>3. Lokale lister.</strong> «Alle frisører i Bergen» eller «byggfirma i
        Innlandet» — når du kan filtrere på kommune og bransje, blir listen plutselig brukbar.
      </p>

      <h2>Bygg en enkel rutine</h2>
      <ol>
        <li>Velg område og bransje mandag</li>
        <li>Skann og filtrer tirsdag–onsdag</li>
        <li>Ring og send onsdag–fredag</li>
        <li>Følg opp neste uke</li>
      </ol>
      <p>
        Repeter. Leadgenerering er ikke noe du gjør «når du har tid» — det er grunnmuren i
        B2B-salg.
      </p>

      <h2>NyLead som leadmotor</h2>
      <p>
        <Link href="/">NyLead</Link> er bygget for denne rytmen: skann markedet, filtrer på det du
        trenger, lagre lister, og følg opp uten å miste oversikten.
      </p>

      <ArticleCta />
      <RelatedArticles slug="leadgenerering-b2b-selgere" />
    </>
  );
}
