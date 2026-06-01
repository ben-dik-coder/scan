export const site = {
  name: "NyLead",
  tagline:
    "For deg som selger nettsider og design. Finn firma med tlf og e-post fra Brreg, sjekk nettside med Google — send tilbud med Pro.",
  heroTitle: "Finn nye kunder som trenger nettside",
  description:
    "Hent firma fra Brønnøysund. Google sjekker automatisk om de har nettside. Du får en liste med kun de som trenger hjelp — klar til utsendelse.",
  audience: "Webdesignere · Byråer · Selgere av nettsider",
  stats: [
    { value: "2 000+", label: "Nye firma per uke i Norge" },
    { value: "30%", label: "Har e-post i Brønnøysund" },
    { value: "150", label: "Bedrifter med kontakt på Start" },
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
    title: "Send tilbud (Pro)",
    short: "Send",
    description:
      "Med Pro sender du én felles e-post til valgte firma — fra din egen Gmail eller Outlook.",
  },
] as const;
