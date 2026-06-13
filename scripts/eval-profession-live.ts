/**
 * Live smoke-test: yrkes-spørringer mot agent-API.
 * Kjør: npx tsx scripts/eval-profession-live.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Scenario = {
  id: string;
  prompt: string;
  pattern: RegExp;
};

const SCENARIOS: Scenario[] = [
  { id: "L01", prompt: "finn 5 elektrikere i Narvik", pattern: /elektro|elektriker|el-/i },
  { id: "L02", prompt: "find plumber Bergen", pattern: /rør|vvs|rørlegger|rorlegger/i },
  { id: "L03", prompt: "finn 3 malere i Bodø", pattern: /maler|maling|sparkel/i },
  { id: "L04", prompt: "finn psykolog i Bergen", pattern: /psykolog/i },
  { id: "L05", prompt: "finn 5 frisører i Tromsø", pattern: /fris|hår|klipp|salong|barber/i },
  { id: "L06", prompt: "finn 3 advokater i Oslo", pattern: /advokat|juridisk|jurist/i },
  { id: "L07", prompt: "markedsfører i Oslo", pattern: /reklame|markeds|byrå|byra|media/i },
  { id: "L08", prompt: "finn taktekkjar i Bergen", pattern: /tak|blikkenslager/i },
  { id: "L09", prompt: "dentist in Oslo", pattern: /tannlege|tann|dental|dentist/i },
  { id: "L10", prompt: "finn leder i oslo", pattern: /mener du|kommune|bransje|hva slags|hvor|område|yrke|stillings/i },
];

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function chat(message: string) {
  const apiKey = process.env.AGENT_SERVICE_API_KEY?.trim();
  const baseUrl = (process.env.AGENT_CHAT_BASE_URL?.trim() || "http://localhost:3003").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ message, cancelPrevious: true }),
  });
  if (!response.ok) return { text: "", error: `HTTP ${response.status}` };
  if (!response.body) return { text: "", error: "Ingen body" };

  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (
          (event.type === "text_delta" || event.type === "text" || event.type === "done") &&
          typeof event.content === "string"
        ) {
          if (event.type !== "done" || !assistantText) assistantText += event.content;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { text: assistantText.trim() };
}

async function main() {
  loadEnvLocal();
  let pass = 0;
  let fail = 0;

  for (const scenario of SCENARIOS) {
    process.stdout.write(`[${scenario.id}] ${scenario.prompt.slice(0, 45)}... `);
    const start = Date.now();
    let result: { text: string; error?: string };
    try {
      result = await chat(scenario.prompt);
    } catch (err) {
      result = { text: "", error: err instanceof Error ? err.message : String(err) };
    }

    const durationMs = Date.now() - start;
    const hasResults = /^\d+\./m.test(result.text) || /orgnr|fant \d+|her er \d+/i.test(result.text);
    const patternOk = scenario.pattern.test(result.text);
    const ok = !result.error && (hasResults ? patternOk : patternOk);

    if (ok) {
      pass++;
      console.log(`OK (${durationMs}ms)`);
    } else {
      fail++;
      console.log(`FAIL (${durationMs}ms): ${result.error ?? "feil svar"}`);
      console.log(`  → ${result.text.slice(0, 200).replace(/\n/g, " ")}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\neval-profession-live: ${pass}/${SCENARIOS.length} OK (${Math.round((pass / SCENARIOS.length) * 100)}%)`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
