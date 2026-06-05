import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  Calculator,
  Globe,
  Layers,
  Mail,
  MapPin,
  Megaphone,
  MousePointerClick,
  Phone,
  Send,
  Server,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";

/** Forside — hero */
export const HERO = {
  eyebrow: "For deg som selger til nye firma i Norge",
  titleLine1: "Nye firma. Kontaktinfo. Klar til å ta.",
  titleLine2: "Alt i én tabell — ring eller send fra din e-post.",
  tagline:
    "NyLead henter nye firma fra Brreg, fyller inn tlf og e-post — også fra Timma, Gulesider og sosiale medier — og lar deg filtrere, prioritere og sende fra Gmail eller Outlook.",
  ctaPrimary: "Se nye firma i mitt område",
  ctaSecondary: "Opprett gratis konto",
  trustLine: "499 kr/mnd · Ingen kredittkort for å se innsiden",
};

export type HeroStep = {
  step: number;
  icon: LucideIcon;
  label: string;
  detail: string;
};

export const HERO_STEPS: HeroStep[] = [
  {
    step: 1,
    icon: Building2,
    label: "Skann",
    detail: "Nye firma i ditt område",
  },
  {
    step: 2,
    icon: Phone,
    label: "Filtrer",
    detail: "Tlf og e-post — også utenfor Brreg",
  },
  {
    step: 3,
    icon: Send,
    label: "Send",
    detail: "Fra din egen innboks",
  },
];

export const HERO_AUDIENCES = [
  "Nettside",
  "Regnskap",
  "Markedsføring",
  "IT",
  "Lokalt B2B",
] as const;

export type HeroCallout = {
  text: string;
  variant: "emerald" | "sky" | "violet" | "slate";
  className: string;
};

export const HERO_CALLOUTS: HeroCallout[] = [
  {
    text: "Tlf funnet automatisk",
    variant: "emerald",
    className: "top-[38%] left-[2%] sm:left-[4%]",
  },
  {
    text: "E-post fra flere kilder",
    variant: "sky",
    className: "top-[28%] left-[18%] sm:left-[22%]",
  },
  {
    text: "Sosiale medier med",
    variant: "violet",
    className: "top-[42%] right-[2%] sm:right-[6%]",
  },
  {
    text: "Filtrer med/uten nettside",
    variant: "slate",
    className: "bottom-[18%] left-[30%] sm:left-[34%]",
  },
];

/** Infografikk rett under hero — bilde i public/images/sec/ */
export const SOURCES_SECTION_IMAGE = "/images/sec/sec.png";

export const SOURCES_SECTION = {
  eyebrow: "Mange kilder — én oversikt",
  title: "Vi henter. Du får alt samlet.",
  subtitle:
    "Google, Facebook, Instagram, Timma, Fixit, Gulesider og nettsider — vi samler kontakt, nettside og sosiale medier i samme firma-rad. Du slipper å hoppe mellom ti faner.",
  caption: "Fra rådata til klar lead — uten ekstra verktøy.",
};

export const PLATFORM_INTRO = {
  eyebrow: "Hva du får",
  title: "Fra nytt firma i Brreg til sendt mail — på ett sted",
  subtitle:
    "Ikke enda et verktøy du må eksportere til Excel. Du skanner markedet, får kontaktinfo ferdig, filtrerer hvem du vil ta — og sender fra Gmail eller Outlook som vanlig.",
};

export type PlatformPillar = {
  id: string;
  icon: LucideIcon;
  title: string;
  lead: string;
  bullets: string[];
};

