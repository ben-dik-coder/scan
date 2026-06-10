/**
 * Session 5: hard stress — pagination, obscure industries, scans, edge cases.
 * Kjør: npx tsx scripts/agent-tuning-session-5.ts
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LOG_PATH = resolve(process.cwd(), "scripts/.cache/agent-tuning-session-5.jsonl");

type Turn = { prompt: string; expect?: (text: string, ctx: Ctx) => EvalResult };
type Scenario = { id: string; category: string; turns: Turn[] };
type Ctx = { priorResponse?: string };
type EvalResult = { ok: boolean; note?: string };

const META_LEAK =
  /\b(ikke webbyrå|ikke it|filtrerte bort|filtrert bort|ekskluderte|meta-tekst|search_companies|kommunekode|tool)\b/i;
const ROBOTIC = /Plan:|search_companies|kommunekode|tool_call/i;

const SCENARIOS: Scenario[] = [
  // Search & context
  {
    id: "S01",
    category: "pagination",
    turns: [
      { prompt: "finn grillbar i Norge", expect: (t) => hasResults(t, /grill|bbq|burger|kebab|mat/i) },
      { prompt: "finn 10 til", expect: (t) => paginationOk(t, /grill|bbq|burger|kebab|mat/i) },
    ],
  },
  {
    id: "S02",
    category: "pagination",
    turns: [
      { prompt: "finn 5 frisører i Tromsø", expect: (t) => hasResults(t, /fris|hår|klipp|salong|barber/i) },
      { prompt: "finn 3 til", expect: (t) => paginationOk(t, /fris|hår|klipp|salong|barber/i) },
    ],
  },
  {
    id: "S03",
    category: "pagination",
    turns: [
      { prompt: "finn 5 elektrikere i Narvik", expect: (t) => hasResults(t, /elektro|elektriker|el-/i) },
      { prompt: "finn 5 til", expect: (t) => paginationOk(t, /elektro|elektriker|el-/i) },
    ],
  },
  {
    id: "S04",
    category: "context-switch",
    turns: [
      { prompt: "finn 3 frisører i Alta", expect: (t) => hasResults(t, /fris|hår|klipp/i) },
      { prompt: "samme by men advokater", expect: (t) => advokatOk(t) },
    ],
  },
  {
    id: "S05",
    category: "typo",
    turns: [{ prompt: "finn 5 frisor i bergn", expect: (t) => hasResults(t, /fris|hår|klipp|barber/i) }],
  },
  {
    id: "S06",
    category: "kvalitet",
    turns: [
      {
        prompt: "finn meg 5 malere i bodø",
        expect: (t) => ({
          ok:
            hasResults(t).ok &&
            /maler|malermester|maling|sparkel/i.test(t) &&
            !/\bhåndverk\b|\bhandverk\b|\bsnekker\b|\bmurer\b/i.test(t.split("\n").slice(0, 8).join("\n")),
          note: "må være malere ikke generisk håndverk",
        }),
      },
    ],
  },
  {
    id: "S07",
    category: "web-leads",
    turns: [
      {
        prompt: "finn 10 gode leads jeg kan selge nettside til i Norge",
        expect: (t) => websiteSalesOk(t),
      },
    ],
  },
  {
    id: "S08",
    category: "obscure",
    turns: [{ prompt: "finn 5 grillbar i Bergen", expect: (t) => hasResults(t, /grill|bbq|burger|kebab|mat/i) }],
  },
  {
    id: "S09",
    category: "obscure",
    turns: [{ prompt: "finn 3 tatovering i Oslo", expect: (t) => hasResults(t, /tattoo|tatuering|tatover/i) }],
  },
  {
    id: "S10",
    category: "obscure",
    turns: [{ prompt: "finn 3 neglesalong i Trondheim", expect: (t) => hasResults(t, /negle|nail|spa|skjønnhet|beauty/i) }],
  },
  {
    id: "S11",
    category: "nationwide",
    turns: [
      { prompt: "finn 5 rørleggere i Norge", expect: (t) => hasResults(t, /rør|vvs|rørlegger/i) },
      { prompt: "fra hele landet", expect: (t) => paginationOk(t, /rør|vvs|rørlegger/i) },
    ],
  },

  // Scan flows
  {
    id: "SC01",
    category: "scan",
    turns: [
      { prompt: "finn 5 byggevare i Mo i Rana", expect: (t) => hasResults(t, /bygg|vare|anlegg|service/i) },
      {
        prompt: "skann de to første",
        expect: (t) => ({
          ok: /skann|nettside|orgnr|ingen egen|har nettside|facebook/i.test(t) && !/mener du/i.test(t),
          note: "skann-oppfølging",
        }),
      },
    ],
  },
  {
    id: "SC02",
    category: "scan",
    turns: [
      { prompt: "finn 8 frisører i Bodø", expect: (t) => hasResults(t, /fris|hår|klipp/i) },
      {
        prompt: "skann de neste 5",
        expect: (t) => ({
          ok: /skann|nettside|orgnr|ingen egen|har nettside/i.test(t) && t.length > 40,
          note: "skann-neste",
        }),
      },
    ],
  },

  // Proactive actions
  {
    id: "P01",
    category: "proactive",
    turns: [
      { prompt: "finn 3 frisører i Harstad", expect: (t) => hasResults(t, /fris|hår|klipp/i) },
      {
        prompt: "lagre som liste",
        expect: (t) => ({
          ok: /lagret|liste|målgruppe|Lagrede målgrupper/i.test(t) && !/hvilken resultatliste/i.test(t),
          note: "lagre-oppfølging",
        }),
      },
    ],
  },
  {
    id: "P02",
    category: "proactive",
    turns: [
      { prompt: "finn 3 tannleger i Stavanger", expect: (t) => hasResults(t, /tannlege|tann/i) },
      {
        prompt: "lagre listen",
        expect: (t) => ({
          ok: /lagret|liste|målgruppe/i.test(t) && !/hvilken/i.test(t),
          note: "lagre-listen",
        }),
      },
    ],
  },

  // Edge cases
  {
    id: "E01",
    category: "edge",
    turns: [
      {
        prompt: "finn 5 apotek i Vardø",
        expect: (t) => ({
          ok: hasResults(t).ok || /fant ingen|fant bare|0 firma/i.test(t),
          note: "tomt eller få treff ok",
        }),
      },
    ],
  },
  {
    id: "E02",
    category: "edge",
    turns: [
      { prompt: "hei", expect: (t) => chatOk(t) },
      { prompt: "ja", expect: (t) => chatOk(t) },
      { prompt: "nei", expect: (t) => chatOk(t) },
      { prompt: "takk", expect: (t) => chatOk(t) },
    ],
  },
  {
    id: "E03",
    category: "edge",
    turns: [
      {
        prompt: "finn noe",
        expect: (t) => ({
          ok: /kommune|sted|bransje|hva slags|hvor/i.test(t),
          note: "spør om avklaring",
        }),
      },
    ],
  },
  {
    id: "E04",
    category: "edge",
    turns: [
      {
        prompt: "finn 5 frisører i Narvik uten nettside",
        expect: (t) => ({
          ok: /uten nettside|skannet|ingen.*nettside|fant \d+|orgnr/i.test(t) && !META_LEAK.test(t),
          note: "uten-nettside-flyt",
        }),
      },
    ],
  },
  {
    id: "E05",
    category: "meta",
    turns: [
      {
        prompt: "finn 5 gode leads uten nettside i Bodø",
        expect: (t) => ({
          ok: (hasResults(t).ok || /fant \d+/i.test(t)) && !META_LEAK.test(t),
          note: "ingen meta-tekst",
        }),
      },
    ],
  },
  {
    id: "E06",
    category: "edge",
    turns: [
      { prompt: "finn 3 advokater i Oslo", expect: (t) => advokatOk(t) },
      { prompt: "hvilken har telefon?", expect: (t) => ({ ok: t.length > 20 && !ROBOTIC.test(t), note: "naturlig oppfølging" }) },
    ],
  },
];

function hasResults(text: string, pattern?: RegExp): EvalResult {
  const noResults = /fant ingen|ingen treff|0 firma/i.test(text);
  const hasList = /^\d+\./m.test(text) || /orgnr/i.test(text);
  const hasCount = /fant \d+|her er \d+/i.test(text);
  const patternOk = pattern ? pattern.test(text) : true;
  const metaOk = !META_LEAK.test(text);
  const ok = !noResults && (hasList || hasCount) && patternOk && metaOk;
  return {
    ok,
    note: ok
      ? undefined
      : META_LEAK.test(text)
        ? "meta-tekst lekket"
        : noResults
          ? "0 treff"
          : pattern && !patternOk
            ? "feil bransje"
            : "mangler firma",
  };
}

function paginationOk(text: string, pattern?: RegExp): EvalResult {
  const exhausted =
    /fant ingen flere/i.test(text) &&
    /du har sett \d+ fra før/i.test(text) &&
    !/søket tok for lang tid/i.test(text);
  if (exhausted) return { ok: true, note: "uttmattet pool — ok svar" };

  const base = hasResults(text, pattern);
  if (!base.ok) return base;
  const hanging = /søker firma|vent litt/i.test(text) && !/^\d+\./m.test(text);
  const scopeAsk = /hele landet|snevre inn/i.test(text) && !/^\d+\./m.test(text);
  if (hanging) return { ok: false, note: "henger på søker" };
  if (scopeAsk) return { ok: false, note: "scope-spør uten resultat" };
  return base;
}

function advokatOk(text: string): EvalResult {
  const bad = /\bIT[\s-]?firma|software|programvare|datakonsulent|drift\b/i.test(text);
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const goodLines = lines.filter((l) => /advokat|juridisk|jurist/i.test(l));
  const ok =
    goodLines.length >= 2 &&
    !bad &&
    !META_LEAK.test(text) &&
    (hasResults(text).ok || /lagret|liste/i.test(text));
  return { ok, note: bad ? "feil mapping" : goodLines.length < 2 ? "for få advokater" : META_LEAK.test(text) ? "meta-tekst" : undefined };
}

function websiteSalesOk(text: string): EvalResult {
  const competitor =
    /\b(webbyrå|webbyra|nettsidebyrå|digitalbyrå|reklamebyrå|IT[\s-]?firma|programvare|software)\b/i.test(
      text
    );
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const ok =
    lines.length >= 3 &&
    !competitor &&
    !META_LEAK.test(text) &&
    (hasResults(text).ok || /fant \d+/i.test(text));
  return {
    ok,
    note: competitor ? "webbyrå i leads" : META_LEAK.test(text) ? "meta-tekst" : lines.length < 3 ? "for få leads" : undefined,
  };
}

function chatOk(text: string): EvalResult {
  const tooLong = text.length > 700;
  const robotic = ROBOTIC.test(text);
  const ok = text.length > 5 && !tooLong && !robotic && !META_LEAK.test(text);
  return { ok, note: robotic ? "robotaktig" : tooLong ? "for langt" : META_LEAK.test(text) ? "meta-tekst" : undefined };
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

async function chat(message: string, conversationId?: string) {
  const apiKey = process.env.AGENT_SERVICE_API_KEY?.trim();
  const baseUrl = (process.env.AGENT_CHAT_BASE_URL?.trim() || "http://localhost:3003").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ message, cancelPrevious: true, ...(conversationId ? { conversationId } : {}) }),
  });
  if (!response.ok) return { text: "", error: `HTTP ${response.status}: ${await response.text()}` };
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
        console.log(`  → ${result.text.slice(0, 180).replace(/\n/g, " ")}`);
      }

      logEntry({
        ts: new Date().toISOString(),
        session: 5,
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
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(
    `\nSession 5: ${pass} OK, ${fail} FAIL av ${pass + fail} turns (${Math.round((pass / (pass + fail)) * 100)}% pass)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
