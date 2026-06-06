import Link from "next/link";
import { legal } from "@/lib/legal";
import { support } from "@/lib/support";
import { site } from "@/lib/site";

export function OmOssContent() {
  return (
    <>
      <p>
        {legal.productName} er et verktøy for å finne og kontakte nye bedrifter i Norge — særlig
        for deg som selger nettsider, design og lignende tjenester. Tjenesten eies og drives av{" "}
        <strong>{legal.operatorName}</strong>.
      </p>

      <h2>Hvorfor finnes {site.name}?</h2>
      <p>
        Hver uke starter tusenvis av nye firma i Norge. Mange trenger nettside, logo eller hjelp
        med å bli synlige — men det er vanskelig å finne dem før konkurrentene gjør det.
      </p>
      <p>
        I dag må mange sitte manuelt på Proff, kopiere fra Excel og sende e-post én og én. Det
        tar tid, og data fra Brønnøysund er gratis — du trenger ikke et dyrt abonnement for å
        komme i gang.
      </p>
      <p>
        Vi laget {site.name} for å gjøre det enklere: skann markedet ditt, velg firma med e-post,
        sjekk om de har nettside, og send tilbud fra din egen Gmail eller Outlook. Raskere vei
        fra «nytt firma i Brreg» til «tilbud sendt».
      </p>

      <h2>Hvem er det for?</h2>
      <p>{site.audience} — altså folk som aktivt leter etter nye kunder og vil bruke mindre tid
        på research og mer tid på det de er gode på.</p>

      <h2>Hva gjør vi — og hva gjør vi ikke?</h2>
      <p>
        {site.name} henter offentlig firmadata fra Brønnøysundregistrene, lar deg filtrere på
        kommune og dato, og hjelper deg med utsendelse og maler. Med Pro sender du fra din egen
        e-postkonto, så kunden svarer til deg — ikke til en robot.
      </p>
      <p>
        Vi er en <strong>teknisk plattform</strong>. Vi er ikke et byrå, selger ikke nettsider
        på vegne av deg, og garanterer ikke salg. Du er selv ansvarlig for at markedsføringen din
        følger norsk lov — vi bygger inn advarsler og verktøy som hjelper, men ansvaret ligger
        hos deg.
      </p>

      <h2>Kontakt</h2>
      <p>
        Kundestøtte:{" "}
        <a href={`mailto:${support.email}`}>{support.email}</a>
        {" · "}
        <a href={`tel:${support.phoneE164}`}>{support.phoneDisplay}</a>
        {" "}({support.phoneHoursLabel.toLowerCase()}, {support.emailResponseLabel.toLowerCase()}).
      </p>
      <p>
        Formelle henvendelser om {legal.operatorName}:{" "}
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>.{" "}
        <Link href="/hjelp">Se hjelpesiden</Link> for mer.
      </p>
      <p>
        Les mer om hvordan vi behandler data i{" "}
        <Link href="/personvern">personvernerklæringen</Link> og{" "}
        <Link href="/vilkar">vilkårene for bruk</Link>.
      </p>
    </>
  );
}
