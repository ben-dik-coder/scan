export const site = {
  name: "NyLead",
  tagline:
    "For deg som selger nettsider og design. Finn firma med tlf og e-post fra Brreg, sjekk nettside med Google — send tilbud fra din egen innboks.",
  heroTitle: "Finn firma som trenger nettside",
  description:
    "NyLead henter nye firma fra Brønnøysund, sjekker om de har nettside, og lar deg sende tilbud fra din egen e-post — uten Excel og manuell kopiering.",
  audience: "For deg som selger nettsider i Norge",
  stats: [
    { value: "2 000+", label: "Nye firma per uke i Norge" },
    { value: "30%", label: "Har e-post i Brreg" },
    { value: "250", label: "Firma du kan kontakte per måned" },
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
