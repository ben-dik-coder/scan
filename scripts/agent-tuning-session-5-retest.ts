/** Retest feilede scenarioer fra session 5 (etter fiks). */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOG = resolve(process.cwd(), "scripts/.cache/agent-tuning-session-5-retest.jsonl");

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

function paginationOk(text: string): boolean {
  if (/^\d+\./m.test(text) || /her er \d+/i.test(text)) return true;
  if (/fant ingen flere/i.test(text) && /du har sett \d+ fra før/i.test(text)) return true;
  return false;
}

const TESTS = [
  {
    id: "S01",
    turns: ["finn grillbar i Norge", "finn 10 til"],
    check: (i: number, t: string) => (i === 0 ? /grill|orgnr/i.test(t) : paginationOk(t)),
  },
  {
    id: "S02",
    turns: ["finn 5 frisører i Tromsø", "finn 3 til"],
    check: (i: number, t: string) => (i === 0 ? /fris|orgnr/i.test(t) : paginationOk(t)),
  },
  {
    id: "S03",
    turns: ["finn 5 elektrikere i Narvik", "finn 5 til"],
    check: (i: number, t: string) => (i === 0 ? /elektro|orgnr/i.test(t) : paginationOk(t)),
  },
  {
    id: "S07",
    turns: ["finn 10 gode leads jeg kan selge nettside til i Norge"],
    check: (_i: number, t: string) =>
      (/^\d+\./m.test(t) && !/webbyrå|webbyra|IT-firma/i.test(t)) ||
      /hvilket område|kommune|sted/i.test(t),
  },
];

async function main(): Promise<void> {
  loadEnvLocal();
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  let pass = 0;
  let fail = 0;

  for (const test of TESTS) {
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
      console.log(result.text.slice(0, 220).replace(/\n/g, " "));
      appendFileSync(
        LOG,
        JSON.stringify({ ts: new Date().toISOString(), id: `${test.id}-T${i + 1}`, prompt, response: result.text.slice(0, 2000), success: ok }) + "\n"
      );
    }
  }
  console.log(`\nRetest: ${pass} OK, ${fail} FAIL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
