/**
 * Send en melding til agent-API med service-nøkkel.
 *
 * Kjør:
 *   npx tsx scripts/agent-chat.ts "Finn frisører i Bodø"
 *   npx tsx scripts/agent-chat.ts --conversation <uuid> "Fortsett søket"
 */
import { existsSync, readFileSync } from "node:fs";
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]): { message: string; conversationId?: string } {
  let conversationId: string | undefined;
  const parts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--conversation" || arg === "-c") {
      conversationId = argv[i + 1];
      i++;
      continue;
    }
    parts.push(arg);
  }

  const message = parts.join(" ").trim();
  if (!message) {
    console.error('Bruk: npx tsx scripts/agent-chat.ts [--conversation <id>] "din melding"');
    process.exit(1);
  }

  return { message, conversationId };
}

async function main(): Promise<void> {
  loadEnvLocal();

  const apiKey = process.env.AGENT_SERVICE_API_KEY?.trim();
  if (!apiKey) {
    console.error("AGENT_SERVICE_API_KEY mangler i .env.local");
    process.exit(1);
  }

  // Lokalt test-script: localhost som standard. Sett AGENT_CHAT_BASE_URL for prod (Vercel).
  const baseUrl = (
    process.env.AGENT_CHAT_BASE_URL?.trim() || "http://localhost:3003"
  ).replace(/\/$/, "");
  const { message, conversationId } = parseArgs(process.argv.slice(2));

  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`HTTP ${response.status}: ${text}`);
    process.exit(1);
  }

  if (!response.body) {
    console.error("Ingen respons-body (SSE)");
    process.exit(1);
  }

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
        } else if (event.type === "text_delta" && typeof event.content === "string") {
          process.stdout.write(event.content);
          assistantText += event.content;
        } else if (event.type === "text" && typeof event.content === "string") {
          process.stdout.write(event.content);
          assistantText += event.content;
        } else if (event.type === "error" && typeof event.message === "string") {
          console.error(`\nFeil: ${event.message}`);
        } else if (event.type === "done" && typeof event.content === "string") {
          if (!assistantText) {
            process.stdout.write(event.content);
            assistantText = event.content;
          }
        }
      } catch {
        // ignorer ugyldige SSE-linjer
      }
    }
  }

  if (!assistantText) {
    console.log("\n(ingen tekst i svaret)");
  } else {
    console.log("");
  }

  if (conversationOut) {
    console.error(`\nconversationId: ${conversationOut}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
