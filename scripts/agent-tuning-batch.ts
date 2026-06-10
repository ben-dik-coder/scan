/**
 * Batch-test av agent-chat med logging til JSONL.
 * Kjør: npx tsx scripts/agent-tuning-batch.ts [--retest-failed]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOG_PATH = resolve(
  process.cwd(),
  process.env.AGENT_TUNING_LOG?.trim() ||
    "scripts/.cache/agent-tuning-session-2.jsonl"
);

const SCENARIOS: Array<{
  id: string;
  prompt: string;
  category: string;
  expect?: (text: string) => { ok: boolean; note?: string };
}> = [
  // Enkle lister
  { id: "L01", category: "liste", prompt: "finn 5 frisører i Bodø", expect: (t) => countOk(t, 3, /fris|hår|klipp|salong/i) },
  { id: "L02", category: "liste", prompt: "10 elektrikere Narvik", expect: (t) => countOk(t, 3, /elektro|elektriker|el-/i) },
  { id: "L03", category: "liste", prompt: "3 advokater Oslo", expect: (t) => advokatOk(t) },
  // Ukjente steder
  { id: "L04", category: "sted", prompt: "finn frisører i Leknes", expect: (t) => hasResults(t) },
  { id: "L05", category: "sted", prompt: "finn frisører i Mo i Rana", expect: (t) => hasResults(t) },
  { id: "L06", category: "sted", prompt: "finn frisører i Harstad", expect: (t) => hasResults(t) },
  // Med krav
  { id: "L07", category: "krav", prompt: "finn 5 frisører i Bodø uten nettside", expect: (t) => hasResults(t) },
  { id: "L08", category: "krav", prompt: "finn frisører i Narvik med telefon", expect: (t) => phoneOk(t) },
  { id: "L09", category: "krav", prompt: "finn frisører i Tromsø med Facebook", expect: (t) => facebookOk(t) },
  // Småord/feil
  { id: "L10", category: "småord", prompt: "byggevare Bodø", expect: (t) => hasResults(t) },
  { id: "L11", category: "småord", prompt: "neglesalong Tromsø", expect: (t) => hasResults(t) },
  // Vanlig prat
  { id: "C01", category: "chat", prompt: "hei", expect: (t) => chatOk(t) },
  { id: "C02", category: "chat", prompt: "hva kan du", expect: (t) => chatOk(t) },
  { id: "C03", category: "chat", prompt: "takk", expect: (t) => chatOk(t) },
  // Edge cases
  { id: "E01", category: "edge", prompt: "finn 5 frisører i Svalbard", expect: (t) => zeroOrPolite(t) },
  { id: "E02", category: "edge", prompt: "finn firma", expect: (t) => ({ ok: /kommune|hvor|sted|område/i.test(t), note: "spør om sted" }) },
  { id: "E03", category: "edge", prompt: "finn 20 rørleggere i Bodø", expect: (t) => hasResults(t) },
  // Flere bransjer
  { id: "L12", category: "liste", prompt: "finn 5 restauranter i Narvik", expect: (t) => hasResults(t) },
  { id: "L13", category: "liste", prompt: "finn 5 tannleger i Tromsø", expect: (t) => hasResults(t) },
  { id: "L14", category: "liste", prompt: "finn 5 rørleggere i Bodø", expect: (t) => hasResults(t) },
  { id: "L15", category: "liste", prompt: "finn 5 eiendomsmeglere i Harstad", expect: (t) => hasResults(t) },
  // Oppfølging (kjøres sekvensielt med conversationId)
  { id: "F01", category: "oppfølging", prompt: "finn 3 frisører i Bodø", expect: (t) => hasResults(t) },
  { id: "F02", category: "oppfølging", prompt: "lagre som liste", expect: (t) => ({ ok: /liste|lagret|lagre/i.test(t), note: "lagre-liste" }) },
  // Flere steder
  { id: "L16", category: "sted", prompt: "finn 5 frisører i Alta", expect: (t) => hasResults(t) },
  { id: "L17", category: "sted", prompt: "finn 5 frisører i Hammerfest", expect: (t) => hasResults(t) },
  { id: "L18", category: "liste", prompt: "finn 5 transportfirma i Bodø", expect: (t) => hasResults(t) },
  { id: "L19", category: "liste", prompt: "finn 5 IT-firma i Tromsø", expect: (t) => hasResults(t) },
  {
    id: "L20",
    category: "liste",
    prompt: "finn 5 regnskapsførere i Oslo",
    expect: (t) => ({
      ok: /regnskap|revisor|økonomi|okonomi/i.test(t) && hasResults(t).ok,
      note: "mangler regnskapsfirma",
    }),
  },
  { id: "L21", category: "liste", prompt: "finn 5 kulturfirma i Narvik", expect: (t) => hasResults(t) },
  { id: "L22", category: "liste", prompt: "finn 5 helsefirma i Bodø", expect: (t) => hasResults(t) },
  { id: "L23", category: "liste", prompt: "finn 5 reklamefirma i Tromsø", expect: (t) => hasResults(t) },
  { id: "L24", category: "liste", prompt: "finn 5 snekkere i Narvik", expect: (t) => hasResults(t) },
  { id: "L25", category: "liste", prompt: "finn 5 malere i Bodø", expect: (t) => hasResults(t) },
  { id: "L26", category: "liste", prompt: "finn 5 hoteller i Harstad", expect: (t) => hasResults(t) },
  { id: "L27", category: "liste", prompt: "finn 5 apotek i Tromsø", expect: (t) => hasResults(t) },
  { id: "L28", category: "liste", prompt: "finn 5 arkitekter i Oslo", expect: (t) => hasResults(t) },
  { id: "L29", category: "liste", prompt: "finn 5 fysioterapeuter i Bodø", expect: (t) => hasResults(t) },
  {
    id: "L30",
    category: "liste",
    prompt: "finn 5 tatoveringsstudio i Tromsø",
    expect: (t) => ({
      ok: /tattoo|tatover/i.test(t) && hasResults(t).ok,
      note: "mangler tattoo/tatover",
    }),
  },
];

function countOk(text: string, min: number, pattern: RegExp): { ok: boolean; note?: string } {
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()) || /orgnr/i.test(l));
  const hasPattern = pattern.test(text);
  const ok = lines.length >= min || (/\d+/.test(text) && hasPattern);
  return { ok, note: ok ? undefined : `for få treff (${lines.length}), mangler mønster` };
}

function hasResults(text: string): { ok: boolean; note?: string } {
  const noResults = /fant ingen|ingen treff|0 firma/i.test(text);
  const hasList = /^\d+\./m.test(text) || /orgnr/i.test(text);
  const hasCount = /fant \d+|her er \d+/i.test(text);
  const ok = !noResults && (hasList || hasCount);
  return { ok, note: ok ? undefined : noResults ? "0 treff" : "mangler konkrete firma" };
}

function advokatOk(text: string): { ok: boolean; note?: string } {
  const bad = /\bIT[\s-]?firma|software|programvare|datakonsulent|drift\b/i.test(text);
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const goodLines = lines.filter((l) => /advokat|juridisk|jurist/i.test(l));
  const ok = goodLines.length >= 2 && !bad && hasResults(text).ok;
  return {
    ok,
    note: bad ? "feil mapping til IT" : goodLines.length < 2 ? "for få advokatfirma" : undefined,
  };
}

function phoneOk(text: string): { ok: boolean; note?: string } {
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const withPhone = lines.filter((l) => /tlf|telefon|\d{8}/i.test(l));
  const ok = lines.length > 0 && withPhone.length === lines.length;
  return { ok, note: ok ? undefined : "ikke alle linjer har telefon" };
}

function facebookOk(text: string): { ok: boolean; note?: string } {
  const hasUrl = /facebook\.com/i.test(text) || /Facebook:/i.test(text);
  const scannedNoFb =
    /skannet \d+/i.test(text) && /fant ingen.*facebook/i.test(text);
  const ok = hasUrl || (hasResults(text).ok && scannedNoFb) || scannedNoFb;
  return { ok, note: ok ? undefined : "mangler Facebook-skann eller URL" };
}

function chatOk(text: string): { ok: boolean; note?: string } {
  const tooLong = text.length > 600;
  const robotic = /Plan:|kommunekode|search_companies/i.test(text);
  const ok = text.length > 5 && !tooLong && !robotic;
  return { ok, note: robotic ? "for robotaktig" : tooLong ? "for langt" : undefined };
}

function zeroOrPolite(text: string): { ok: boolean; note?: string } {
  const ok = /fant ingen|ingen treff|0|svalbard/i.test(text);
  return { ok, note: ok ? undefined : "burde si 0 treff" };
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

async function chat(message: string, conversationId?: string): Promise<{ text: string; conversationId?: string; error?: string }> {
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
        } else if ((event.type === "text_delta" || event.type === "text" || event.type === "done") && typeof event.content === "string") {
          if (event.type !== "done" || !assistantText) assistantText += event.content;
        }
      } catch { /* ignore */ }
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
  const retestFailed = process.argv.includes("--retest-failed");
  const phase = retestFailed ? "retest" : process.argv.includes("--phase2") ? "phase2" : "phase1";
  const onlyIds = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",");

  let scenarios = SCENARIOS;
  if (onlyIds?.length) {
    scenarios = SCENARIOS.filter((s) => onlyIds.includes(s.id));
  } else if (retestFailed && existsSync(LOG_PATH)) {
    const failed = new Set<string>();
    for (const line of readFileSync(LOG_PATH, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as { id?: string; success?: boolean; phase?: string };
        if (e.phase === "phase1" && e.success === false && e.id) failed.add(e.id);
      } catch { /* ignore */ }
    }
    scenarios = SCENARIOS.filter((s) => failed.has(s.id));
    console.log(`Retester ${scenarios.length} feilede scenarioer`);
  }

  let pass = 0;
  let fail = 0;
  let conversationId: string | undefined;

  for (const scenario of scenarios) {
    if (scenario.id === "F02" && !conversationId) continue;

    process.stdout.write(`[${scenario.id}] ${scenario.prompt.slice(0, 50)}... `);
    const start = Date.now();
    let result: { text: string; conversationId?: string; error?: string };

    try {
      result = await chat(scenario.prompt, scenario.id === "F02" ? conversationId : undefined);
    } catch (err) {
      result = { text: "", error: err instanceof Error ? err.message : String(err) };
    }

    if (scenario.id === "F01" && result.conversationId) {
      conversationId = result.conversationId;
    }

    const durationMs = Date.now() - start;
    const evalResult = result.error
      ? { ok: false, note: result.error }
      : scenario.expect
        ? scenario.expect(result.text)
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
      phase,
      id: scenario.id,
      category: scenario.category,
      prompt: scenario.prompt,
      response: result.text.slice(0, 2000),
      success: evalResult.ok,
      issue: evalResult.note ?? null,
      durationMs,
      error: result.error ?? null,
    });

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n${phase}: ${pass} OK, ${fail} FAIL av ${scenarios.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
