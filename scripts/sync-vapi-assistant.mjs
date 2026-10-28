#!/usr/bin/env node
/**
 * Sync ONLY manus (system prompt + firstMessage) from prompt.ts → Vapi.
 *
 * NEVER touches: voice, transcriber, tools, hooks, analysis, name, etc.
 *
 * Usage:
 *   VAPI_API_KEY=... npm run sync:vapi
 *   VAPI_API_KEY=... npm run sync:vapi -- --id <assistantId>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const token = process.env.VAPI_API_KEY || process.env.VAPI_TOKEN;
if (!token) {
  console.error("Missing VAPI_API_KEY (or VAPI_TOKEN)");
  process.exit(1);
}

const DEFAULT_IDS = [
  process.env.VAPI_ASSISTANT_ID,
  "a7722bef-6ae6-4a78-a132-9b7c6452ed76", // North Digital REN
  "4102c981-9120-4929-95d2-9399d1cf0c42", // Talk
  "8d2af5f0-5a69-459b-b92e-b350e6092130", // Live
  "b26adb74-29cd-4394-bfe5-df6d541574c9", // Outbound
].filter(Boolean);

const idArgIdx = process.argv.indexOf("--id");
const ids =
  idArgIdx >= 0 && process.argv[idArgIdx + 1]
    ? [process.argv[idArgIdx + 1]]
    : [...new Set(DEFAULT_IDS)];

const promptPath = path.join(root, "src/lib/ai-call/prompt.ts");
const src = fs.readFileSync(promptPath, "utf8");

const block = src.match(/return `(ROLLE[\s\S]*?)`;\n\}/);
if (!block) {
  console.error("Could not find ROLLE prompt block in prompt.ts");
  process.exit(1);
}

let prompt = block[1];
for (const [a, b] of [
  ["${vars.sellerCompanyName}", "North Digital"],
  ["${seller}", "North Digital"],
  ["${vars.companyName}", "{{companyName}}"],
  ["${place}", "{{municipality}}"],
  ["${contact}", "{{contactName}}"],
  ["${firstName}", "{{contactName}}"],
  ["${vars.phone}", "{{phone}}"],
]) {
  prompt = prompt.split(a).join(b);
}
prompt = prompt.replace(/\$\{[^}]+\}/g, "");

const firstMatch = src.match(/return `Hei[^`]+ringer\?`;/);
const firstMessage =
  firstMatch?.[0]
    ?.replace(/^return `/, "")
    .replace(/`;$/, "")
    .replace(/\$\{seller\}/g, "North Digital") ||
  "Hei! Jeg er en digital assistent som ringer på vegne av North Digital. Har du ti sekunder, så skal jeg forklare kort hvorfor jeg ringer?";

function voiceFingerprint(voice) {
  if (!voice || typeof voice !== "object") return "(none)";
  return [
    voice.provider,
    voice.voiceId,
    voice.model,
    voice.speed,
    voice.stability,
    voice.similarityBoost,
    voice.style,
    voice.optimizeStreamingLatency,
    voice.cachingEnabled,
  ].join("|");
}

async function getAssistant(id) {
  const res = await fetch(`https://api.vapi.ai/assistant/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${id} GET ${res.status} ${data?.message || ""}`);
  return data;
}

async function syncOne(id) {
  const before = await getAssistant(id);
  const beforeVoice = voiceFingerprint(before.voice);
  const beforeModel = before.model || {};

  // ONLY manus fields — keep existing model provider/model/temp when possible
  const payload = {
    firstMessage,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: beforeModel.provider || "openai",
      model: beforeModel.model || "gpt-4o-2024-11-20:westeurope",
      temperature:
        typeof beforeModel.temperature === "number"
          ? beforeModel.temperature
          : 0.55,
      maxTokens:
        typeof beforeModel.maxTokens === "number" ? beforeModel.maxTokens : 180,
      messages: [{ role: "system", content: prompt }],
      ...(beforeModel.toolIds ? { toolIds: beforeModel.toolIds } : {}),
      ...(beforeModel.tools ? { tools: beforeModel.tools } : {}),
    },
  };

  // Safety: never allow voice keys in payload
  if ("voice" in payload || "transcriber" in payload) {
    throw new Error("Refusing to sync — voice/transcriber must not be sent");
  }

  const res = await fetch(`https://api.vapi.ai/assistant/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const after = await res.json();
  if (!res.ok) {
    console.error("FAIL", id, res.status, after?.message || after);
    return;
  }

  const afterVoice = voiceFingerprint(after.voice);
  const voiceOk = beforeVoice === afterVoice;
  console.log(
    voiceOk ? "OK" : "WARN-VOICE-CHANGED",
    after.name,
    after.latestVersion,
    "voice:",
    voiceOk ? "uendret" : `${beforeVoice} → ${afterVoice}`
  );
}

console.log("Syncer kun manus (ikke stemme)…");
for (const id of ids) {
  await syncOne(id);
}
console.log(
  "\nTips: Sett stemmen i Vapi-UI og Publish den. Sync rører ikke voice."
);
