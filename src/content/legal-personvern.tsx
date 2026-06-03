import { legal } from "@/lib/legal";

export function PersonvernContent() {
  return (
    <>
      <p>
        Denne personvernerklæringen forklarer hvordan {legal.operatorName} («vi») behandler
        personopplysninger når du bruker {legal.productName} («Tjenesten»), og hvilke roller
        du og vi har når du kontakter andre via plattformen.
      </p>

      <h2>1. Behandlingsansvarlig</h2>
      <p>
        For opplysninger om <strong>din brukerkonto</strong> og drift av nettsiden er
        behandlingsansvarlig:
      </p>
      <ul>
        <li>
          <strong>{legal.operatorName}</strong>
          {legal.orgNr && <> · Org.nr {legal.orgNr}</>}
        </li>
        <li>{legal.address}</li>
        <li>
          E-post: <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
        </li>
      </ul>
      <p>
        Når <strong>du</strong> sender markedsførings-e-post til firma via Tjenesten, er du
        normalt selv behandlingsansvarlig for opplysninger om mottakere (du bestemmer hvem du
        kontakter og hvorfor). Vi opptrer da som <strong>databehandler</strong> for den delen av
        behandlingen som skjer i vår plattform (lagring, teknisk utsendelse), i den grad
        databehandleravtale kreves etter GDPR art. 28.
      </p>

      <h2>2. Hvilke opplysninger vi behandler</h2>

      <h3>2.1 Konto og bruk</h3>
      <ul>
        <li>E-postadresse, passord (kryptert hos Supabase Auth), firmanavn du oppgir</li>
        <li>Innstillinger, maler, kampanjelogger, pipeline-status</li>
        <li>Tekniske logger (IP, nettleser, tidspunkt) via hosting</li>
      </ul>

      <h3>2.2 E-postkobling (Gmail/Outlook)</h3>
      <p>
        Hvis du kobler e-post, lagrer vi krypterte OAuth-tokens og din tilkoblede
        e-postadresse slik at vi kan sende på dine vegne. Vi leser ikke innboksen din utover det
        som er nødvendig for å sende og vedlikeholde tilkoblingen.
      </p>

      <h3>2.3 Firmadata fra offentlige kilder</h3>
      <p>
        Vi henter og viser data fra Brønnøysundregistrene og lignende offentlige kilder (firmanavn,
        org.nr, adresse, næringskode, ofte generell e-post/telefon). Dette er i utgangspunktet
        opplysninger om foretak, men kan i noen tilfeller identifisere enkeltpersoner (f.eks.
        enkeltpersonforetak).
      </p>

      <h3>2.4 Avmeldinger</h3>
      <p>
        E-postadresser som melder seg av via vår avmeldingslenke lagres i en sperreliste så de
        ikke kontaktes igjen via Tjenesten.
      </p>

      <h3>2.5 Mottakere av din e-post</h3>
      <p>
        Når du sender kampanjer, behandles mottakers e-post og firmanavn for utsendelse og
        logging. Du må kun sende til adresser du har lovlig grunnlag til å kontakte.
      </p>

      <h3>2.6 Informasjonskapsler</h3>
      <p>
        Vi bruker kun nødvendige informasjonskapsler for innlogging (Supabase Auth). Vi bruker
        ikke sporings- eller analyse-informasjonskapsler. Noen innstillinger lagres i
        nettleserens localStorage (f.eks. filtervalg), ikke som informasjonskapsler.
      </p>

      <h2>3. Formål og rettslig grunnlag (GDPR art. 6)</h2>
      <ul>
        <li>
          <strong>Levere Tjenesten</strong> — avtale (art. 6(1)(b))
        </li>
        <li>
          <strong>Sikkerhet, feilsøking, misbruksforebygging</strong> — berettiget interesse (art.
          6(1)(f))
        </li>
        <li>
          <strong>Oppfylle lovkrav</strong> — rettslig forpliktelse (art. 6(1)(c))
        </li>
        <li>
          <strong>Markedsføring til deg som kunde</strong> — berettiget interesse eller samtykke
          der det kreves
        </li>
      </ul>
      <p>
        Din markedsføring til tredjeparter må du selv ha grunnlag for (ofte berettiget interesse
        for B2B til generelle adresser, eller samtykke for personlige adresser).
      </p>

      <h2>4. Deling og databehandlere</h2>
      <p>Vi bruker leverandører som kan behandle data på våre vegne, bl.a.:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — database og innlogging (kan lagres i EU/EØS avhengig av
          prosjektregion)
        </li>
        <li>
          <strong>Vercel</strong> — hosting av nettsiden
        </li>
        <li>
          <strong>Google / Microsoft</strong> — når du kobler Gmail eller Outlook
        </li>
        <li>
          <strong>SerpAPI / Google Custom Search</strong> — nettside-skanning, hvis aktivert
        </li>
        <li>
          <strong>Resend</strong> — kun hvis fallback-e-post er konfigurert
        </li>
      </ul>
      <p>
        Vi selger ikke personopplysninger. Vi deler ikke data med tredjeparter for deres
        markedsføring uten ditt samtykke.
      </p>

      <h2>5. Lagringstid</h2>
      <ul>
        <li>Kontodata: så lenge kontoen er aktiv + inntil 24 måneder etter sletting</li>
        <li>Kampanjelogger: inntil 36 måneder, med mindre lengre lagring kreves av lov</li>
        <li>Avmeldinger: inntil du ber om sletting eller de ikke lenger er nødvendige</li>
        <li>OAuth-tokens: slettes når du kobler fra eller sletter konto</li>
      </ul>

      <h2>6. Dine rettigheter</h2>
      <p>Du har rett til innsyn, retting, sletting, begrensning, dataportabilitet og å protestere
        der det gjelder dine egne opplysninger hos oss. Kontakt{" "}
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>. Du kan klage til{" "}
        <a href="https://www.datatilsynet.no" target="_blank" rel="noopener noreferrer">
          Datatilsynet
        </a>
        .
      </p>
      <p>
        Mottakere du har kontaktet via Tjenesten må henvende seg til deg (som behandlingsansvarlig)
        for sine rettigheter, med mindre vi er behandlingsansvarlig for den konkrete behandlingen.
      </p>

      <h2>7. Sikkerhet</h2>
      <p>
        Vi bruker HTTPS, tilgangskontroll, krypterte tokens der det er hensiktsmessig, og
        begrenset tilgang internt. Ingen metode er 100 % sikker; du må også beskytte passordet
        ditt.
      </p>

      <h2>8. Overføring utenfor EØS</h2>
      <p>
        Noen leverandører (f.eks. USA-baserte) kan behandle data utenfor EØS. Da støtter vi oss på
        Standard Contractual Clauses eller andre gyldige overføringsgrunnlag der leverandøren
        tilbyr det.
      </p>

      <h2>9. Barn</h2>
      <p>Tjenesten er ikke rettet mot barn under 18 år.</p>

      <h2>10. Endringer</h2>
      <p>
        Vi kan oppdatere erklæringen. Vesentlige endringer varsles på nettsiden. Sist oppdatert:{" "}
        {legal.lastUpdated}.
      </p>

      <h2>11. Vilkår</h2>
      <p>
        Bruk av Tjenesten reguleres også av våre <a href="/vilkar">vilkår for bruk</a>, inkludert
        ansvarsfraskrivelse ved misbruk.
      </p>
    </>
  );
}
