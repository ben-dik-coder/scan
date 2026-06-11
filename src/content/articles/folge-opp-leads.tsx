import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function FolgeOppLeadsArticle() {
  return (
    <>
      <p>
        Du har ringt 20 firma. Fem svarte. Tre sa «send info». To sa «ring tilbake om en måned».
        Resten? Ingenting. Hvis du ikke har oversikt, forsvinner halvparten av mulighetene dine i
        rotet.
      </p>

      <h2>Oppfølging er der salget skjer</h2>
      <p>
        Studier (og erfaring) viser det samme: de fleste salg lukkes ikke på første kontakt. Det
        skjer i oppfølgingen. Men oppfølging krever at du <em>husker</em> hvem du har kontaktet,
        hva de sa, og når du skal ta neste steg.
      </p>

      <h2>En enkel pipeline</h2>
      <p>Du trenger ikke et tungt CRM for å starte. Fire statuser holder for mange:</p>
      <ul>
        <li><strong>Ny</strong> — ikke kontaktet ennå</li>
        <li><strong>Kontaktet</strong> — ringt eller sendt, venter på svar</li>
        <li><strong>Oppfølging</strong> — skal ringes/sendes igjen på dato</li>
        <li><strong>Lukket</strong> — ja, nei, eller ikke aktuelt nå</li>
      </ul>
      <p>
        Poenget er å flytte firma mellom statusene — ikke la dem henge i «kontaktet» i evigheter
        uten neste handling.
      </p>

      <h2>Hva du bør notere per lead</h2>
      <ul>
        <li>Dato for siste kontakt</li>
        <li>Hva du sa / hva de svarte</li>
        <li>Neste steg og dato</li>
        <li>Telefon og e-post (så du slipper å lete igjen)</li>
      </ul>
      <p>
        Excel fungerer. Notatbok fungerer. Men det som fungerer best er når listen og
        oppfølgingen bor samme sted — så du ikke kopierer mellom tre verktøy.
      </p>

      <h2>Typiske feil</h2>
      <p>
        <strong>Glemme å følge opp.</strong> «Ring tilbake om to uker» blir aldri til noe hvis
        du ikke har en påminnelse.
      </p>
      <p>
        <strong>Følge opp for mye.</strong> Fem e-poster uten svar er irriterende. Vit når du
        skal stoppe.
      </p>
      <p>
        <strong>Ingen oversikt over hvem som er varm.</strong> De som sa «send tilbud» skal
        prioriteres over de du bare sendte info til én gang.
      </p>

      <h2>Hold alt samlet</h2>
      <p>
        <Link href="/">NyLead</Link> lar deg lagre lister, se kontaktinfo, og følge opp fra din
        egen innboks — uten å miste tråden mellom research og salg.
      </p>

      <ArticleCta />
      <RelatedArticles slug="folge-opp-leads" />
    </>
  );
}
