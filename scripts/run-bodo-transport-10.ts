/**
 * Start 10 parallelle enrich-jobber for Bodø transport og logistikk.
 * Kjør: npx tsx scripts/run-bodo-transport-10.ts
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SHARDS = 10;

async function main() {
  const logDir = resolve(process.cwd(), "scripts/.cache/bodo-transport-logs");
  mkdirSync(logDir, { recursive: true });

  console.log(`Starter ${SHARDS} parallelle agenter for Bodø transport…`);
  console.log(`Logger: ${logDir}\n`);

  const children: ChildProcessWithoutNullStreams[] = [];

  for (let shard = 0; shard < SHARDS; shard++) {
    const logPath = resolve(logDir, `shard-${shard}.log`);
    const logChunks: string[] = [];

    const child = spawn(
      "npx",
      [
        "tsx",
        "scripts/enrich-bodo-transport-contacts.ts",
        "--shard",
        String(shard),
        "--shards",
        String(SHARDS),
        "--delay",
        "350",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    child.stdout.on("data", (buf: Buffer) => {
      const text = buf.toString();
      logChunks.push(text);
      process.stdout.write(`[${shard}] ${text}`);
    });
    child.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString();
      logChunks.push(text);
      process.stderr.write(`[${shard}] ${text}`);
    });
    child.on("close", (code) => {
      writeFileSync(logPath, logChunks.join(""), "utf8");
      console.log(`\n[shard ${shard}] ferdig (exit ${code ?? "?"})`);
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

  console.log(`\nAlle ${SHARDS} shards ferdig.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
