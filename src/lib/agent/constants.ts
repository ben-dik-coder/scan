/** AI-agent av som standard. Sett AGENT_ENABLED=true (og NEXT_PUBLIC_AGENT_ENABLED=true for UI) for å skru på. */
export const AGENT_DISABLED_MESSAGE =
  "AI-agenten er midlertidig slått av. Prøv igjen senere.";

export function isAgentEnabled(): boolean {
  if (process.env.AGENT_DISABLED === "true") return false;
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_AGENT_ENABLED === "true";
  }
  return process.env.AGENT_ENABLED === "true";
}

/** Maks firma agenten behandler per jobb (MVP) */
export const AGENT_MAX_COMPANIES_PER_JOB = 100;

/** Maks firma per scan_websites-kall — hindrer 20-min skann av hele søket */
export const AGENT_MAX_SCAN_PER_CALL = 5;

/** Maks firma skannet i én brukerforespørsel (deles i batcher à AGENT_MAX_SCAN_PER_CALL) */
export const AGENT_MAX_SCAN_PER_JOB = 10;

/** Standard antall firma ved «finn meg 5 …» uten eksplisitt tall */
export const AGENT_DEFAULT_LIST_LIMIT = 5;

/** Maks limit i search_companies for hurtigliste */
export const AGENT_MAX_FAST_LIST_LIMIT = 20;

/** Maks antall firma/orgnr i kompakt tool-svar til modellen */
export const AGENT_MAX_TOOL_RESULT_SAMPLE = 18;

/** Hent flere treff enn limit slik at vi kan filtrere dårlige leads */
export const AGENT_SEARCH_OVERFETCH_MIN = 40;

/** Maks telefon-oppslag under search_companies når brukeren ber om telefon */
export const AGENT_MAX_SEARCH_PHONE_LOOKUPS = 24;

/** Færre oppslag ved hurtigliste med «med telefon» */
export const AGENT_MAX_FAST_LIST_PHONE_LOOKUPS = 12;

/** Timeout for search_companies */
export const AGENT_TOOL_SEARCH_TIMEOUT_MS = 15_000;

/** Maks tid for ett scan_websites-kall (5 firma × ~15s snitt) */
export const AGENT_TOOL_SCAN_TIMEOUT_MS = 120_000;

/** Timeout per firma under agent-skann */
export const AGENT_SCAN_ONE_TIMEOUT_MS = 45_000;

/** Maks tool-loops mot OpenAI per melding */
export const AGENT_MAX_TOOL_LOOPS = 8;

/** Færre tool-loops når brukeren bare ber om søk (ikke nettside-skann) */
export const AGENT_MAX_TOOL_LOOPS_SIMPLE_SEARCH = 5;

/** Maks tool-sammendrag i samtalehistorikk */
export const AGENT_MAX_TOOL_HISTORY_MESSAGES = 12;

export const AGENT_SCAN_DELAY_MS = 200;

/** Antall nettside-skann som kjører parallelt i scan_websites */
export const AGENT_SCAN_CONCURRENCY = 4;

/** Oppdater scan-fremdrift i DB hver N. firma (ikke hver enkelt) */
export const AGENT_SCAN_PROGRESS_BATCH = 3;

/** Kjøringer uten oppdatering lenger enn dette regnes som hengende og avbrytes automatisk. */
export const AGENT_RUN_STALE_MS = 5 * 60 * 1000;

/** Klient-timeout for agent-chat (litt under server maxDuration 300s) */
export const AGENT_CLIENT_TIMEOUT_MS = 280_000;

/** SSE heartbeat under lange skann — holder streamen i live */
export const AGENT_SSE_HEARTBEAT_MS = 15_000;

/** Maks lagrede AI-samtaler per bruker */
export const MAX_AGENT_CONVERSATIONS = 5;
