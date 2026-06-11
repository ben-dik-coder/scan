import Link from "next/link";
import { ArticleCta, RelatedArticles } from "./shared";

export function TelefonOgEpostArticle() {
  return (
    <>
      <p>
        Du har funnet et firma du vil kontakte. Navnet står i Brreg. Org.nummeret er der. Men
        telefonnummeret? E-posten? Plutselig sitter du med fem faner åpne — Brreg, Proff, Google,
        Gulesider, firmaets nettside — og ingen svarer.
      </p>

      <h2>Hvorfor er kontaktinfo så vanskelig å finne?</h2>
      <p>
        Brønnøysundregistrene er laget for offentlig registrering, ikke for salg. Mange firma har
        telefon og e-post andre steder: på nettsiden, i Google Maps, på Gulesider, i en
        booking-profil på Timma eller Fixit, eller på en Facebook-side de lagde for tre år siden.
      </p>
      <p>
        Små firma oppdaterer sjelden Brreg når de får ny telefon. Større firma kan ha sentralbord
        som ikke svarer. Og noen bruker bare <code>post@</code> eller <code>info@</code> — som
        fungerer, men er vanskelig å finne uten å søke.
      </p>

      <h2>Den manuelle måten (som tar tid)</h2>
      <p>De fleste selgere gjør dette:</p>
      <ol>
        <li>Søk firmanavn på Google</li>
        <li>Sjekk nettsiden for «Kontakt oss»</li>
        <li>Prøv Gulesider eller 1881</li>
        <li>Se om det finnes Facebook-side med telefon</li>
        <li>Noter i Excel og gå videre til neste</li>
      </ol>
      <p>
        Det fungerer. Men med 50 firma bruker du en hel ettermiddag — bare på research, ikke på
        salg.
      </p>

      <h2>Hva du bør prioritere</h2>
      <p>
        <strong>Telefon</strong> er best for rask kontakt — du får svar med én gang, eller du vet
        at du må prøve igjen. <strong>E-post</strong> er bedre for lengre tilbud og dokumentasjon.
        Mange selgere starter med telefon og følger opp med e-post.
      </p>
      <p>
        Unngå å sende masse e-post til <code>post@firma.no</code> uten å sjekke om det finnes en
        direkte kontakt. Generiske adresser havner ofte i spam eller blir ignorert.
      </p>

      <h2>Samle alt på ett sted</h2>
      <p>
        Poenget er ikke å bli ekspert på ti forskjellige nettsteder. Poenget er å få telefon og
        e-post <em>ferdig</em> — så du kan bruke tiden på å ringe og selge.
      </p>
      <p>
        <Link href="/">NyLead</Link> henter kontaktinfo fra Brreg og åpne kilder, og viser det
        sammen med firmanavn og org.nr i én tabell. Du slipper å hoppe mellom faner for hvert eneste
        firma.
      </p>

      <ArticleCta />
      <RelatedArticles slug="telefon-og-epost-til-bedrifter" />
    </>
  );
}
