/**
 * Verifiser agent search_companies for Narvik frisør (uten OpenAI).
 * Kjør: npx tsx scripts/verify-agent-search.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeAgentTool } from "../src/lib/agent/execute-tool.ts";
import { AGENT_MAX_COMPANIES_PER_JOB } from "../src/lib/agent/constants.ts";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const result = await executeAgentTool(
    { userId: "verify-script", runId: "verify-run" },
    "search_companies",
    {
      municipalityCode: "1806",
      industryGroup: "frisor",
      days: 0,
    }
  );

  console.log("Oppsummering:", result.summary);
  const companies = result.data.companies as Array<{ orgnr: string; name: string }>;
  console.log("Antall:", companies?.length ?? 0);
  console.log("Maks tillatt:", AGENT_MAX_COMPANIES_PER_JOB);
  console.log("Truncated:", result.data.truncated);

  if (!companies?.length) {
    console.log("Ingen firma funnet (sjekk DB-sync).");
    process.exit(0);
  }

  console.log("Eksempel:", companies.slice(0, 3).map((c) => c.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
