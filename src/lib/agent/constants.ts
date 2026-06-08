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

/** Maks tool-loops mot OpenAI per melding */
export const AGENT_MAX_TOOL_LOOPS = 8;

export const AGENT_SCAN_DELAY_MS = 200;

/** Kjøringer uten oppdatering lenger enn dette regnes som hengende og avbrytes automatisk. */
export const AGENT_RUN_STALE_MS = 10 * 60 * 1000;
