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
  eyebrow: "For deg som vil selge til nye firma i Norge",
  titleLine1: "Finn nye kunder",
  titleLine2: "før konkurrentene",
  tagline:
    "NyLead finner nye firma, kontaktinfo og tydelige kjøpssignaler på ett sted. Du ser hvem du bør kontakte, hvorfor akkurat nå, og kan ringe eller sende fra din egen innboks.",
  ctaPrimary: "Finn kunder i mitt område",
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
    detail: "Nye firma der du selger",
  },
  {
    step: 2,
    icon: Phone,
    label: "Filtrer",
    detail: "Telefon, e-post og behov",
  },
  {
    step: 3,
    icon: Send,
    label: "Følg opp",
    detail: "Ring, send og hold kontroll",
  },
];

export const HERO_AUDIENCES = [
  "Nettside",
  "Regnskap",
  "Markedsføring",
  "IT",
  "Lokalt B2B",
] as const;

/** Infografikk rett under hero — bilde i public/images/sec/ */
export const SOURCES_SECTION_IMAGE = "/images/sec/sec.png";

export const SOURCES_SECTION = {
  eyebrow: "Dataen ryddes for deg",
  title: "Vi finner bitene. Du får en ferdig lead.",
  subtitle:
    "NyLead starter med nye firma fra Brønnøysund. Så sjekker vi åpne kilder som Google, nettsider, Gulesider, Timma, Fixit og sosiale profiler for å finne telefon, e-post, nettside og tegn på hva firmaet kan trenge.",
  caption: "Fra nytt firma til ryddig kontaktkort du faktisk kan bruke.",
};

export const PLATFORM_INTRO = {
  eyebrow: "Dette gjør produktet",
  title: "NyLead viser hvem du bør kontakte, hva du kan si, og hva som skjer etterpå",
  subtitle:
    "Du slipper å lete i Brreg, Google, Gulesider og Excel selv. Skann markedet, få en liste, filtrer bort støyen, lagre de beste, kontakt dem, og følg opp uten å miste tråden.",
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
    title: "Finn firma som nettopp dukket opp",
    lead: "Nye bedrifter tar valg tidlig. Regnskap, nettside, markedsføring, IT og leverandører skal ofte på plass fort.",
    bullets: [
      "Skann nye firma i kommunen eller fylket du selger i",
      "Finn selskaper mens de fortsatt er i startfasen",
      "Filtrer på sted, bransje og om vi har kontaktinfo",
      "Bruk Brønnøysund som startpunkt, ikke tilfeldige lister",
      "Eksporter til CSV hvis du vil jobbe videre et annet sted",
    ],
  },
  {
    id: "kvalifiser",
    icon: Globe,
    title: "Se hvorfor de kan være verdt å kontakte",
    lead: "Kontaktinfo alene er ikke nok. NyLead hjelper deg å se om firmaet har nettside, booking, sosiale profiler og andre enkle tegn på hva de kan trenge.",
    bullets: [
      "Telefon og e-post når vi finner det i åpne kilder",
      "Nettside, bookingløsning eller ingen tydelig side",
      "Facebook og Instagram i samme oversikt når det finnes",
      "Filtrer til firma som passer det du selger",
      "Delt skann, så samme firma ikke må sjekkes om og om igjen",
    ],
  },
  {
    id: "send",
    icon: Send,
    title: "Kontakt dem uten klipp og lim",
    lead: "Når du har valgt firmaene, kan du sende fra din egen Gmail eller Outlook. Det ser ut som en vanlig e-post fra deg.",
    bullets: [
      "Velg firmaene du vil ta nå",
      "Send fra Gmail, Outlook eller SMTP med ditt navn som avsender",
      "Bruk maler med firmanavn satt inn automatisk",
      "Lag oppfølging over flere dager hvis de ikke svarer",
      "Se hvem som er ny, kontaktet, svarte eller bør ringes igjen",
    ],
  },
  {
    id: "orden",
    icon: Layers,
    title: "Hold kontroll på oppfølgingen",
    lead: "Den første meldingen er sjelden nok. NyLead viser hvem du har kontaktet, hvem som svarte, og hvem du bør ta igjen.",
    bullets: [
      "Arbeidskø med firma du bør se på i dag",
      "Pipeline for ny, kontaktet, svar og møte",
      "Historikk over hva du sendte og når",
      "Daglig leder fra Brreg når det finnes",
      "Én pris. Skann, kontakt og oppfølging er inkludert.",
    ],
  },
];

