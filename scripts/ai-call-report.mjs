#!/usr/bin/env node
/**
 * Ukesrapport for Frida — henter ekte samtaler fra ElevenLabs (koster ingen credits).
 *
 *   node scripts/ai-call-report.mjs          # siste 7 dager
 *   node scripts/ai-call-report.mjs 30       # siste 30 dager
 *
 * Viser: antall, varighet, utfall, innvendinger, interesse, og de 5 dårligste samtalene
 * (lytt til disse først — de gir mest læring).
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = env.ELEVENLABS_API_KEY;
const AGENT = env.ELEVENLABS_AGENT_ID;
const days = Number(process.argv[2]) || 7;
const since = Math.floor(Date.now() / 1000) - days * 86400;

const get = async (path) => {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai${path}`, {
    headers: { "xi-api-key": KEY },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};

const list = [];
let cursor = "";
do {
  const page = await get(
    `/conversations?agent_id=${AGENT}&page_size=100&call_start_after_unix=${since}${cursor ? `&cursor=${cursor}` : ""}`
  );
  list.push(...page.conversations);
  cursor = page.has_more ? page.next_cursor : "";
} while (cursor);

const rows = [];
for (const c of list) {
  const d = await get(`/conversations/${c.conversation_id}`);
  const dc = d.analysis?.data_collection_results ?? {};
  const ev = d.analysis?.evaluation_criteria_results ?? {};
  rows.push({
    id: c.conversation_id,
    secs: c.call_duration_secs ?? 0,
    turns: d.transcript?.length ?? 0,
    outcome: dc.outcome?.value ?? "ukjent",
    interest: dc.interest_level?.value ?? "-",
    objection: dc.main_objection?.value ?? "-",
    dnc: dc.do_not_call?.value === true,
    failedCriteria: Object.entries(ev).filter(([, v]) => v.result !== "success").map(([k]) => k),
    version: d.version_id,
    reason: d.metadata?.termination_reason ?? "",
  });
}

const count = (arr, f) => arr.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
const answered = rows.filter((r) => r.secs >= 20);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : "-");

console.log(`\nFrida — siste ${days} dager`);
console.log(`Samtaler: ${rows.length}  |  svart (≥20 s): ${answered.length}  |  snitt-varighet: ${Math.round(answered.reduce((a, r) => a + r.secs, 0) / (answered.length || 1))} s`);
console.log(`Møte-rate (av besvarte): ${pct(answered.filter((r) => r.outcome === "meeting").length, answered.length)}`);
console.log("Utfall:      ", count(rows, (r) => r.outcome));
console.log("Interesse:   ", count(answered, (r) => r.interest));
console.log("Innvending:  ", count(answered, (r) => r.objection));
console.log(`Ba om å ikke bli ringt: ${rows.filter((r) => r.dnc).length}`);
console.log("Ved ≤ 20 s (rask avvisning):", pct(rows.filter((r) => r.secs > 0 && r.secs < 20).length, rows.length));

const worst = rows
  .filter((r) => r.failedCriteria.length || r.reason.includes("error"))
  .sort((a, b) => b.failedCriteria.length - a.failedCriteria.length)
  .slice(0, 5);
console.log("\nLytt til disse først:");
for (const r of worst) {
  console.log(` - ${r.id}  ${r.secs}s  feilet: ${r.failedCriteria.join(", ") || r.reason}`);
}
console.log("\nÅpne i ElevenLabs: https://elevenlabs.io/app/agents/history\n");
