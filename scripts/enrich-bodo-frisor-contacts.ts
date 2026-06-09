/**
 * Bodø frisør — daglig leder, telefon, Facebook.
 * Kjør: npx tsx scripts/enrich-bodo-frisor-contacts.ts [--shard 0 --shards 25]
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const hasShards = args.some((a) => a === "--shards");

const forwarded = [
  "--kommune",
  "1804",
  "--industry",
  "frisor",
  "--profile",
  "full",
  "--with-facebook",
  ...args,
];
if (!hasShards) forwarded.push("--shards", "25");

const script = resolve(process.cwd(), "scripts/enrich-narvik-bygg-contacts.ts");
const result = spawnSync("npx", ["tsx", script, ...forwarded], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
