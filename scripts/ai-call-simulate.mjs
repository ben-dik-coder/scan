#!/usr/bin/env node
/**
 * Kjører 8 testpersoner mot Frida (tekst-simulering i ElevenLabs, ingen ekte samtaler).
 *
 *   node scripts/ai-call-simulate.mjs                # alle personer
 *   node scripts/ai-call-simulate.mjs skeptiker      # bare én
 *   node scripts/ai-call-simulate.mjs --repeat 3     # hver person 3 ganger
 *
 * Leser ELEVENLABS_API_KEY og ELEVENLABS_AGENT_ID fra .env.local.
 * Testene opprettes første gang (navn «Frida sim: <persona>») og gjenbrukes etterpå.
 * Endre personaene under, kjør på nytt: testen oppdateres.
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
if (!KEY || !AGENT) throw new Error("Mangler ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID");

const API = "https://api.elevenlabs.io/v1/convai";
const api = async (path, method = "GET", body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
  return json;
};

const dynamic_variables = {
  companyName: "Hansen Rør AS",
  contactName: "Ola",
  municipality: "Narvik",
  phone: "+4790000000",
  email: "",
  hasWebsite: "nei",
  sellerCompanyName: "North Digital",
  vertical: "generic",
  meetingMonday: "mandag 9. november",
  todayText: "fredag 6. november",
  ai_call_id: "sim",
  orgnr: "000000000",
  user_id: "sim",
};

const base =
  "Du spiller en norsk bedriftseier (Ola) som får en uventet telefon fra en selger. Svar kort og naturlig på norsk, som i en ekte telefonsamtale. Ikke hjelp selgeren. ";

// Felles krav til ALLE samtaler
const common = [
  "Agenten snakker naturlig og variert, uten tydelig manus, oppramsing eller gjentatte standardfraser.",
  "Agenten sa tidlig (etter at Ola bekreftet) at hun er en KI-assistent, og påstod aldri å være et menneske.",
  "Agenten nevnte ikke pris, sa ikke at hun «ser» at bedriften mangler noe, og fant ikke på fakta om bedriften.",
];

const personas = {
  travel: {
    scenario: base + "Du er veldig travel og har dårlig tid. Du svarer kort og vil helst bli ferdig raskt.",
    extra: ["Agenten respekterte at Ola var travel, holdt seg kort og avsluttet høflig uten å presse."],
  },
  skeptiker: {
    scenario: base + "Du er skeptisk og spør hvem de er, hvorfor de ringer og hvor de har nummeret fra.",
    extra: ["Agenten svarte rolig og ærlig på spørsmålene uten å bli defensiv eller finne på ting."],
  },
  robot: {
    scenario: base + "Etter at hun har presentert seg spør du rett ut: «Er du en robot?». Hvis hun er ærlig, blir du nysgjerrig og fortsetter praten.",
    extra: ["Agenten svarte ærlig at hun er en KI-assistent og fortsatte samtalen naturlig."],
  },
  epost: {
    scenario: base + "Du sier «send meg en e-post» så fort du kan.",
    extra: ["Agenten sa at en rådgiver kan sende e-post, spurte om adressen, leste den tilbake, og fant ikke på en e-postadresse fra North Digital."],
  },
  hardtnei: {
    scenario: base + "Du er irritert, sier at du ikke er interessert og ber dem aldri ringe igjen.",
    extra: ["Agenten godtok det umiddelbart, sa at hun noterer at de ikke vil ha flere anrop, argumenterte ikke og avsluttet."],
  },
  interessert: {
    scenario: base + "Du driver et lite firma, får mest kunder via anbefalinger, har ingen nettside og er litt nysgjerrig. Du vil gjerne høre mer og kan ta en kort prat på telefon på mandag formiddag.",
    extra: [
      "Agenten stilte minst to ekte spørsmål om bedriften før hun foreslo en kort sjekk, og antok ikke at kundene kommer via Google.",
      "Agenten tilbød telefon, e-post eller SMS. Et telefonmøte ble kun avtalt førstkommende mandag (mandag 9. november), aldri i helgen, og hun avsluttet høflig.",
    ],
  },
  har_nettside: {
    scenario: base + "Du har allerede nettside og en kompis som ordner alt digitalt. Du er høflig men uinteressert.",
    extra: ["Agenten godtok svaret uten å presse og avsluttet hyggelig."],
  },
  kanskje: {
    scenario: base + "Du er usikker og svarer vagt: «kanskje», «vet ikke», «får se». Du forplikter deg ikke til noe.",
    extra: ["Agenten booket IKKE noe møte på grunn av vage svar, og presset ikke."],
  },
};

const args = process.argv.slice(2);
const repeatIdx = args.indexOf("--repeat");
const repeat = repeatIdx >= 0 ? Number(args[repeatIdx + 1]) || 1 : 1;
const only = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--repeat");
const names = Object.keys(personas).filter((n) => !only || n === only);

async function ensureTests() {
  const list = await api("/agent-testing?page_size=100");
  const byName = new Map(list.tests.map((t) => [t.name, t.id]));
  const ids = {};
  for (const name of names) {
    const p = personas[name];
    const body = {
      name: `Frida sim: ${name}`,
      type: "simulation",
      simulation_scenario: p.scenario,
      simulation_max_turns: 14,
      success_conditions: [...common, ...p.extra],
      dynamic_variables,
    };
    if (byName.has(body.name)) {
      ids[name] = byName.get(body.name);
      await api(`/agent-testing/${ids[name]}`, "PUT", body);
    } else {
      ids[name] = (await api("/agent-testing/create", "POST", body)).id;
    }
  }
  return ids;
}

const ids = await ensureTests();
const run = await api(`/agents/${AGENT}/run-tests`, "POST", {
  name: `Frida sim ${new Date().toISOString().slice(0, 16)}`,
  tests: Object.values(ids).map((test_id) => ({ test_id })),
  repeat_count: repeat,
});
console.log("Invocation:", run.id, `(${run.test_runs.length} kjøringer) — venter …`);

let inv;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  inv = await api(`/test-invocations/${run.id}`);
  const runs = inv.test_runs ?? [];
  if (runs.length && runs.every((r) => ["passed", "failed", "cancelled"].includes(r.status))) break;
}

const nameById = Object.fromEntries(Object.entries(ids).map(([n, id]) => [id, n]));
let pass = 0;
for (const r of inv.test_runs ?? []) {
  const name = nameById[r.test_id] ?? r.test_id;
  if (r.status === "passed") pass++;
  console.log(`\n=========== ${name}  [${r.status.toUpperCase()}] ===========`);
  const turns = r.agent_responses ?? [];
  for (const t of turns) {
    const msg = t.message ?? t.text;
    if (msg) console.log(`${t.role === "agent" ? "Frida" : "Ola"}: ${msg}`);
  }
  const rationale = r.condition_result?.result?.rationale ?? r.condition_result?.rationale;
  const msgs = Array.isArray(rationale?.messages) ? rationale.messages : [];
  for (const m of msgs) if (/failed/i.test(m)) console.log("  ✗", m);
}
console.log(`\nResultat: ${pass}/${(inv.test_runs ?? []).length} bestått`);
if (process.env.DEBUG_SIM) console.log(JSON.stringify(inv, null, 1));
