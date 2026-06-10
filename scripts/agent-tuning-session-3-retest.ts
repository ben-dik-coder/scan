/** Retest av feilede scenarioer fra session 3. */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

async function main(): Promise<void> {
  loadEnvLocal();
  const log = resolve(process.cwd(), "scripts/.cache/agent-tuning-session-3-retest.jsonl");
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });

  const tests: Array<{ id: string; turns: string[]; check: (turn: number, text: string) => boolean }> = [
    {
      id: "D01",
      turns: ["hei", "finn 3 frisører i Bodø", "finn 2 til"],
      check: (turn, text) =>
        turn < 3 || (/fris|orgnr/i.test(text) && !/mente du/i.test(text)),
    },
    {
      id: "E02",
      turns: ["finn 3 frisører i Tromsø", "egentlig, finn 3 tannleger i samme by"],
      check: (turn, text) =>
        turn < 2 || (/tannlege|tann/i.test(text) && !/samme by.*finnes ikke/i.test(text)),
    },
    {
      id: "E03",
      turns: ["finn 5 frisor i bergn"],
      check: (_turn, text) => /fris|orgnr|bergen/i.test(text),
    },
    {
      id: "D04",
      turns: ["finn 3 regnskapsførere i Oslo", "nei, det var feil — advokater i stedet"],
      check: (turn, text) =>
        turn < 2 || (/advokat/i.test(text) && /orgnr|935001684|936937225|935987717/i.test(text)),
    },
  ];

  let pass = 0;
  let fail = 0;

  for (const test of tests) {
    let conversationId: string | undefined;
    for (let i = 0; i < test.turns.length; i++) {
      const prompt = test.turns[i];
      const start = Date.now();
      const result = await chat(prompt, conversationId);
      conversationId = result.conversationId ?? conversationId;
      const ok = test.check(i + 1, result.text);
      if (ok) pass++;
      else fail++;
      console.log(`${test.id}-T${i + 1}: ${ok ? "OK" : "FAIL"} (${Date.now() - start}ms)`);
      console.log(result.text.slice(0, 180).replace(/\n/g, " "));
      appendFileSync(
        log,
        JSON.stringify({
          ts: new Date().toISOString(),
          id: `${test.id}-T${i + 1}`,
          prompt,
          response: result.text.slice(0, 1500),
          success: ok,
        }) + "\n"
      );
    }
  }

  console.log(`\nRetest: ${pass} OK, ${fail} FAIL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
