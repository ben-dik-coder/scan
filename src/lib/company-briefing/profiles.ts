export type VerticalProfile = {
  id: string;
  label: string;
  /** Kort «de driver med …» */
  does: string;
  /** Typiske behov — tips (ikke alltid målbare) */
  tipNeeds: Array<{ id: string; label: string; why: string }>;
};

/**
 * Bransjeprofiler for salgssamtale — ikke maltekst til kunden,
 * men hva selgeren trenger å se på firmaet.
 */
export const VERTICAL_PROFILES: Record<string, VerticalProfile> = {
  frisor: {
    id: "frisor",
    label: "Frisør",
    does: "Klipp, styling og salongtjenester for privatpersoner.",
    tipNeeds: [
      {
        id: "booking",
        label: "Enkel timebestilling online",
        why: "Mange mister kunder som ikke vil ringe.",
      },
      {
        id: "gbp",
        label: "Google-bedriftsprofil på stell",
        why: "Folk søker «frisør nær meg» før de booker.",
      },
      {
        id: "photos",
        label: "Ferske bilder av arbeid / salong",
        why: "Tillit bygges visuelt i denne bransjen.",
      },
    ],
  },
  skjonnhet: {
    id: "skjonnhet",
    label: "Skjønnhet / spa",
    does: "Behandlinger, hudpleie, spa eller lignende skjønnhetstjenester.",
    tipNeeds: [
      {
        id: "booking",
        label: "Online booking / prisliste",
        why: "Kunder sammenligner raskt før de tar kontakt.",
      },
      {
        id: "gbp",
        label: "Synlig på Google Maps",
        why: "Lokale søk er hovedkanalen.",
      },
      {
        id: "ig",
        label: "Aktiv Instagram",
        why: "Før/etter og atmosfære selger behandlinger.",
      },
    ],
  },
  bygg: {
    id: "bygg",
    label: "Bygg og håndverk",
    does: "Bygg, rehabilitering eller håndverkstjenester (f.eks. snekker, VVS, elektro).",
    tipNeeds: [
      {
        id: "portfolio",
        label: "Prosjektbilder / referanser online",
        why: "Folk vil se at dere har gjort liknende jobb.",
      },
      {
        id: "quote",
        label: "Enkel måte å be om tilbud",
        why: "Uten skjema eller tydelig telefon mister dere forespørsler.",
      },
      {
        id: "gbp",
        label: "Lokal synlighet på Google",
        why: "Mange søker håndverker i nærområdet.",
      },
    ],
  },
  servering: {
    id: "servering",
    label: "Servering / overnatting",
    does: "Restaurant, kafé, catering eller overnatting.",
    tipNeeds: [
      {
        id: "meny",
        label: "Oppdatert meny / åpningstider online",
        why: "Gjester sjekker før de kommer.",
      },
      {
        id: "gbp",
        label: "Google-anmeldelser og kart",
        why: "Avgjør ofte hvor folk spiser.",
      },
      {
        id: "booking",
        label: "Bordbestilling eller takeaway-lenke",
        why: "Reduserer tomme bord og mistet omsetning.",
      },
    ],
  },
  handel: {
    id: "handel",
    label: "Handel / butikk",
    does: "Detaljhandel — fysisk butikk og/eller salg av varer.",
    tipNeeds: [
      {
        id: "hours",
        label: "Åpningstider og sted tydelig online",
        why: "Folk dropper butikker de ikke finner info om.",
      },
      {
        id: "social",
        label: "Sosiale medier med tilbud / nyheter",
        why: "Lokale kunder følger butikker de liker.",
      },
      {
        id: "webshop_or_pickup",
        label: "Enkel nettside eller klikk-og-hent",
        why: "Mange forventer å kunne sjekke sortiment før de drar.",
      },
    ],
  },
  helse: {
    id: "helse",
    label: "Helse og omsorg",
    does: "Helse-, omsorgs- eller velferdstjenester.",
    tipNeeds: [
      {
        id: "trust",
        label: "Tydelig info om tjenester og kontakt",
        why: "Tillit og enkel booking/henvendelse er kritisk.",
      },
      {
        id: "gbp",
        label: "Finnbar på Google",
        why: "Pasienter/brukere søker lokalt først.",
      },
    ],
  },
  it: {
    id: "it",
    label: "IT / konsulent",
    does: "IT, rådgivning eller digitale tjenester til bedrifter.",
    tipNeeds: [
      {
        id: "cases",
        label: "Case / hva dere faktisk leverer",
        why: "Vage IT-sider konverterer dårlig.",
      },
      {
        id: "cta",
        label: "Klar kontakt / møte-CTA",
        why: "Kjøpere vil booke prat uten å lete.",
      },
    ],
  },
  webbyra: {
    id: "webbyra",
    label: "Web / digitalbyrå",
    does: "Lager eller forbedrer nettsider og digital synlighet for andre.",
    tipNeeds: [
      {
        id: "proof",
        label: "Portefølje av kundnettsider",
        why: "Dere selger tillit — må vise resultat.",
      },
      {
        id: "niche",
        label: "Tydelig hvem dere hjelper",
        why: "Generiske byrå-sider mister leads.",
      },
    ],
  },
  marked: {
    id: "marked",
    label: "Reklame / markedsføring",
    does: "Markedsføring, reklame eller synlighet for kunder.",
    tipNeeds: [
      {
        id: "proof",
        label: "Eksempler på kampanjer / resultater",
        why: "Kjøpere vil se bevis før de ringer.",
      },
      {
        id: "cta",
        label: "Enkel «ta kontakt»-vei",
        why: "Ellers stopper interessen etter første inntrykk.",
      },
    ],
  },
  reklame: {
    id: "reklame",
    label: "Reklame / design",
    does: "Reklame, design eller kommunikasjonsarbeid.",
    tipNeeds: [
      {
        id: "portfolio",
        label: "Visuell portefølje",
        why: "Design kjøpes med øynene.",
      },
      {
        id: "cta",
        label: "Tydelig neste steg for nye kunder",
        why: "Uten CTA blir det bare «fint, men …».",
      },
    ],
  },
  transport: {
    id: "transport",
    label: "Transport / logistikk",
    does: "Transport, frakt eller logistikktjenester.",
    tipNeeds: [
      {
        id: "quote",
        label: "Enkel forespørsel / tilbud",
        why: "Bedriftskunder vil sende jobb raskt.",
      },
      {
        id: "areas",
        label: "Tydelig dekningsområde",
        why: "Unngår feil leads og misforståelser.",
      },
    ],
  },
  eiendom: {
    id: "eiendom",
    label: "Eiendom",
    does: "Eiendom, megling eller utleie.",
    tipNeeds: [
      {
        id: "listings",
        label: "Oppdaterte objekter online",
        why: "Kjøpere starter nesten alltid på nett.",
      },
      {
        id: "trust",
        label: "Tillitssignaler (team, kontakt, omtale)",
        why: "Store beslutninger krever trygghet.",
      },
    ],
  },
  radgivning: {
    id: "radgivning",
    label: "Rådgivning / regnskap",
    does: "Regnskap, juss eller bedriftsrådgivning.",
    tipNeeds: [
      {
        id: "services",
        label: "Klare tjenester og hvem det passer for",
        why: "Folk vil vite om dere tar «slike som meg».",
      },
      {
        id: "cta",
        label: "Enkel booking av intro-samtale",
        why: "Senker terskelen for første kontakt.",
      },
    ],
  },
  generic: {
    id: "generic",
    label: "Bedrift",
    does: "Lokal bedrift — se næringskode og navn for mer detalj.",
    tipNeeds: [
      {
        id: "findable",
        label: "Lett å finne når noen googler dem",
        why: "Uten synlighet mister de forespørsler til konkurrenter.",
      },
      {
        id: "contact",
        label: "Tydelig telefon / e-post / skjema",
        why: "Interessenter gir opp hvis kontakt er uklar.",
      },
    ],
  },
};

/** Mer spesifikke treff først */
export const VERTICAL_MATCH_ORDER = [
  "webbyra",
  "frisor",
  "skjonnhet",
  "reklame",
  "marked",
  "bygg",
  "servering",
  "handel",
  "helse",
  "transport",
  "eiendom",
  "radgivning",
  "it",
] as const;
