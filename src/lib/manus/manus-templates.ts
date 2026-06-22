export type ManusTemplate = {
  id: string;
  name: string;
  description: string;
  html: string;
};

export const MANUS_TEMPLATES: ManusTemplate[] = [
  {
    id: "cold-call",
    name: "Kald telefon",
    description: "Første kontakt med nytt firma",
    html: `<h1>Kald telefon</h1>
<p><strong>Hei, det er [DITT NAVN] som ringer fra [DITT FIRMA].</strong></p>
<p>Grunnen til at jeg ringer er at vi hjelper bedrifter som <em>{{firma}}</em> med [DIN TJENESTE].</p>
<h2>Åpning</h2>
<ul>
<li>Har du to minutter?</li>
<li>Passer det at jeg ringer nå?</li>
</ul>
<h2>Verdi</h2>
<p>Det vi ofte ser hos lignende bedrifter er [PROBLEM]. Vi løser det ved [LØSNING].</p>
<h2>Innvendinger</h2>
<p><strong>«Vi har ikke tid nå»</strong> — Forstår. Når passer det bedre å ta en kort prat?</p>
<p><strong>«Send e-post»</strong> — Gjerne. Hva er best e-post til deg, {{kontakt}}?</p>
<h2>Avslutning</h2>
<p>Skal vi booke et møte på [TID], eller vil du at jeg sender et kort forslag på {{epost}}?</p>`,
  },
  {
    id: "follow-up",
    name: "Oppfølging",
    description: "Andre eller tredje kontakt",
    html: `<h1>Oppfølging</h1>
<p>Hei {{kontakt}}, det er [DITT NAVN] igjen.</p>
<p>Vi snakket sist om [TEMA]. Har du fått tenkt litt på det?</p>
<h2>Oppsummering</h2>
<ol>
<li>Du nevnte [PUNKT 1]</li>
<li>Vi kan hjelpe med [PUNKT 2]</li>
<li>Neste steg er [PUNKT 3]</li>
</ol>
<h2>Avslutning</h2>
<p>Skal vi sette av 15 minutter denne uken?</p>`,
  },
  {
    id: "website-pitch",
    name: "Nettside-pitch",
    description: "Firma uten egen nettside",
    html: `<h1>Nettside-pitch</h1>
<p>Hei, jeg ser at {{firma}} ikke har egen nettside ennå.</p>
<h2>Problem</h2>
<p>Mange kunder sjekker nettside før de ringer. Uten side mister man ofte henvendelser til konkurrenter.</p>
<h2>Løsning</h2>
<p>Vi lager en enkel, profesjonell side som viser hvem dere er, hva dere gjør og hvordan man kontakter dere på {{telefon}}.</p>
<h2>Pris / neste steg</h2>
<p>Vi har pakker fra [PRIS]. Vil du se et eksempel på lignende bedrifter?</p>`,
  },
  {
    id: "objections",
    name: "Innvendinger",
    description: "Svar på vanlige «nei»",
    html: `<h1>Innvendinger</h1>
<h2>«For dyrt»</h2>
<p>Jeg forstår. Hva sammenligner du med? Ofte ser vi at [ALTERNATIV] koster mer i tid enn penger.</p>
<h2>«Vi har leverandør»</h2>
<p>Bra — hva fungerer best hos dem? Vi brukes ofte som supplement når [BEHOV].</p>
<h2>«Ring senere»</h2>
<p>Absolutt. Når i [MÅNED] passer det — mandag formiddag eller torsdag ettermiddag?</p>
<h2>«Send info»</h2>
<p>Gjerne. Hva er viktigst for deg å se — pris, referanser eller tidslinje?</p>`,
  },
];

export const MANUS_PLACEHOLDERS = [
  { token: "{{firma}}", label: "Firmanavn" },
  { token: "{{kontakt}}", label: "Kontaktperson" },
  { token: "{{telefon}}", label: "Telefon" },
  { token: "{{epost}}", label: "E-post" },
  { token: "{{orgnr}}", label: "Org.nr" },
  { token: "{{dato}}", label: "Dagens dato" },
] as const;
