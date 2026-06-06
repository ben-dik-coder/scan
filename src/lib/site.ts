export const site = {
  name: "NyLead",
  url: "https://nylead.no",
  tagline:
    "For deg som selger til nye firma i Norge. Finn kontaktinfo fra Brreg, Timma og Gulesider — ring eller send fra din egen innboks.",
  heroTitle: "Finn nye firma i Norge med kontaktinfo",
  description:
    "NyLead henter nye firma fra Brønnøysund, finner telefon og trygg e-post, sjekker nettside med Google og lar deg ringe eller sende tilbud fra din egen innboks.",
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
    { value: "10", label: "Google-sjekk om gangen" },
    { value: "1 tabell", label: "Brreg + nett + kontakt" },
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
