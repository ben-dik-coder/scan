/** Batch 2: ekstra edge-cases for session 5. */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LOG = resolve(process.cwd(), "scripts/.cache/agent-tuning-session-5.jsonl");

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

const META = /\b(ikke webbyrå|filtrerte bort|search_companies|kommunekode)\b/i;

async function chat(message: string, conversationId?: string) {
  const apiKey = process.env.AGENT_SERVICE_API_KEY?.trim();
  const baseUrl = (process.env.AGENT_CHAT_BASE_URL?.trim() || "http://localhost:3003").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ message, cancelPrevious: true, ...(conversationId ? { conversationId } : {}) }),
  });
  if (!response.ok) throw new Error(await response.text());
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let conversationOut: string | undefined;
  for await (const chunk of response.body!) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (event.type === "conversation" && typeof event.conversationId === "string") {
          conversationOut = event.conversationId;
        } else if (
          (event.type === "text_delta" || event.type === "text" || event.type === "done") &&
          typeof event.content === "string"
        ) {
          if (event.type !== "done" || !text) text += event.content;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { text: text.trim(), conversationId: conversationOut };
}

const TESTS = [
  { id: "B01", prompt: "finn 5 gode leads uten nettside i Bodø", check: (t: string) => !META.test(t) && (/\d+\./.test(t) || /fant \d+/i.test(t)) },
  { id: "B02", prompt: "finn 3 regnskapsførere i Mo i Rana", check: (t: string) => /regnskap|revisor/i.test(t) && !META.test(t) },
  { id: "B03", prompt: "finn 5 snekkere i Lillehammer", check: (t: string) => /snekker|tømrer|tomrer|bygg/i.test(t) },
  { id: "B04", turns: ["finn 5 frisører i Harstad", "skann 10"], check: (i: number, t: string) => i === 0 ? /fris/i.test(t) : /skann|nettside|maks|5|orgnr/i.test(t) && !/mener du/i.test(t) },
  { id: "B05", prompt: "finn 5 apotek i Longyearbyen", check: (t: string) => /apotek|fant ingen|fant bare|0/i.test(t) },
];

async function main(): Promise<void> {
  loadEnvLocal();
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  let pass = 0;
  let fail = 0;

  for (const test of TESTS) {
    if ("turns" in test && test.turns) {
      let conversationId: string | undefined;
      for (let i = 0; i < test.turns.length; i++) {
        const prompt = test.turns[i];
        const start = Date.now();
        const result = await chat(prompt, conversationId);
        conversationId = result.conversationId ?? conversationId;
        const ok = test.check(i, result.text);
        if (ok) pass++;
        else fail++;
        console.log(`${test.id}-T${i + 1}: ${ok ? "OK" : "FAIL"} (${Date.now() - start}ms)`);
        appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), session: 5, id: `${test.id}-T${i + 1}`, prompt, response: result.text.slice(0, 2000), success: ok, batch: 2 }) + "\n");
      }
    } else {
      const prompt = test.prompt!;
      const start = Date.now();
      const result = await chat(prompt);
      const ok = test.check(result.text);
      if (ok) pass++;
      else fail++;
      console.log(`${test.id}: ${ok ? "OK" : "FAIL"} (${Date.now() - start}ms)`);
      appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), session: 5, id: test.id, prompt, response: result.text.slice(0, 2000), success: ok, batch: 2 }) + "\n");
    }
  }
  console.log(`\nBatch 2: ${pass} OK, ${fail} FAIL`);
}

main().catch(console.error);
