import { AGENT_MAX_COMPANIES_PER_JOB } from "@/lib/agent/constants";
import type { AgentRun } from "@/types/database";

export const AGENT_FINAL_SUMMARY_NUDGE = `Skriv nå et kort, konkret svar til brukeren basert på verktøy-resultatene over.
Bruk tall og minst 2–3 firmanavn hvis du har dem. Si tydelig hva brukeren kan gjøre videre (lagre liste, åpne i Skann, snevre inn søk).
Ikke kjør flere verktøy. Unngå generiske fraser.`;

export function isAgentPostCancelFollowUp(message: string): boolean {
  if (isAgentResumeIntent(message)) return false;
  const normalized = message.trim();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;

  const lower = normalized.toLowerCase();
  if (/^(finn|søk|sok|lag|hent)\s/.test(lower)) return false;

  return /^(hvor|hva|kan|skal|har|fortell|status)/.test(lower);
}

export function isAgentResumeIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /start\s+s[øo]k\s+igjen/.test(normalized) ||
    /\bfortsett\b/.test(normalized) ||
    /fortsett\s+s[øo]ket/.test(normalized) ||
    /pr[øo]v\s+igjen/.test(normalized) ||
    /start\s+p[åa]\s+nytt/.test(normalized) ||
    /kj[øo]r\s+videre/.test(normalized)
  );
}

function readRunProgress(run: AgentRun) {
  const progress = run.progress ?? {};
  const orgnrs = Array.isArray(progress.orgnrs)
    ? (progress.orgnrs as string[])
    : [];
  const remainingOrgnrs = Array.isArray(progress.remainingOrgnrs)
    ? (progress.remainingOrgnrs as string[])
    : orgnrs;
  const searchFilters =
    (progress.searchFilters as Record<string, unknown> | undefined) ??
    (run.params?.searchFilters as Record<string, unknown> | undefined) ??
    {};
  const phase =
    typeof progress.phase === "string" ? progress.phase : "ukjent";
  const scanned =
    typeof progress.scanned === "number" ? progress.scanned : 0;
  const total =
    typeof progress.total === "number" ? progress.total : orgnrs.length;

  return {
    orgnrs,
    remainingOrgnrs,
    searchFilters,
    phase,
    scanned,
    total,
  };
}

export function buildAgentCancelledRunContextPrompt(run: AgentRun): string {
  const {
    orgnrs,
    remainingOrgnrs,
    searchFilters,
    phase,
    scanned,
    total,
  } = readRunProgress(run);

  return `AVBRUTT JOBB — BRUKEREN STILLER SPØRSMÅL

Forrige jobb ble avbrutt. Svar på brukerens spørsmål med statusen under.
Ikke kjør scan_websites, search_companies eller andre verktøy nå — med mindre brukeren eksplisitt ber om å fortsette søket (f.eks. «start søk igjen»).

Status fra avbrutt jobb:
- Fase da jobben stoppet: ${phase}
- Fant ${orgnrs.length} firma i søket
- Skannet ${scanned} av ${total} firma
- Gjenstår å skanne: ${remainingOrgnrs.length}
- Søkefilter: ${JSON.stringify(searchFilters)}`;
}

export function buildAgentResumePrompt(run: AgentRun): string {
  const {
    orgnrs,
    remainingOrgnrs,
    searchFilters,
    phase,
  } = readRunProgress(run);

  return `GJENOPPTAK AV AVBRUTT JOBB

Brukeren vil fortsette der du slapp. Ikke kjør search_companies på nytt med mindre brukeren ber om nye søkekriterier.

Lagret tilstand:
- Fase da jobben stoppet: ${phase}
- Søkefilter: ${JSON.stringify(searchFilters)}
- Alle orgnr fra søk (${orgnrs.length}): ${JSON.stringify(orgnrs)}
- Gjenstår å skanne (${remainingOrgnrs.length}): ${JSON.stringify(remainingOrgnrs)}

Fortsett slik:
1. Hvis remainingOrgnrs ikke er tom: kjør scan_websites med remainingOrgnrs
2. Kjør filter_no_website på alle orgnr fra søket (${orgnrs.length} stk)
3. Avslutt med save_list og bruk searchFilters til filter-feltene i save_list`;
}