export const PLATFORM_PILLARS: PlatformPillar[] = [
  {
    id: "finn",
    icon: MapPin,
    title: "Finn riktige firma",
    lead: "Start med markedet ditt — ikke med et tilfeldig utdrag fra internett.",
    bullets: [
      "Filtrer på kommune, fylke og hvor nye registreringer er",
      "Se bare firma med e-post eller telefon — spar tid med en gang",
      "Bransje- og webbyrå-filter når du vil snevre inn",
      "Over 1 million norske firma — samme kilde som myndighetene bruker",
      "Eksporter til CSV når du vil jobbe videre et annet sted",
    ],
  },
  {
    id: "kvalifiser",
    icon: Globe,
    title: "Kontakt og Google-sjekk — ferdig i listen",
    lead: "Velg opptil 10 firma om gangen. Vi henter tlf og e-post fra Timma, Gulesider og sosiale medier — og sjekker nettside på Google.",
    bullets: [
      "Tlf og e-post også når Brreg mangler — fra booking og katalog",
      "Egen nettside, booking eller ingenting — med én gang",
      "Filter: med eller uten nettside (sterkt for webbyrå, valgfritt for andre)",
      "Facebook og Instagram i samme oversikt når vi finner det",
      "Delt skann — du betaler ikke to ganger for samme firma",
    ],
  },
  {
    id: "send",
    icon: Send,
    title: "Send som deg selv",
    lead: "Kunden svarer til deg — ikke til en noreply-adresse ingen stoler på.",
    bullets: [
      "Velg 20, 50 eller 100 firma og send én felles melding",
      "Koble Gmail, Outlook eller SMTP — det er din adresse som står på",
      "Maler du kan gjenbruke: «Gratulerer med oppstart — kan vi hjelpe?»",
      "Oppfølging på dag 3 og 7 hvis du vil det",
      "Pipeline så du ser hvem som er ny, kontaktet, svarte eller booket møte",
    ],
  },
  {
    id: "orden",
    icon: Layers,
    title: "Hold oversikt",
    lead: "Du skal vite hva du har sendt, og hvem du må ta igjen — ikke gjette i en mappe med notater.",
    bullets: [
      "Dashboard: sendt, sekvenser og pipeline på ett skjermbilde",
      "Arbeidskø: hvem du skal ta i dag — rangert etter score",
      "Historikk over kampanjer — hva gikk ut og når",
      "Daglig leder fra Brreg når det finnes",
      "Én pris. Alt inkludert. Ingen «må oppgradere for å sende».",
    ],
  },
];

export const FEATURES_SECTION = {
  eyebrow: "Under panseret",
  title: "Det du faktisk bruker i uka",
  subtitle:
    "Kontakt, filter og utsending — det du faktisk bruker når du skal nå nye firma.",
};

export const FEATURES = [
  {
    icon: Building2,
    title: "Data fra Brønnøysund",
    text: "Nye firma med e-post og telefon. Offisiell kilde — ikke et utenlandsk datasett du må tolke.",
    featured: true,
  },
  {
    icon: MapPin,
    title: "Ditt marked, ditt filter",
    text: "Kommune, fylke, dager siden registrering. Kun firma med kontaktinfo hvis du vil.",
    featured: true,
  },
  {
    icon: Globe,
    title: "Google-sjekk på listen din",
    text: "Velg opptil 10 firma om gangen. Vi henter tlf/e-post fra Timma, Gulesider og sosiale medier, sjekker nettside på Google, og viser alt i samme liste — med filter for med eller uten nettside.",
    featured: true,
  },
  {
    icon: MousePointerClick,
    title: "Velg og send",
    text: "Huk av firmaene du vil ha. Én mail til alle — med {firmanavn} satt inn automatisk.",
    featured: true,
  },
  {
    icon: Send,
    title: "Din e-post, ditt navn",
    text: "Send fra Gmail eller Outlook. Kunden svarer til deg — ikke til en felles robot-adresse.",
    featured: true,
  },
  {
    icon: Mail,
    title: "Maler du husker",
    text: "Lagre intro og oppfølging én gang. Bruk dem hver uke uten å skrive på nytt.",
    featured: false,
  },
  {
    icon: Shield,
    title: "Trygg B2B-kontakt",
    text: "post@ og info@ er greit uten samtykke. Appen sier fra hvis adressen ser personlig ut.",
    featured: false,
  },
];

export const USE_CASES = {
  eyebrow: "Hvem bruker det",
  title: "For alle som vil nå nye firma før konkurrentene",
  items: [
    {
      icon: Calculator,
      title: "Regnskap og rådgivning",
      text: "Nye AS trenger regnskapsfører. Finn dem i ditt fylke med tlf og e-post ferdig — ring eller send før noen andre.",
    },
    {
      icon: Megaphone,
      title: "Markedsføring og SEO",
      text: "Nye firma trenger synlighet. Skann, prioriter med arbeidskø, og send fra din egen innboks.",
    },
    {
      icon: Server,
      title: "IT og drift",
      text: "Nyoppstartede mangler ofte systemer og support. Få kontaktinfo og daglig leder i samme oversikt.",
    },
    {
      icon: BarChart3,
      title: "Lokalt B2B",
      text: "Velg kommune eller fylke, filtrer på kontaktinfo, og få en liste du faktisk kan ringe på denne uka.",
    },
    {
      icon: Sparkles,
      title: "Webbyrå og design",
      text: "Google-sjekk viser hvem som mangler ordentlig side. Filtrer til «uten nettside» — eller bruk webbyrå-filter i Brreg.",
    },
    {
      icon: Target,
      title: "Frilanser",
      text: "Du trenger ikke dyrt Proff-abonnement og timer med research. Skann, velg 20 firma, send — ferdig for uka.",
    },
  ],
};

