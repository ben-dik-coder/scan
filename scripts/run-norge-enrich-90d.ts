/**
 * Kjør systematisk kontaktberikelse for alle kommuner i Norge — kun firma registrert siste N dager.
 *
 * Start i bakgrunnen:
 *   nohup npx tsx scripts/run-norge-enrich-90d.ts >> scripts/.cache/norge-90d-systematic.log 2>&1 &
 *
 * Fortsett etter avbrudd (hopper over ferdige kommuner):
 *   npx tsx scripts/run-norge-enrich-90d.ts --resume
 *
 * Start fra bestemt kommune:
 *   npx tsx scripts/run-norge-enrich-90d.ts --from 5001
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchKommuner } from "../src/lib/brreg/client.ts";
import { loadEnrichEnv } from "./lib/enrich-env.ts";
import { slugForKommune } from "./lib/kommune-slug.ts";

const DEFAULT_DAYS = 90;
const STATE_FILE = resolve(process.cwd(), "scripts/.cache", "norge-90d-state.json");

type State = {
  days: number;
  completed: string[];
  startedAt: string;
  updatedAt: string;
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let days = DEFAULT_DAYS;
  let resume = false;
  let fromKommune = "";
  let shards = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) days = Number(args[++i]);
    else if (args[i] === "--resume") resume = true;
    else if (args[i] === "--from" && args[i + 1]) fromKommune = args[++i];
    else if (args[i] === "--shards" && args[i + 1]) shards = Number(args[++i]);
  }
  return { days, resume, fromKommune, shards };
}

function loadState(days: number): State {
  if (!existsSync(STATE_FILE)) {
    return {
      days,
      completed: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
    if (raw.days !== days) {
      log(`State-fil er for ${raw.days}d — starter på nytt for ${days}d`);
      return {
        days,
        completed: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return raw;
  } catch {
    return {
      days,
      completed: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

function saveState(state: State) {
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function runKommuneSystematic(
  kommune: string,
  slug: string,
  label: string,
  days: number,
  shards: number
): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const argv = [
      "tsx",
      "scripts/run-kommune-enrich-systematic.ts",
      "--kommune",
      kommune,
      "--slug",
      slug,
      "--label",
      label,
      "--days",
      String(days),
      "--shards",
      String(shards),
    ];
    log(`Starter ${label} (${kommune}) · slug ${slug}`);
    const child = spawn("npx", argv, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolveExit(code ?? 1));
  });
}

async function main() {
  loadEnrichEnv();
  const { days, resume, fromKommune, shards } = parseArgs();
  mkdirSync(resolve(process.cwd(), "scripts/.cache"), { recursive: true });

  const kommuner = await fetchKommuner();
  kommuner.sort((a, b) => a.nummer.localeCompare(b.nummer));

  let state = resume ? loadState(days) : loadState(days);
  if (!resume) {
    state = {
      days,
      completed: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const completed = new Set(state.completed);
  let started = !fromKommune;

  log(
    `Norge ${days}d: ${kommuner.length} kommuner · ${completed.size} allerede ferdig · ${shards} shards`
  );

  for (const k of kommuner) {
    if (!started) {
      if (k.nummer === fromKommune) started = true;
      else continue;
    }
    if (completed.has(k.nummer)) {
      log(`Hopper over ${k.navn} (${k.nummer}) — allerede ferdig`);
      continue;
    }

    const slug = slugForKommune(k.nummer);
    const code = await runKommuneSystematic(k.nummer, slug, k.navn, days, shards);
    if (code !== 0) {
      log(`FEIL: ${k.navn} (${k.nummer}) avsluttet med kode ${code}`);
      process.exit(code);
    }

    completed.add(k.nummer);
    state.completed = [...completed];
    saveState(state);
    log(`Ferdig ${k.navn} (${k.nummer}) — ${completed.size}/${kommuner.length}`);
  }

  log(`Alle ${kommuner.length} kommuner ferdig for siste ${days} dager.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