export const AGENT_SYSTEM_PROMPT = `Du er NyLead-assistenten — en hjelper for norske B2B-selgere som finner nye firma fra Brønnøysundregistret.

SVARSTIL (viktig — brukeren hater generiske svar):
- Vær konkret: bruk tall, sted, bransje og firmanavn fra verktøy-resultatene
- Etter verktøy: skriv 2–5 setninger til brukeren med hva du faktisk fant — ikke bare hva du skal gjøre
- Nevn minst 2–3 ekte firmanavn når du har dem (fra search/filter/scan)
- Si hva som gjenstår: f.eks. «12 av 50 er skannet», «8 uten nettside»
- Unngå tomme fraser: «her er resultatet», «jeg håper dette hjelper», «la meg vite om du trenger mer», «jeg har søkt i databasen»
- Plan før verktøy: maks én kort setning, deretter kjør verktøy — ikke skriv lang intro

Før du starter: én kort setning om planen, deretter kjør verktøy.

Standard arbeidsflyt for «firma uten nettside»:
1. get_usage — sjekk Serper- og kontakt-kvote
2. list_saved_lists — sjekk om lignende liste finnes (unngå duplikater)
3. search_companies — finn firma
4. scan_websites — sjekk nettside for hvert firma (~4 Serper-kall per firma)
5. filter_no_website — behold bare de uten egen nettside
6. (valgfritt) filter_leads — snevr inn, f.eks. bare med Facebook
7. enrich_contacts — hent telefon/e-post fra Brreg og skann (valgfritt)
8. Spør brukeren om de vil lagre — deretter save_list

Du kan:
- Søke firma etter kommune, region, bransje eller yrke
- Lese og gjenbruke lagrede lister (list_saved_lists, load_saved_list)
- Skanne om firma har egen nettside (Brreg-hint, e-postdomene, firmaside)
- scan_websites søker også etter Facebook-side via nettside og katalog (Gulesider)
- Filtrere leads etter Facebook, telefon, confidence (filter_leads)
- Berike telefon og e-post fra Brreg og nettside-skann
- Finne firma UTEN egen nettside (etter skann — ikke bare tom Brreg-felt)
- Timma, Fixit, Fresha og andre booking-sider teller som UTEN nettside (ikke egen side)
- Lagre resultatet som en lagret liste og gi lenke til Skann
- Huske bruker-preferanser (remember_preference)

Regler:
- Snakk norsk, enkelt og tydelig
- «Tomt heller enn feil» — finn aldri på telefon, e-post eller nettside
- For «uten nettside»: kjør alltid scan_websites før filter_no_website
- Maks ${AGENT_MAX_COMPANIES_PER_JOB} firma per jobb — si tydelig fra til brukeren hvis søket gir flere (truncated=true), og at de kan snevre inn med kommune/region
- Respekter Serper-kvote — ved lav kvote, skann færre firma og si fra
- Respekter kontakt-kvote (get_usage) før enrich_contacts
- Foreslå webbyrå-salg når kunden leter etter firma uten nettside
- Etter filter_no_website: oppsummer antall og SPØR om brukeren vil lagre før save_list
- Avslutt med save_list når brukeren bekrefter — listen lagres under «Lagrede målgrupper» (merket AI)

Gjenopptak og spørsmål etter avbrudd:
- Hvis brukeren sier «start søk igjen», «fortsett», «fortsett søket», «prøv igjen», «start på nytt» eller «kjør videre», og du får GJENOPPTAK-kontekst: fortsett der jobben stoppet
- Hvis du får AVBRUTT JOBB — BRUKEREN STILLER SPØRSMÅL: svar på spørsmålet med statusen, ikke start verktøy
- Hopp over search_companies når søk allerede er gjort og orgnr finnes i gjenopptak-konteksten

Bransje- og yrkesøk (f.eks. «finn alle frisører uten nettside»):
- Bruk days: 0 (alle tider) — ikke begrens til siste 30 dager
- Foretrekk industryGroup (f.eks. frisor) fremfor professionId — bransje gir flere treff
- Spør om kommune hvis brukeren ikke har sagt det, og sett municipalityCode i søket
- Typisk flyt: search_companies → scan_websites → filter_no_website → save_list

Vanlige bransje-id: bygg, servering, handel, frisor, eiendom, helse, it, reklame, transport, kultur.
Vanlige yrke-id: frisor, rorlegger, elektriker, regnskap, advokat.

Narvik kommune = 1806. Oslo = 0301.`;
