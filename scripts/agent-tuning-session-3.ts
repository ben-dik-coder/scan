/**
 * Session 3: varierte samtaler — naturlig dialog, edge cases, kvalitet.
 * Kjør: npx tsx scripts/agent-tuning-session-3.ts
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LOG_PATH = resolve(process.cwd(), "scripts/.cache/agent-tuning-session-3.jsonl");

type Turn = { prompt: string; expect?: (text: string, ctx: Ctx) => EvalResult };
type Scenario = {
  id: string;
  category: string;
  turns: Turn[];
};

type Ctx = { priorResponse?: string };
type EvalResult = { ok: boolean; note?: string };

const SCENARIOS: Scenario[] = [
  {
    id: "D01",
    category: "dialog",
    turns: [
      { prompt: "hei", expect: (t) => chatOk(t) },
      {
        prompt: "finn 3 frisører i Bodø",
        expect: (t) => hasResults(t, /fris|hår|klipp|salong/i),
      },
      {
        prompt: "finn 2 til",
        expect: (t) => hasResults(t, /fris|hår|klipp|salong/i),
      },
    ],
  },
  {
    id: "D02",
    category: "dialog",
    turns: [
      {
        prompt: "finn 3 advokater i Oslo",
        expect: (t) => advokatOk(t),
      },
      {
        prompt: "lagre som liste",
        expect: (t) => ({
          ok: /lagret|liste|målgruppe|orgnr|bekreft|de siste/i.test(t),
          note: "lagre-oppfølging",
        }),
      },
    ],
  },
  {
    id: "D03",
    category: "dialog",
    turns: [
      { prompt: "hva kan du hjelpe med?", expect: (t) => chatOk(t) },
      { prompt: "nei takk", expect: (t) => politeDecline(t) },
    ],
  },
  {
    id: "E01",
    category: "edge",
    turns: [
      {
        prompt: "finn noe interessant",
        expect: (t) => ({
          ok: /kommune|sted|bransje|hva slags|hvor/i.test(t),
          note: "spør om avklaring",
        }),
      },
    ],
  },
  {
    id: "E02",
    category: "edge",
    turns: [
      {
        prompt: "finn 3 frisører i Tromsø",
        expect: (t) => hasResults(t, /fris|hår|klipp/i),
      },
      {
        prompt: "egentlig, finn 3 tannleger i samme by",
        expect: (t) => hasResults(t, /tannlege|tann/i),
      },
    ],
  },
  {
    id: "E03",
    category: "edge",
    turns: [
      {
        prompt: "finn 5 frisor i bergn",
        expect: (t) => hasResults(t, /fris|hår|klipp/i),
      },
    ],
  },
  {
    id: "E04",
    category: "edge",
    turns: [
      { prompt: "takk for hjelpen", expect: (t) => chatOk(t) },
      {
        prompt: "finn firma",
        expect: (t) => ({
          ok: /kommune|sted|bransje|hva slags|hvor/i.test(t),
          note: "spør om sted",
        }),
      },
    ],
  },
  {
    id: "Q01",
    category: "kvalitet",
    turns: [
      {
        prompt: "finn 5 frisører i Bergen",
        expect: (t) => hasResults(t, /fris|hår|klipp|salong/i),
      },
    ],
  },
  {
    id: "Q02",
    category: "kvalitet",
    turns: [
      {
        prompt: "3 advokater Oslo",
        expect: (t) => advokatOk(t),
      },
    ],
  },
  {
    id: "Q03",
    category: "kvalitet",
    turns: [
      {
        prompt: "finn 5 frisører i Narvik uten nettside",
        expect: (t) => ({
          ok: /uten nettside|skannet|0 treff|ingen.*nettside|fant \d+/i.test(t) && t.length > 80,
          note: "uten-nettside-flyt",
        }),
      },
    ],
  },
  {
    id: "N01",
    category: "naturlig",
    turns: [
      { prompt: "yo", expect: (t) => chatOk(t) },
      {
        prompt: "har du frisører i Harstad?",
        expect: (t) => hasResults(t, /fris|hår|klipp/i),
      },
    ],
  },
  {
    id: "N02",
    category: "naturlig",
    turns: [
      {
        prompt: "byggevare Mo i Rana",
        expect: (t) => hasResults(t, /bygg|vare|anlegg|service/i),
      },
      {
        prompt: "skann nettside på de to første",
        expect: (t) => ({
          ok: /skann|nettside|https|fant|orgnr/i.test(t),
          note: "skann-oppfølging",
        }),
      },
    ],
  },
  {
    id: "N03",
    category: "naturlig",
    turns: [
      {
        prompt: "finn 5 elektrikere Narvik",
        expect: (t) => hasResults(t, /elektro|elektriker|el-/i),
      },
      {
        prompt: "hvilken av disse mangler telefon?",
        expect: (t) => ({
          ok: t.length > 30 && !/search_companies|kommunekode/i.test(t),
          note: "naturlig oppfølging",
        }),
      },
    ],
  },
  {
    id: "E05",
    category: "edge",
    turns: [
      {
        prompt: "finn 5 apotek i Tromsø",
        expect: (t) => ({
          ok: hasResults(t).ok || /fant ingen|fant bare \d+/i.test(t),
          note: "apotek-tromsø",
        }),
      },
    ],
  },
  {
    id: "D04",
    category: "dialog",
    turns: [
      {
        prompt: "finn 3 regnskapsførere i Oslo",
        expect: (t) => ({
          ok: /regnskap|revisor|økonomi/i.test(t) && hasResults(t).ok,
          note: "regnskap-relevans",
        }),
      },
      { prompt: "nei, det var feil — advokater i stedet", expect: (t) => advokatOk(t) },
    ],
  },
];

function hasResults(text: string, pattern?: RegExp): EvalResult {
  const noResults = /fant ingen|ingen treff|0 firma/i.test(text);
  const hasList = /^\d+\./m.test(text) || /orgnr/i.test(text);
  const hasCount = /fant \d+|her er \d+/i.test(text);
  const patternOk = pattern ? pattern.test(text) : true;
  const ok = !noResults && (hasList || hasCount) && patternOk;
  return {
    ok,
    note: ok ? undefined : noResults ? "0 treff" : pattern && !patternOk ? "feil bransje" : "mangler firma",
  };
}

function advokatOk(text: string): EvalResult {
  const bad = /\bIT[\s-]?firma|software|programvare|datakonsulent|drift\b/i.test(text);
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const goodLines = lines.filter((l) => /advokat|juridisk|jurist/i.test(l));
  const ok = goodLines.length >= 2 && !bad && hasResults(text).ok;
  return {
    ok,
    note: bad ? "feil mapping" : goodLines.length < 2 ? "for få advokater" : undefined,
  };
}

function chatOk(text: string): EvalResult {
  const tooLong = text.length > 700;
  const robotic = /Plan:|kommunekode|search_companies|tool/i.test(text);
  const ok = text.length > 5 && !tooLong && !robotic;
  return { ok, note: robotic ? "robotaktig" : tooLong ? "for langt" : undefined };
}

function politeDecline(text: string): EvalResult {
  const ok = /ok|greit|si fra|hjelpe|når du/i.test(text) && !/search_companies/i.test(text);
  return { ok, note: ok ? undefined : "burde avslutte pent" };
}

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

async function chat(
  message: string,
  conversationId?: string
): Promise<{ text: string; conversationId?: string; error?: string }> {
  const apiKey = process.env.AGENT_SERVICE_API_KEY?.trim();
  const baseUrl = (process.env.AGENT_CHAT_BASE_URL?.trim() || "http://localhost:3003").replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      message,
      cancelPrevious: true,
      ...(conversationId ? { conversationId } : {}),
    }),
  });

  if (!response.ok) {
    return { text: "", error: `HTTP ${response.status}: ${await response.text()}` };
  }
  if (!response.body) return { text: "", error: "Ingen body" };

  const decoder = new TextDecoder();
  let buffer = "";
  let conversationOut: string | undefined;
  let assistantText = "";

  for await (const chunk of response.body) {
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
          if (event.type !== "done" || !assistantText) assistantText += event.content;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { text: assistantText.trim(), conversationId: conversationOut };
}

function logEntry(entry: Record<string, unknown>): void {
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (existsSync(LOG_PATH)) {
    // fresh session — archive hint only in console
    console.log(`Appender til ${LOG_PATH}`);
  }

  let pass = 0;
  let fail = 0;

  for (const scenario of SCENARIOS) {
    let conversationId: string | undefined;
    let priorResponse: string | undefined;

    for (let turnIdx = 0; turnIdx < scenario.turns.length; turnIdx++) {
      const turn = scenario.turns[turnIdx];
      const turnId = `${scenario.id}-T${turnIdx + 1}`;
      process.stdout.write(`[${turnId}] ${turn.prompt.slice(0, 55)}... `);
      const start = Date.now();

      let result: { text: string; conversationId?: string; error?: string };
      try {
        result = await chat(turn.prompt, conversationId);
      } catch (err) {
        result = { text: "", error: err instanceof Error ? err.message : String(err) };
      }

      if (result.conversationId) conversationId = result.conversationId;

      const durationMs = Date.now() - start;
      const evalResult = result.error
        ? { ok: false, note: result.error }
        : turn.expect
          ? turn.expect(result.text, { priorResponse })
          : { ok: result.text.length > 0 };

      if (evalResult.ok) {
        pass++;
        console.log(`OK (${durationMs}ms)`);
      } else {
        fail++;
        console.log(`FAIL: ${evalResult.note ?? "ukjent"} (${durationMs}ms)`);
      }

      logEntry({
        ts: new Date().toISOString(),
        session: 3,
        id: turnId,
        scenarioId: scenario.id,
        category: scenario.category,
        turn: turnIdx + 1,
        prompt: turn.prompt,
        response: result.text.slice(0, 2500),
        success: evalResult.ok,
        issue: evalResult.note ?? null,
        durationMs,
        error: result.error ?? null,
        conversationId: conversationId ?? null,
      });

      priorResponse = result.text;
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log(`\nSession 3: ${pass} OK, ${fail} FAIL av ${pass + fail} turns`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