export const FEATURES_SECTION = {
  eyebrow: "Det viktigste",
  title: "Verktøyene du bruker når du skal få nye kunder",
  subtitle:
    "Ingen tung CRM-prat. Dette er listen, filteret, kontakten og oppfølgingen du trenger for å gjøre jobben.",
};

export const FEATURES = [
  {
    icon: Building2,
    title: "Nye firma fra Brønnøysund",
    text: "Start med firma som faktisk er registrert i Norge. Nye selskaper, riktig sted, riktig tidspunkt.",
    featured: true,
  },
  {
    icon: MapPin,
    title: "Finn ditt marked",
    text: "Velg kommune, fylke, bransje og alder på firma. Se bare firma med kontaktinfo hvis du vil jobbe raskt.",
    featured: true,
  },
  {
    icon: Globe,
    title: "Sjekk behov før du tar kontakt",
    text: "NyLead kan sjekke nettside, booking og sosiale profiler. Da ser du om firmaet virker relevant før du bruker tid på det.",
    featured: true,
  },
  {
    icon: MousePointerClick,
    title: "Lagre de beste",
    text: "Huk av firmaene som passer. Legg dem i arbeidskø eller pipeline, så du vet hvem du skal ta neste.",
    featured: true,
  },
  {
    icon: Send,
    title: "Send fra din egen e-post",
    text: "Koble Gmail eller Outlook. Kunden svarer til deg, ikke til en ukjent robot-adresse.",
    featured: true,
  },
  {
    icon: Mail,
    title: "Maler som høres menneskelige ut",
    text: "Skriv en enkel intro og oppfølging. Bruk den igjen uten å starte på blank side hver uke.",
    featured: false,
  },
  {
    icon: Shield,
    title: "Trygg B2B-kontakt",
    text: "Generelle firmaadresser kan ofte brukes i B2B. Appen hjelper deg å være forsiktig med personlige adresser.",
    featured: false,
  },
];

export const USE_CASES = {
  eyebrow: "Hvem bruker det",
  title: "For folk som lever av å ta kontakt først",
  items: [
    {
      icon: Calculator,
      title: "Regnskap og rådgivning",
      text: "Nye AS må få orden på regnskap og rutiner. Finn dem i ditt område, se kontaktinfo, og ta en varm nok første prat.",
    },
    {
      icon: Megaphone,
      title: "Markedsføring og SEO",
      text: "Nye firma trenger kunder selv. Bruk NyLead til å finne hvem som nettopp startet, og foreslå konkret hjelp.",
    },
    {
      icon: Server,
      title: "IT og drift",
      text: "Mange nye firma trenger e-post, systemer, support og enkel IT-hjelp. Få oversikten før de rekker å velge noen andre.",
    },
    {
      icon: BarChart3,
      title: "Lokalt B2B",
      text: "Velg kommune eller fylke, filtrer på kontaktinfo, og få en liste du faktisk kan ringe på denne uka.",
    },
    {
      icon: Sparkles,
      title: "Webbyrå og design",
      text: "Se hvem som mangler tydelig nettside, bare har booking, eller virker uferdig på nett. Da blir første melding mer relevant.",
    },
    {
      icon: Target,
      title: "Frilanser",
      text: "Du trenger ikke bruke kvelden på manuell research. Skann, velg noen gode firma, kontakt dem, og følg opp ryddig.",
    },
  ],
};

export const WORKFLOW_INTRO = {
  title: "Slik går du fra marked til oppfølging",
  subtitle:
    "Skann markedet, få en liste, filtrer, lagre, kontakt og følg opp. Enkelt, men gjort skikkelig.",
};

export const COMPARISON = {
  eyebrow: "Hvorfor NyLead",
  title: "Slutt å bruke halve salgsdagen på å lete",
  subtitle:
    "Du kan finne firma manuelt i Brreg, Google og Excel. NyLead gjør den jobben raskere og samler alt der du faktisk følger opp.",
  points: [
    {
      title: "Norsk fra grunnen av",
      text: "NyLead er laget for norske firma, norske steder og norske selgere. Ikke et utenlandsk datasett du må rydde selv.",
    },
    {
      title: "Kontakt og signaler samlet",
      text: "Telefon, e-post, nettside, booking og sosiale profiler vises i samme liste når vi finner det i åpne kilder.",
    },
    {
      title: "Fra liste til handling",
      text: "Det stopper ikke ved en firmaliste. Du kan lagre, sende, ringe, følge opp og se status på samme sted.",
    },
  ],
};

