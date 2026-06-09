/**
 * Bodø transport og logistikk — daglig leder, telefon og e-post.
 * Kjør: npx tsx scripts/enrich-bodo-transport-contacts.ts [--shard 0 --shards 10]
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const hasShards = args.some((a) => a === "--shards");

const forwarded = [
  "--kommune",
  "1804",
  "--industry",
  "transport",
  "--profile",
  "full",
  ...args,
];
if (!hasShards) forwarded.push("--shards", "10");

const script = resolve(process.cwd(), "scripts/enrich-narvik-bygg-contacts.ts");
const result = spawnSync("npx", ["tsx", script, ...forwarded], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
