export const LEAD_STATUSES = [
  { id: "ny", label: "Ny", color: "bg-slate-500" },
  { id: "kontaktet", label: "Kontaktet", color: "bg-blue-500" },
  { id: "svarte", label: "Svarte", color: "bg-emerald-500" },
  { id: "moete_booket", label: "Møte booket", color: "bg-violet-500" },
  { id: "vunnet", label: "Vunnet", color: "bg-green-600" },
  { id: "tapt", label: "Tapt", color: "bg-red-500" },
  { id: "ikke_interessert", label: "Ikke interessert", color: "bg-orange-500" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];

export const SEQUENCE_STATUSES = [
  "active",
  "completed",
  "paused",
  "replied",
  "unsubscribed",
  "failed",
] as const;

export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "email_sent",
  "status_changed",
  "note_added",
  "call",
  "sequence_enrolled",
  "sequence_sent",
  "sequence_paused",
  "follow_up_set",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function statusColor(status: string): string {
  return LEAD_STATUSES.find((s) => s.id === status)?.color ?? "bg-slate-500";
}

export const DEFAULT_TEMPLATES = [
  {
    name: "Intro tilbud — regnskap",
    subject: "Gratulerer med oppstart, {firmanavn}!",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering! Vi hjelper nystartede bedrifter med regnskap og rådgivning i oppstartsfasen.

Vi tilbyr en uforpliktende prat om hva dere trenger de første månedene.

Med vennlig hilsen`,
  },
  {
    name: "Intro tilbud — generell B2B",
    subject: "Kort spørsmål til {firmanavn}",
    body: `Hei {firmanavn},

Vi så at dere nettopp har registrert firma. Vi tilbyr tjenester som mange nye bedrifter trenger i starten.

Har dere 15 minutter til en uforpliktende prat denne uken?

Med vennlig hilsen`,
  },
  {
    name: "Oppfølging — dag 3",
    subject: "Re: tilbud til {firmanavn}",
    body: `Hei {firmanavn},

Jeg sendte en mail for noen dager siden. Vil bare høre om det er relevant for dere akkurat nå?

Si gjerne fra om timingen er bedre senere.

Med vennlig hilsen`,
  },
] as const;

export const DEFAULT_SEQUENCE = {
  name: "Standard 3-stegs oppfølging",
  steps: [
    {
      step_order: 0,
      delay_days: 0,
      subject: "Gratulerer med oppstart, {firmanavn}!",
      body: DEFAULT_TEMPLATES[1].body,
    },
    {
      step_order: 1,
      delay_days: 3,
      subject: "Re: kort spørsmål til {firmanavn}",
      body: DEFAULT_TEMPLATES[2].body,
    },
    {
      step_order: 2,
      delay_days: 7,
      subject: "Siste forsøk — {firmanavn}",
      body: `Hei {firmanavn},

Dette er siste gang jeg tar kontakt. Si gjerne ifra om dere vil høre mer, ellers ønsker jeg dere lykke til videre.

Med vennlig hilsen`,
    },
  ],
};