export const WORKFLOW_INTRO = {
  title: "Slik en vanlig uke ser ut",
  subtitle:
    "Fire steg. Ingen magi — bare mindre friksjon mellom Brreg, Google og innboksen din.",
};

export const COMPARISON = {
  eyebrow: "Hvorfor NyLead",
  title: "Mindre styr, mer salg",
  subtitle:
    "Du kan fortsatt bruke Proff, Excel og manuell research. Mange gjør det — til de oppdager hvor mye tid som forsvinner på det som kan automatiseres.",
  points: [
    {
      title: "Norsk fra grunnen av",
      text: "Brønnøysundregistrene — ikke et utenlandsk register du må oversette.",
    },
    {
      title: "Kontakt og Google innebygd",
      text: "Ikke manuelt Proff + Google per firma. Tlf og e-post fra flere kilder, nettside-sjekk på 10 om gangen, og Facebook/Instagram i samme liste.",
    },
    {
      title: "Én regning",
      text: "Pipeline, sekvenser, skann og utsending. Du kjøper ikke fem tillegg for å komme i gang.",
    },
  ],
};

export const INTEGRATIONS = {
  eyebrow: "Koblinger og regler",
  title: "Det du allerede bruker — pluss det norske regelverket",
  items: [
    "Brønnøysundregistrene (offisiell kilde)",
    "Gmail og Microsoft Outlook",
    "SMTP / app-passord for andre leverandører",
    "CSV-eksport av lister",
    "B2B: generelle adresser uten samtykke",
    "Avmeldingslenke i utsendelser",
  ],
};

export const FAQ_SECTION = {
  title: "Spørsmål folk stiller før de betaler",
  subtitle:
    "Ærlige svar — ikke salgsprat. Hvis du lurer på noe som ikke står her, send oss en mail.",
};

export const FAQ_ITEMS = [
  {
    q: "Hva er NyLead — og hvem passer det for?",
    a: "For alle som selger til nye firma i Norge — regnskap, markedsføring, IT, lokale tjenester, webbyrå og mer. Du finner nye registreringer i Brreg, får kontaktinfo ferdig, og ringer eller sender fra din egen e-post.",
  },
  {
    q: "Hvor kommer telefonnummer fra hvis Brreg mangler?",
    a: "Vi henter fra offentlige sider Google allerede fant — Timma, Fixit, Gulesider, 1881, egen nettside og sosiale medier (Facebook/Instagram via profil-data). Alt lagres delt, så du slipper å sjekke samme firma to ganger.",
  },
  {
    q: "Hvor kommer firmadataene fra?",
    a: "Brønnøysundregistrene. Samme kilde som norske myndigheter. Vi oppdaterer når nye firma registreres.",
  },
  {
    q: "Hvordan funker Google-sjekken?",
    a: "Velg firma i listen og trykk Google-sjekk — maks 10 om gangen. Vi søker på Google og viser om de har egen nettside, bare booking (Timma/Fixit), eller ingenting tydelig. Facebook og Instagram kommer med i samme oversikt. Etterpå kan du filtrere til «kun uten nettside» — smart når du selger nettsider.",
  },
  {
    q: "Kan jeg filtrere til firma uten nettside?",
    a: "Ja. Etter Google-sjekk velger du «Kun uten nettside» i filteret. Da ser du bare firma uten egen side — inkludert de som bare har Timma eller Fixit. Akkurat det du trenger når du skal selge nettsider.",
  },
  {
    q: "Er det lovlig å sende e-post til nye firma?",
    a: "Til generelle adresser som post@ og info@ er det normalt greit i B2B uten samtykke. Personlige adresser krever samtykke — vi advarer og stopper deg fra å sende dit som standard.",
  },
  {
    q: "Sender jeg fra NyLead sin server?",
    a: "Nei. Du kobler Gmail, Outlook eller SMTP. Kunden svarer til deg — som en vanlig mail du har skrevet selv.",
  },
  {
    q: "Hva får jeg for 499 kr per måned?",
    a: "Full tilgang: skann, nettside-sjekk, opptil 250 firma med kontakt per måned, pipeline, sekvenser, maler og utsending. Ingen moduler du må låse opp.",
  },
  {
    q: "Kan jeg filtrere på bransje og sted?",
    a: "Ja. Kommune, fylke, hvor nye firma er, bransje, og om de har e-post. Vi har også filter som passer webbyrå-salg.",
  },
  {
    q: "Hva om jeg allerede bruker Proff?",
    a: "Mange starter der. NyLead erstatter ikke Proff for alt — men for nyregistrerte firma med nettside-sjekk og utsending sparer du mye tid. Brreg-delen er gratis for deg.",
  },
];

