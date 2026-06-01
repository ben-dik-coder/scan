import { legal } from "@/lib/legal";

export function VilkarContent() {
  return (
    <>
      <p>
        Disse vilkårene («Vilkårene») regulerer din bruk av nettjenesten {legal.productName}{" "}
        («Tjenesten») levert av {legal.operatorName} («vi», «oss»). Ved å opprette konto, logge
        inn eller bruke Tjenesten aksepterer du Vilkårene. Hvis du ikke aksepterer dem, skal du
        ikke bruke Tjenesten.
      </p>

      <h2>1. Hva Tjenesten er</h2>
      <p>
        {legal.productName} er et verktøy for å hente offentlige firmadata (bl.a. fra
        Brønnøysundregistrene), filtrere leads, sjekke nettsidetilstedeværelse og sende
        e-postkampanjer via brukerens egen tilkoblede e-postkonto (Gmail/Outlook) eller annen
        konfigurert kanal. Vi er en <strong>teknisk plattform</strong> — ikke et byrå, ikke en
        advokat og ikke en garant for salg.
      </p>

      <h2>2. Hvem kan bruke Tjenesten</h2>
      <p>
        Tjenesten er beregnet på næringsdrivende brukere (typisk webdesignere, byråer og
        selgere). Du må være minst 18 år og ha myndighet til å inngå avtale på vegne av deg selv
        eller arbeidsgiver.
      </p>

      <h2>3. Ditt ansvar (viktig)</h2>
      <p>Du er selv ansvarlig for all bruk av Tjenesten under din konto, inkludert:</p>
      <ul>
        <li>
          At e-post du sender er <strong>lovlig</strong> etter markedsføringsloven,
          personvernforordningen (GDPR) og annen gjeldende lov.
        </li>
        <li>
          At du kun kontakter adresser du har <strong>rett til å kontakte</strong> (som regel
          generelle firmadresser som post@ og info@ uten forutgående samtykke; personlige
          adresser krever samtykke eller annet gyldig grunnlag).
        </li>
        <li>
          Innholdet i emne, tekst og tilbud — ingen villedende påstander, falske identiteter
          eller trakassering.
        </li>
        <li>
          Å respektere avmeldinger og enhver som ber deg stoppe kontakt.
        </li>
        <li>
          Grenser hos e-postleverandør (f.eks. Gmail/Outlook) og god markedsføringsskikk.
        </li>
        <li>
          At data du laster inn eller eksporterer fra Tjenesten brukes i tråd med lisenser og
          offentlig tilgang på kildegrunnlag.
        </li>
      </ul>
      <p>
        Funksjoner i Tjenesten (filtre, advarsler, avmeldingslenke) er <strong>hjelpemidler</strong>{" "}
        og fjerner ikke ditt juridiske ansvar.
      </p>

      <h2>4. Forbudt bruk</h2>
      <p>Det er forbudt å bruke Tjenesten til bl.a.:</p>
      <ul>
        <li>Ulovlig spam, phishing, malware eller svindel</li>
        <li>Trakassering, hatytringer eller diskriminerende innhold</li>
        <li>Å omgå tekniske begrensninger, sikkerhet eller rate limits</li>
        <li>Å scrape eller videreselge data fra Tjenesten uten skriftlig samtykke</li>
        <li>Å opptre som en annen person eller bedrift uten rett til det</li>
      </ul>
      <p>
        Vi kan suspendere eller slette kontoer ved mistanke om misbruk, uten forutgående varsel
        der det er nødvendig av hensyn til sikkerhet eller lov.
      </p>

      <h2>5. E-post og tredjepartstjenester</h2>
      <p>
        Når du kobler Gmail, Outlook eller annen tjeneste, gir du oss begrenset tilgang til å
        sende e-post på dine vegne i tråd med deres vilkår. Vi er ikke ansvarlige for
        avvisning, sperring eller begrensninger hos Google, Microsoft eller andre leverandører.
      </p>
      <p>
        Offentlige firmadata kan inneholde feil eller være utdatert. Du må verifisere
        opplysninger før du tar forretningsbeslutninger.
      </p>

      <h2>6. Betaling og abonnement</h2>
      <p>
        Tjenesten tilbys som månedlig abonnement (Start, Pro, Byrå) med pris og funksjoner som
        fremgår på nettsiden ved bestilling. Betaling skjer via Stripe. Abonnementet fornyes
        automatisk hver måned inntil du sier det opp via kundeportalen eller ved å kontakte oss.
      </p>
      <p>
        Ved manglende betaling, utløpt kort eller brudd på Vilkårene kan vi suspendere eller
        stenge tilgang uten forutgående varsel der det er nødvendig. Prøveperiode, hvis tilbudt,
        gjelder kun én gang per kunde med mindre annet er skriftlig avtalt.
      </p>
      <p>
        Det gis som hovedregel ikke refusjon for allerede betalte perioder du ikke har brukt,
        med mindre ufravikelig norsk forbrukerrett krever annet. Grenser for antall e-poster og
        mottakere per pakke kan endres med rimelig varsel på nettsiden; gjeldende grenser vises i
        appen under Abonnement.
      </p>

      <h2>7. Immaterielle rettigheter</h2>
      <p>
        Tjenesten, merkevare, design og programvare tilhører oss eller våre lisensgivere. Du får
        en begrenset, ikke-overførbar lisens til å bruke Tjenesten i abonnementsperioden. Du
        beholder rettigheter til egne maler og tekster du skriver.
      </p>

      <h2>8. Ansvarsfraskrivelse</h2>
      <p>
        Tjenesten leveres «<strong>som den er</strong>» og «som tilgjengelig». Vi garanterer ikke
        at Tjenesten er feilfri, uavbrutt, at du får salg, svar eller nye kunder, eller at data
        er fullstendig korrekt.
      </p>
      <p>
        I den grad lov tillater det, er vi <strong>ikke ansvarlige</strong> for indirekte tap,
        følgetap, tap av fortjeneste, goodwill, data eller forretningsmuligheter, heller ikke
        for tap som følge av:
      </p>
      <ul>
        <li>E-post du sender eller mottar via Tjenesten</li>
        <li>Klagen, bøter eller krav fra mottakere, Datatilsynet eller andre</li>
        <li>Feil i Brreg, Google-søk, SerpAPI eller andre datakilder</li>
        <li>Handlinger utført av andre brukere eller tredjeparter</li>
      </ul>
      <p>
        Vårt samlede erstatningsansvar overfor deg er, uansett grunnlag, begrenset til det høyeste
        av (a) beløpet du har betalt oss for Tjenesten de siste 12 månedene før kravet, eller (b)
        NOK 1 000. Begrensningen gjelder ikke der ansvar ikke kan begrenses etter ufravikelig
        norsk lov (f.eks. ved forsett eller grov uaktsomhet der loven krever full erstatning).
      </p>

      <h2>9. Skadesløshet (hold oss fri)</h2>
      <p>
        Du skal holde {legal.operatorName}, våre eiere, ansatte og samarbeidspartnere{" "}
        <strong>skadesløse</strong> for ethvert krav, tap, kostnad og utgift (inkludert rimelige
        advokatutgifter) som skyldes:
      </p>
      <ul>
        <li>Din bruk av Tjenesten</li>
        <li>E-post eller innhold du sender</li>
        <li>Brudd på Vilkårene eller lov</li>
        <li>Krenkelse av tredjeparts rettigheter</li>
        <li>Manglende samtykke eller ulovlig markedsføring overfor mottakere</li>
      </ul>
      <p>
        Dette gjelder også om krav rettes mot oss først; du hjelper oss da med forsvar og
        informasjon.
      </p>

      <h2>10. Personvern</h2>
      <p>
        Behandling av personopplysninger beskrives i vår{" "}
        <a href="/personvern">personvernerklæring</a>. Du er selv behandlingsansvarlig for
        opplysninger om mottakere du kontakter via Tjenesten, i den grad du bestemmer formål og
        midler.
      </p>

      <h2>11. Endringer og oppsigelse</h2>
      <p>
        Vi kan endre Tjenesten og Vilkårene. Vesentlige endringer varsles på nettsiden eller
        e-post. Du kan si opp ved å avslutte abonnement og slette konto. Vi kan avslutte
        Tjenesten med rimelig varsel.
      </p>

      <h2>12. Lovvalg og tvister</h2>
      <p>
        Vilkårene reguleres av norsk lov. Tvister søkes først løst i minnelighet. Verneting er
        Oslo tingrett, med mindre annet følger av ufravikelig lov for forbrukere.
      </p>

      <h2>13. Kontakt</h2>
      <p>
        Spørsmål om Vilkårene:{" "}
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
        {legal.orgNr && (
          <>
            <br />
            {legal.operatorName}, org.nr. {legal.orgNr}
          </>
        )}
      </p>

      <p className="text-sm text-slate-500">
        Dette dokumentet er generelt juridisk grunnlag og erstatter ikke individuell
        juridisk rådgivning. Ved behov, konsulter advokat med kompetanse på markedsføring og
        personvern.
      </p>
    </>
  );
}
