export const site = {
  name: "NyLead",
  url: "https://nylead.no",
  tagline:
    "Finn nye kunder før konkurrentene. NyLead finner nye firma, kontaktinfo og signaler du kan bruke når du tar kontakt.",
  heroTitle: "Finn nye kunder før konkurrentene",
  description:
    "NyLead finner nye firma fra Brønnøysund, beriker med åpne kilder, viser kontaktinfo og signaler, og hjelper deg å kontakte og følge opp fra egen innboks.",
  audience: "For deg som selger til nye firma i Norge",
  ogImage: "/images/front/front.png",
  keywords: [
    "leads",
    "leadsgenerering",
    "B2B leads",
    "nye firma",
    "nye bedrifter",
    "Brønnøysundregistrene",
    "Brreg",
    "firmalister",
    "kontaktinfo bedrifter",
    "telefonnummer bedrifter",
    "salg til bedrifter",
    "B2B salg",
    "prospektering",
    "Google-sjekk",
    "firma uten nettside",
    "webbyrå leads",
    "regnskap leads",
    "markedsføring leads",
    "lokale leads",
    "Gulesider",
    "1881",
    "Timma",
    "Fixit",
  ],
  stats: [
    { value: "2 000+", label: "Nye firma per uke i Norge" },
    { value: "1 flyt", label: "Skann, filtrer og følg opp" },
    { value: "1 tabell", label: "Firma, kontakt og signaler" },
  ],
};

export const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "Oslo + e-post",
    short: "Filter",
    description: "Hent firma med e-post i Oslo (eller annen kommune) fra Brønnøysund.",
  },
  {
    step: 2,
    title: "Google sjekker",
    short: "Nettside",
    description:
      "Vi søker på Google for maks 10 firma om gangen — egen nettside, eller bare booking (Timma, Fixit osv.).",
  },
  {
    step: 3,
    title: "Kun uten nettside",
    short: "Leads",
    description:
      "Listen viser firma uten egen side — inkl. de som kun har bookingsløsning. Huket av for deg.",
  },
  {
    step: 4,
    title: "Send tilbud",
    short: "Send",
    description:
      "Send én felles e-post til valgte firma — fra din egen Gmail eller Outlook.",
  },
] as const;