export const INTEGRATIONS = {
  eyebrow: "Koblinger og regler",
  title: "Bruk kilder folk kjenner, og send fra e-posten din",
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
  title: "Spørsmål folk spør før de prøver",
  subtitle:
    "Korte, ærlige svar. Ingen magi, ingen lovnad om garanterte salg.",
};

export const FAQ_ITEMS = [
  {
    q: "Hva er NyLead — og hvem passer det for?",
    a: "NyLead er for deg som selger til bedrifter i Norge. Det finner nye firma, samler kontaktinfo og hjelper deg å se hvem som er verdt å kontakte nå. Passer for regnskap, markedsføring, IT, webbyrå, rådgivere og lokale B2B-tjenester.",
  },
  {
    q: "Hvor kommer telefonnummer fra hvis Brreg mangler?",
    a: "Vi kan hente fra åpne kilder som Google finner, for eksempel egen nettside, Gulesider, 1881, Timma, Fixit og sosiale profiler. Vi viser det vi finner, og gjør det tydelig hvor kontakten kommer fra.",
  },
  {
    q: "Hvor kommer firmadataene fra?",
    a: "Brønnøysundregistrene. Samme kilde som norske myndigheter. Vi oppdaterer når nye firma registreres.",
  },
  {
    q: "Hvordan funker Google-sjekken?",
    a: "Velg firma i listen og trykk Google-sjekk. NyLead søker etter åpne spor på nett og viser om firmaet har egen nettside, bookingløsning, sosiale profiler eller ingenting tydelig. Da vet du mer før du tar kontakt.",
  },
  {
    q: "Kan jeg filtrere til firma uten nettside?",
    a: "Ja. Etter Google-sjekk velger du «Kun uten nettside» i filteret. Da ser du bare firma uten egen side — inkludert de som bare har Timma eller Fixit. Akkurat det du trenger når du skal selge nettsider.",
  },
  {
    q: "Er det lovlig å sende e-post til nye firma?",
    a: "I B2B er generelle adresser som post@ og info@ ofte lov å kontakte når innholdet er relevant. Personlige adresser er mer sensitive. NyLead hjelper deg å være forsiktig, men du har fortsatt ansvar for hva du sender.",
  },
  {
    q: "Sender jeg fra NyLead sin server?",
    a: "Nei. Du kobler Gmail, Outlook eller SMTP. Kunden svarer til deg, som på en vanlig e-post du har sendt selv.",
  },
  {
    q: "Hva får jeg for 499 kr per måned?",
    a: "Du får skann av nye firma, kontaktinfo når vi finner det, nettside-sjekk, opptil 250 firma med kontakt per måned, maler, utsending, sekvenser og pipeline.",
  },
  {
    q: "Kan jeg filtrere på bransje og sted?",
    a: "Ja. Du kan filtrere på kommune, fylke, bransje, alder på firma og om vi har kontaktinfo. Du kan også bruke nettside-filter når det er relevant.",
  },
  {
    q: "Hva om jeg allerede bruker Proff?",
    a: "Da skjønner du problemet allerede: mye klikking, kopiering og manuell sjekk. NyLead erstatter ikke alt Proff gjør, men gjør jakten på nye firma, kontaktinfo og oppfølging mye raskere.",
  },
];

export const TRUST = [
  "Finn nye kunder tidligere",
  "Kontaktinfo fra åpne kilder",
  "Nettside og signaler i listen",
  "Send fra din egen innboks",
  "Arbeidskø og pipeline",
  "Bygget for norsk B2B",
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
      subtitle: "Brreg, Google, Excel, en og en mail",
    },
    nylead: {
      title: "Med NyLead",
      subtitle: "Skann, filtrer, kontakt og følg opp",
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
    title: "Skann markedet",
    description:
      "Velg kommune, fylke, bransje og hvor nye firmaene skal være. Start med markedet du faktisk kan selge til.",
  },
  {
    step: 2,
    title: "Få listen",
    description:
      "NyLead viser nye firma med kontaktinfo når vi finner det. Du kan sjekke nettside, booking og sosiale profiler før du tar kontakt.",
  },
  {
    step: 3,
    title: "Filtrer og lagre",
    description:
      "Sorter bort det som ikke passer. Lagre firmaene du vil kontakte, eller legg dem i arbeidskøen så du vet hva du skal gjøre i dag.",
  },
  {
    step: 4,
    title: "Kontakt og følg opp",
    description:
      "Ring, send fra Gmail eller Outlook, og følg med på status. Du ser hvem som er kontaktet, hvem som svarte, og hvem som må tas igjen.",
  },
];
