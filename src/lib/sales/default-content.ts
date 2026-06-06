/**
 * Standard e-postmaler og sekvenser for nye brukere (seedDefaultSalesAssets).
 * Bruk {firmanavn} — resten er plassholdere brukeren tilpasser: [ditt navn], [ditt firma], osv.
 */

export const DEFAULT_TEMPLATES = [
  {
    name: "Intro — generell B2B",
    subject: "Gratulerer med oppstart, {firmanavn}!",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og jobber med [din tjeneste] for nye bedrifter i [ditt område]. Mange nystartede bruker de første månedene på å sette opp det grunnleggende — og overser det som faktisk gjør at kunder finner dem.

Vi hjelper firma som dere med [kort verdi — f.eks. «å komme raskt i gang med X»] uten at det blir tungt eller dyrt.

Har dere 15 minutter til en uforpliktende prat denne eller neste uke? Jeg tilpasser meg det som passer dere best.

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
  },
  {
    name: "Intro — nettside for nye firma",
    subject: "Gratulerer med oppstart, {firmanavn}!",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og lager nettsider for nye bedrifter i [ditt område]. Når noen googler dere for første gang, er det ofte nettsiden — eller mangelen på en — som avgjør om dere virker etablerte eller helt nye.

Jeg hjelper med en enkel, profesjonell side som viser hvem dere er, hva dere tilbyr og hvordan man tar kontakt. Ingen stort prosjekt — bare noe som fungerer fra dag én.

Har dere tenkt på nettside ennå? Jeg tar gjerne en kort, uforpliktende prat.

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
  },
  {
    name: "Intro — regnskap og rådgivning",
    subject: "Oppstart og regnskap — {firmanavn}",
    body: `Hei {firmanavn},

Gratulerer med oppstart!

De første månedene handler ofte om mye mer enn produktet eller tjenesten dere selger — MVA, bilag, lønn og valg av struktur kommer raskt. Feil her koster gjerne mer enn man tror.

Vi hjelper nystartede bedrifter i [ditt område] med regnskap, rapportering og rådgivning slik at dere kan fokusere på å skape omsetning.

Vil dere ha en kort, uforpliktende gjennomgang av hva dere bør ha på plass nå — og hva som kan vente?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Intro — markedsføring og synlighet",
    subject: "Synlighet for nye bedrifter — {firmanavn}",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Når et firma er helt nytt, er det ofte én ting som avgjør om folk oppdager det: synlighet. Mange starter sterkt på produktet, men svakere på det som gjør at kunder faktisk finner dem.

Vi hjelper nye bedrifter i [ditt område] med [f.eks. profilering, annonser, innhold eller lokal synlighet] — tilpasset budsjett og ambisjoner.

Er det aktuelt med en kort prat om hva som gir mest effekt for dere akkurat nå?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Intro — IT og drift",
    subject: "IT og drift for nye firma — {firmanavn}",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering!

I oppstartsfasen dukker det fort opp spørsmål om e-post, sikkerhet, backup og enheter — ofte i det øyeblikket man minst har tid til det.

Vi hjelper nye bedrifter i [ditt område] med [f.eks. oppsett av e-post, Microsoft 365, sikkerhet og support] slik at dere slipper å tenke på det hver dag.

Vil dere ha en kort gjennomgang av hva som er lurt å ha på plass fra dag én?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Nettside — hvorfor det betyr noe",
    subject: "Én ting mange nye firma overser — {firmanavn}",
    body: `Hei {firmanavn},

Kort oppfølging fra meg.

Mange nye bedrifter starter med Facebook, Instagram eller Gulesider. Det fungerer — men når en potensiell kunde googler dere, forventer de ofte en ordentlig nettside. Uten den kan dere virke mindre etablerte enn dere faktisk er.

En enkel side trenger ikke koste mye eller ta lang tid. Det viktigste er at den svarer på tre ting:
• Hvem er dere?
• Hva tilbyr dere?
• Hvordan tar man kontakt?

Vil du at jeg sender noen eksempler på hva andre nye firma i [ditt område] har gjort?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Oppfølging — myk (dag 2–3)",
    subject: "Re: kort spørsmål til {firmanavn}",
    body: `Hei {firmanavn},

Jeg sendte en e-post for noen dager siden og ville bare sjekke om den landet riktig.

Jeg vet at oppstartsfasen er travel — ingen stress om timingen ikke passer nå. Si gjerne fra om det er mer aktuelt om [f.eks. en måned], eller om det ikke er relevant i det hele tatt.

Med vennlig hilsen
[ditt navn]`,
  },
  {
    name: "Oppfølging — verdi og sjekkliste",
    subject: "5 ting nye firma bør ha på plass — {firmanavn}",
    body: `Hei {firmanavn},

Kort oppfølging fra meg.

Ett mønster vi ser ofte hos nystartede bedrifter: man prioriterer det som brenner akkurat nå, og utsetter det som faktisk gjør det lettere å vokse senere.

For mange handler det om [din verdi — f.eks. «å bli funnet på nett», «å ha orden i regnskap» eller «å ha trygg IT»].

Vil du at jeg sender en kort sjekkliste for oppstart — 5 punkter, ingen salg — uten forpliktelser?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Møteforespørsel — 15 minutter",
    subject: "15 minutter for {firmanavn}?",
    body: `Hei {firmanavn},

Jeg tar kontakt én gang til fordi mange nye firma sier de ønsket de hadde tatt en kort prat tidligere — før valg ble tatt på autopilot.

Jeg foreslår 15 minutter på telefon eller video:
• Hva dere har på plass i dag
• Hva som kan vente
• Om vi kan hjelpe — eller ikke

Ingen forpliktelser. Passer [dag/tid], eller foreslå noe som passer dere bedre.

Med vennlig hilsen
[ditt navn]
[telefon]`,
  },
  {
    name: "Alternativ — oppsummering uten møte",
    subject: "Alternativ for {firmanavn} — uten møte",
    body: `Hei {firmanavn},

Hvis et møte ikke passer nå, kan jeg sende en kort oppsummering på e-post i stedet:
• Hva vi vanligvis anbefaler for nye firma i deres situasjon
• Et realistisk neste steg — med eller uten oss

Bare svar «send oppsummering» så får dere det på under ett minutt å lese.

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
  },
  {
    name: "Siste kontakt — høflig avslutning",
    subject: "Siste forsøk — {firmanavn}",
    body: `Hei {firmanavn},

Dette er siste gang jeg tar kontakt i denne omgangen.

Jeg vil ikke fylle innboksen deres — hvis timingen ikke passer nå, er det helt greit. Dere er velkommen til å ta kontakt senere om behovet dukker opp.

Lykke til med videre drift!

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
  },
] as const;

const B2B_SEQUENCE = {
  name: "Standard 6-stegs B2B-oppfølging",
  steps: [
    {
      step_order: 0,
      delay_days: 0,
      subject: "Gratulerer med oppstart, {firmanavn}!",
      body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og jobber med [din tjeneste] for nye bedrifter i [ditt område]. Mange i oppstartsfasen bruker mye tid på det som må gjøres — og lite på det som gjør at nye kunder faktisk finner dem.

Vi hjelper firma som dere med [kort verdi] uten at det blir komplisert eller dyrt.

Har dere 15 minutter til en uforpliktende prat denne eller neste uke?

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
    },
    {
      step_order: 1,
      delay_days: 2,
      subject: "Re: {firmanavn} — fikk du forrige mail?",
      body: `Hei {firmanavn},

Bare en kort oppfølging — jeg sendte en e-post for et par dager siden.

Jeg vet det er mye som skjer når man nettopp har startet. Hvis det ikke passer nå, kan vi ta det om [f.eks. 2–4 uker] i stedet.

Svar gjerne med «ja», «senere» eller «nei takk» — da vet jeg hvordan jeg skal forholde meg.

Med vennlig hilsen
[ditt navn]`,
    },
    {
      step_order: 2,
      delay_days: 5,
      subject: "Hva de fleste nye firma gjør feil i starten",
      body: `Hei {firmanavn},

Ett mønster vi ser ofte: nye bedrifter satser på produktet først, og venter for lenge med det som gjør at kunder faktisk tar kontakt.

For [bransje/type firma] handler det ofte om [din innsikt — f.eks. synlighet, struktur eller trygg drift].

Jeg kan sende en kort sjekkliste for oppstart — 5 punkter, ingen salg — hvis det er nyttig?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
    },
    {
      step_order: 3,
      delay_days: 10,
      subject: "15 minutter for {firmanavn}?",
      body: `Hei {firmanavn},

Jeg tar kontakt én gang til fordi mange nye firma sier de ønsket de hadde tatt en kort prat tidligere — før valg ble tatt på autopilot.

Jeg foreslår 15 minutter på telefon eller video:
• Hva dere har på plass i dag
• Hva som kan vente
• Om vi kan hjelpe — eller ikke

Ingen forpliktelser. Passer [dag/tid], eller foreslå noe som passer dere bedre.

Med vennlig hilsen
[ditt navn]
[telefon]`,
    },
    {
      step_order: 4,
      delay_days: 16,
      subject: "Alternativ for {firmanavn} — uten møte",
      body: `Hei {firmanavn},

Hvis et møte ikke passer nå, kan jeg sende en kort oppsummering på e-post i stedet:
• Hva vi vanligvis anbefaler for nye firma i deres situasjon
• Et realistisk neste steg — med eller uten oss

Bare svar «send oppsummering» så får dere det på under ett minutt å lese.

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
    },
    {
      step_order: 5,
      delay_days: 25,
      subject: "Siste forsøk — {firmanavn}",
      body: `Hei {firmanavn},

Dette er siste gang jeg tar kontakt i denne omgangen.

Jeg vil ikke fylle innboksen deres. Hvis behovet dukker opp senere, er dere velkommen til å ta kontakt — da hjelper jeg gjerne.

Lykke til med videre drift!

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
    },
  ],
} as const;

