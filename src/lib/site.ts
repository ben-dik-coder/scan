export const site = {
  name: "NyLead",
  tagline:
    "For deg som selger til nye firma i Norge. Finn kontaktinfo fra Brreg, Timma og Gulesider — ring eller send fra din egen innboks.",
  heroTitle: "Nye firma. Kontaktinfo. Klar til å ta.",
  description:
    "NyLead henter nye firma fra Brønnøysund, fyller inn tlf og e-post fra flere kilder, og lar deg filtrere, prioritere og sende fra din egen e-post.",
  audience: "For deg som selger til nye firma i Norge",
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