export const TRUST = [
  "Nye firma fra Brreg hver uke",
  "Tlf fra Timma, Fixit og Gulesider",
  "Facebook og Instagram med i listen",
  "Send fra din egen innboks",
  "Pipeline og arbeidskø inkludert",
  "Lovlig B2B-kontakt",
];

export const ROI_CALCULATOR = {
  eyebrow: "Regn på det",
  title: "Hva koster det å finne leads manuelt?",
  subtitle:
    "De fleste bruker et par timer i uka på Proff og Google — pluss tid per firma. Dra på sliderne og se omtrentlig forskjell. Tallene er estimater, ikke garanti.",
  manualMinutesPerLead: 27,
  nyleadMinutesPerLead: 4,
  weeksPerMonth: 4.33,
  nyleadResearchHoursPerWeek: 0.5,
  planPriceNok: 499,
  sliders: {
    researchHours: {
      label: "Timer per uke du bruker på research i dag",
      min: 0,
      max: 20,
      step: 1,
      default: 6,
    },
    hourlyRate: {
      label: "Hva er timen din verdt? (kr)",
      min: 300,
      max: 2000,
      step: 50,
      default: 850,
    },
    leadsPerMonth: {
      label: "Hvor mange firma vil du kontakte per måned",
      min: 10,
      max: 250,
      step: 10,
      default: 80,
    },
    proffSubscription: {
      label: "Betaler du for Proff i dag (kr/mnd)",
      min: 0,
      max: 999,
      step: 49,
      default: 499,
      hint: "Sett 0 hvis du ikke bruker Proff. Mange dropper det når Brreg-skann er nok.",
    },
  },
  comparison: {
    manual: {
      title: "Som i dag",
      subtitle: "Proff, Google, Excel, en og en mail",
    },
    nylead: {
      title: "Med NyLead",
      subtitle: "Skann, sjekk, send — i samme verktøy",
    },
  },
  formula: {
    title: "Slik regner vi",
    paragraphs: [
      "Dette er et grovt estimat — juster sliderne etter din egen hverdag.",
      "Manuelt regner vi ca. 27 minutter per firma: finne i Proff/Brreg, Google-sjekk, kopiere kontakt, skrive mail.",
      "Med NyLead regner vi ca. 4 minutter per firma: velge fra liste, se ferdig nettside-sjekk, sende med mal.",
      "Vi legger research-tid (timer × uker) oppå det. NyLead koster 499 kr/mnd på toppen.",
      "Besparelse = forskjellen. ROI viser hvor mange ganger abonnementet «betaler seg» i løpet av en måned.",
    ],
  },
  cta: {
    primary: "Prøv en uke",
    secondary: "Se hvordan det ser ut inne",
  },
};

export const WORKFLOW_DETAILED = [
  {
    step: 1,
    title: "Velg marked",
    description:
      "Kommune eller fylke, hvor nye firma skal være, og om du bare vil ha de med e-post. Bransje-filter når du vil snevre inn — webbyrå-filter for de som selger nettsider.",
  },
  {
    step: 2,
    title: "Skann og sjekk",
    description:
      "Huk av firmaene i listen (maks 10 om gangen). Google-sjekken kjører — du ser med én gang: egen nettside, bare booking, eller ingenting. Facebook og Instagram vises i samme oversikt. Filtrer til «uten nettside» hvis det er det du jakter på.",
  },
  {
    step: 3,
    title: "Velg hvem du tar",
    description:
      "Huk av i listen, eller bruk arbeidskøen som sorterer de beste først. Du ser status hele veien: ny, kontaktet, svar, møte.",
  },
  {
    step: 4,
    title: "Send og følg opp",
    description:
      "Én mal med {firmanavn}, send til alle du valgte — fra din Gmail eller Outlook. Vil du, tar sekvensen over på dag 3 og 7.",
  },
];
