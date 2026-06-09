/**
 * 25 parallelle Facebook-agenter for Bodø frisør.
 * Kjør: npx tsx scripts/run-bodo-frisor-facebook-25.ts
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SHARDS = 25;

async function main() {
  const logDir = resolve(process.cwd(), "scripts/.cache/bodo-frisor-fb-logs");
  mkdirSync(logDir, { recursive: true });

  console.log(`Starter ${SHARDS} Facebook-agenter for Bodø frisør…\n`);

  const children: ChildProcessWithoutNullStreams[] = [];

  for (let shard = 0; shard < SHARDS; shard++) {
    const logPath = resolve(logDir, `shard-${shard}.log`);
    const logChunks: string[] = [];

    const child = spawn(
      "npx",
      [
        "tsx",
        "scripts/enrich-frisor-facebook.ts",
        "--kommune",
        "1804",
        "--industry",
        "frisor",
        "--shard",
        String(shard),
        "--shards",
        String(SHARDS),
        "--delay",
        "350",
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );

    child.stdout.on("data", (buf: Buffer) => {
      const text = buf.toString();
      logChunks.push(text);
      process.stdout.write(`[fb-${shard}] ${text}`);
    });
    child.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString();
      logChunks.push(text);
      process.stderr.write(`[fb-${shard}] ${text}`);
    });
    child.on("close", (code) => {
      writeFileSync(logPath, logChunks.join(""), "utf8");
      console.log(`\n[fb-${shard}] ferdig (exit ${code ?? "?"})`);
    });

    children.push(child);
  }

  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolvePromise) => {
          child.on("exit", () => resolvePromise());
        })
    )
  );

  console.log(`\nAlle ${SHARDS} Facebook-agenter ferdig.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
