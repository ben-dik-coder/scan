/**
 * Fyll inn telefon og e-post for Narvik IT og konsulenter (NACE 62, 63, 70, 74, 58, 73).
 * Ingen SerpAPI — kun Brreg, 1881, Gulesider, nettside og eieroppslag.
 *
 * Kjør: npx tsx scripts/enrich-narvik-it-contacts.ts [--shard 0 --shards 6]
 * Shard: npx tsx scripts/enrich-narvik-it-contacts.ts --shard 0 --shards 6
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const hasIndustry = args.some((a, i) => a === "--industry" && args[i + 1]);
const hasShards = args.some((a) => a === "--shards");

const forwarded = [...args];
if (!hasIndustry) forwarded.unshift("--industry", "it");
if (!hasShards) forwarded.push("--shards", "6");

const script = resolve(process.cwd(), "scripts/enrich-narvik-bygg-contacts.ts");
const result = spawnSync("npx", ["tsx", script, ...forwarded], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
