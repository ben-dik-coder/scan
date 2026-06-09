/**
 * Holder Bodø frisør-jobbene i gang til alle 212 er ferdig.
 * Kjør: nohup npx tsx scripts/run-bodo-frisor-until-done.ts >> scripts/.cache/bodo-frisor-watchdog.log 2>&1 &
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOTAL = 212;
const POLL_MS = 30_000;
const CACHE = resolve(process.cwd(), "scripts/.cache");

function countProgress(prefix: string): number {
  let done = 0;
  for (const f of readdirSync(CACHE)) {
    if (!f.startsWith(prefix)) continue;
    const p = JSON.parse(readFileSync(resolve(CACHE, f), "utf8")) as { done?: string[] };
    done += (p.done ?? []).length;
  }
  return done;
}

function isRunnerUp(script: string): boolean {
  try {
    const ps = execSync(`pgrep -fl "${script}"`, { encoding: "utf8" });
    return ps.split("\n").some((line) => line.includes(script) && !line.includes("until-done"));
  } catch {
    return false;
  }
}

function startRunner(script: string, label: string): ChildProcess {
  console.log(`[${new Date().toISOString()}] Starter ${label}…`);
  return spawn("npx", ["tsx", script], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
}

function ensureRunner(script: string, label: string, done: number) {
  if (done >= TOTAL) {
    console.log(`[${new Date().toISOString()}] ${label}: ferdig (${done}/${TOTAL})`);
    return;
  }
  if (isRunnerUp(script)) {
    console.log(`[${new Date().toISOString()}] ${label}: kjører (${done}/${TOTAL})`);
    return;
  }
  const child = startRunner(script, label);
  child.unref();
}

async function main() {
  writeFileSync(resolve(CACHE, "bodo-frisor-watchdog.pid"), String(process.pid));
  console.log(`[${new Date().toISOString()}] Watchdog startet (pid ${process.pid})`);

  for (;;) {
    const contactDone = countProgress("bodo-frisor-enrich-progress-shard-");
    const fbDone = countProgress("bodo-frisor-facebook-progress-shard-");

    ensureRunner("scripts/run-bodo-frisor-25.ts", "Kontakt", contactDone);
    ensureRunner("scripts/run-bodo-frisor-facebook-25.ts", "Facebook", fbDone);

    if (contactDone >= TOTAL && fbDone >= TOTAL) {
      console.log(`[${new Date().toISOString()}] Alle ${TOTAL} firma ferdig. Watchdog avslutter.`);
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
