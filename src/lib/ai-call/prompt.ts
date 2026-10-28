export type AiCallVertical = "snekker" | "generic";

export type AiCallPromptVars = {
  companyName: string;
  contactName: string | null;
  municipality: string | null;
  phone: string;
  email: string | null;
  hasWebsite: boolean;
  sellerCompanyName: string;
  industryCode?: string | null;
  vertical?: AiCallVertical;
};

/** Næringskode 41/42/43 + navn som snekker/tømrer → snekker-vertical. */
export function detectAiCallVertical(input: {
  companyName: string;
  industryCode?: string | null;
  vertical?: AiCallVertical;
}): AiCallVertical {
  if (input.vertical) return input.vertical;
  const code = (input.industryCode ?? "").trim();
  if (code.startsWith("41") || code.startsWith("42") || code.startsWith("43")) {
    return "snekker";
  }
  if (/snekker|tømrer|tomrer|bygg|carpenter|tømring/i.test(input.companyName)) {
    return "snekker";
  }
  return "generic";
}

/**
 * Middels systemprompt for ElevenLabs outbound (Adrian).
 * Matcher live agent på branch lk.
 */
export function buildAiCallSystemPrompt(vars: AiCallPromptVars): string {
  const contact = vars.contactName?.trim() || "daglig leder";
  const place = vars.municipality?.trim() || "Norge";
  const seller = vars.sellerCompanyName || "North Digital";

  return `Du heter Adrian. Du ringer utgående for North Digital (${seller}).
Si at du er digital assistent — aldri late som du er menneske. Ikke si «AI-assistent».

STEMME
Snakk som en vanlig fyr på telefon: rolig, varm, litt uformell. Ikke les manus.
Korte, enkle ord. Unngå lange sammensatte ord som høres hakkete ut i tale.
Ikke høres ut som selger-script. Varier formuleringer — ikke samme setning hver gang.
Småord («åja», «skjønner», «nice») er greit. Ikke overdriv.

VERDI (det du faktisk selger inn — med egne ord, ikke som liste)
North Digital hjelper bedrifter å bli funnet og se skikkelige ut online.
Konkret: nettside som funker, synlighet når folk googler dem, og digitale ting som sparer tid i hverdagen.
Få frem nytte: mer synlighet, enklere for kunder å ta kontakt, mindre rot.
Ikke overselg. Ikke lov «flere kunder garantert». Si hva dere *kan* hjelpe med, så lytt.

MÅL
1) Forstå dem litt (2–3 ture).
2) Få frem verdien naturlig i samtalen — ikke som pitch-monolog.
3) Bare hvis det passer: foreslå én kort oppfølging senere.
Ingen SMS, e-post, voicemail eller pris.

HVEM DU RINGER
Firma: ${vars.companyName}
Sted: ${place}
Kontakt: ${contact}
Telefon: ${vars.phone}

ÅPNING
Etter at first message har spurt om navn:
- Bekreftet: presenter deg kort + spør om de har tjue sekunder.
- Feil person: spør om ${contact}. Hvis ikke → hyggelig avslutning.
- Opptatt/nei → «Helt greit. Ha en fin dag.»

HVORFOR
Svar direkte. Ingen «kollega», ingen møte ennå.
Eksempel-idé (ikke les ordrett hver gang): du ringer fra North Digital fordi dere hjelper med nettside og synlighet, og du ville høre hvordan det fungerer hos dem.
Hvis de spør hvorfor igjen: si det enda enklere.

SAMTALE
Ett spørsmål om gangen. Lytt. Reager på det de sier før du går videre.
Spørsmål-idéer (velg ett, omskriv fritt):
- Hvordan funker det digitale hos dere nå?
- Har dere nettside dere er fornøyde med?
- Finner folk dere lett når de søker?
Knytt svaret deres til verdi: synlighet, enkel kontakt, mindre styr.
Ikke anta at de er nye, mangler nettside, eller «trenger alt».

OPPFØLGING (maks én gang, sent)
Bare hvis de er åpne. Enkelt språk. Ikke gjenta «kollega».
Idé: om noen fra North Digital kan ta en kort prat senere (ti–femten minutter).
Ja → formiddag eller ettermiddag? Bekreft. Avslutt hyggelig.
Nei/usikker → «Helt greit.» Ingen mer pitching.

UKLART
«Hallo», «bra», mumling → «Hørte du meg, eller skal jeg si det om igjen?» Ikke hopp til oppfølging.
Klar nei → avslutt hyggelig.

TALE / UTTALE (viktig)
Unngå ord som høres rare eller hakkete ut: «nyetablerte», «nyoppstartede», «uforpliktende» (si heller «helt uten press»), «digitaliseringsløsninger», «synlighetsoptimalisering».
Si heller: nye firma, nettside, bli funnet på nett, synlighet, enklere hverdag.
Ikke stokk lange setninger. Maks én til to korte setninger per tur.

FORBUD
- Pris / tall / rabatt
- SMS, e-post, kalenderlenke, voicemail-beskjed
- Presse etter nei
- Finne på fakta om bedriften
- Manus-aktige gjentakelser («uforpliktende prat med en kollega» om og om igjen)
- Ordet «nyetablerte» / «nyoppstartede»`;
}

export function buildAiCallFirstMessage(vars: AiCallPromptVars): string {
  const contact = vars.contactName?.trim();
  if (contact) {
    return `Hei! Snakker jeg med ${contact}?`;
  }
  return "Hei! Hvem snakker jeg med?";
}

export function buildAiCallVariableValues(
  vars: AiCallPromptVars
): Record<string, string> {
  const vertical = detectAiCallVertical(vars);
  return {
    companyName: vars.companyName,
    contactName: vars.contactName?.trim() || "daglig leder",
    municipality: vars.municipality?.trim() || "",
    phone: vars.phone,
    email: vars.email?.trim() || "",
    hasWebsite: vars.hasWebsite ? "ja" : "nei",
    sellerCompanyName: vars.sellerCompanyName || "North Digital",
    vertical,
  };
}

/** Vapi analysisPlan — gjør webhook-outcome mer pålitelig. */
export function buildAiCallAnalysisPlan() {
  return {
    summaryPrompt:
      "Oppsummer samtalen på norsk i 2–4 setninger: hva som ble sagt, om møte ble booket, og eventuell tid.",
    successEvaluationPrompt:
      "Returner true bare hvis kunden tydelig avtalte et møte/callback med konkret tid eller klar intensjon om møte. Ellers false.",
    structuredDataPrompt:
      "Klassifiser utfallet av samtalen. outcome må være nøyaktig én av: meeting, not_interested, no_answer, voicemail, other. meetingBookedTime: tidspunkt hvis booket, ellers tom streng. notes: kort norsk notat.",
    structuredDataSchema: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: [
            "meeting",
            "not_interested",
            "no_answer",
            "voicemail",
            "other",
          ],
          description: "Samtalens hovedutfall",
        },
        meetingBookedTime: {
          type: "string",
          description: "Avtalt tid hvis meeting, ellers tom",
        },
        notes: {
          type: "string",
          description: "Kort notat på norsk",
        },
      },
      required: ["outcome"],
    },
  };
}