const WEBSITE_SEQUENCE = {
  name: "Standard 6-stegs nettside-oppfølging",
  steps: [
    {
      step_order: 0,
      delay_days: 0,
      subject: "Gratulerer med oppstart, {firmanavn}!",
      body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg heter [ditt navn] og lager nettsider for nye bedrifter i [ditt område]. Når noen googler dere for første gang, er det ofte nettsiden — eller mangelen på en — som avgjør om dere virker etablerte eller helt nye.

Jeg hjelper med en enkel, profesjonell side som viser hvem dere er, hva dere tilbyr og hvordan man tar kontakt. Ingen stort prosjekt — bare noe som fungerer fra dag én.

Har dere tenkt på nettside ennå? Jeg tar gjerne en kort, uforpliktende prat.

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
    },
    {
      step_order: 1,
      delay_days: 2,
      subject: "Re: nettside for {firmanavn}?",
      body: `Hei {firmanavn},

Bare en kort oppfølging — jeg sendte en e-post for et par dager siden om nettside.

Jeg vet det er mye som skjer i oppstartsfasen. Hvis det ikke passer nå, kan vi ta det om [f.eks. 2–4 uker] i stedet.

Svar gjerne med «ja», «senere» eller «nei takk» — da vet jeg hvordan jeg skal forholde meg.

Med vennlig hilsen
[ditt navn]`,
    },
    {
      step_order: 2,
      delay_days: 5,
      subject: "Facebook er bra — men Google er ofte det første folk sjekker",
      body: `Hei {firmanavn},

Mange nye bedrifter starter med Facebook, Instagram eller Gulesider. Det fungerer — men når en potensiell kunde googler dere, forventer de ofte en ordentlig nettside.

Uten den kan dere virke mindre etablerte enn dere faktisk er — selv om dere leverer godt arbeid.

En enkel side trenger ikke koste mye eller ta lang tid. Det viktigste er at den svarer på tre ting:
• Hvem er dere?
• Hva tilbyr dere?
• Hvordan tar man kontakt?

Vil du at jeg sender noen eksempler på hva andre nye firma i [ditt område] har gjort?

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
    },
    {
      step_order: 3,
      delay_days: 10,
      subject: "15 min — hva trenger {firmanavn} egentlig?",
      body: `Hei {firmanavn},

Jeg tar kontakt én gang til fordi mange nye firma sier de ønsket de hadde tatt en kort prat om nettside tidligere — før de valgte en løsning som ikke passet.

Jeg foreslår 15 minutter på telefon eller video:
• Hva dere trenger nå — og hva som kan vente
• Realistisk pris og tidslinje
• Om vi er rett match — eller ikke

Ingen forpliktelser. Passer [dag/tid], eller foreslå noe som passer dere bedre.

Med vennlig hilsen
[ditt navn]
[telefon]`,
    },
    {
      step_order: 4,
      delay_days: 16,
      subject: "Kan sende eksempler uten møte — {firmanavn}",
      body: `Hei {firmanavn},

Hvis et møte ikke passer nå, kan jeg sende noe på e-post i stedet:
• 2–3 eksempler på nettsider for lignende firma
• Hva en enkel startside vanligvis inneholder
• Et realistisk neste steg — med eller uten meg

Bare svar «send eksempler» så får dere det på under ett minutt å lese.

Med vennlig hilsen
[ditt navn]
[ditt firma]`,
    },
    {
      step_order: 5,
      delay_days: 25,
      subject: "Siste forsøk — {firmanavn}",
      body: `Hei {firmanavn},

Dette er siste gang jeg tar kontakt i denne omgangen.

Jeg vil ikke fylle innboksen deres. Hvis dere trenger nettside senere, er dere velkommen til å ta kontakt — da hjelper jeg gjerne.

Lykke til med videre drift!

Med vennlig hilsen
[ditt navn]
[ditt firma]
[telefon] · [e-post]`,
    },
  ],
} as const;

export const DEFAULT_SEQUENCES = [B2B_SEQUENCE, WEBSITE_SEQUENCE] as const;

/** Bakoverkompatibilitet — første sekvens i listen */
export const DEFAULT_SEQUENCE = DEFAULT_SEQUENCES[0];
