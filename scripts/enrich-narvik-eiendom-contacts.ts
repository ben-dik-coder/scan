/**
 * Fyll inn telefon, e-post og daglig leder for Narvik eiendom (NACE 68, 81.10).
 * Ingen SerpAPI — kun Brreg, 1881, Gulesider, nettside og eieroppslag.
 *
 * Kjør: npx tsx scripts/enrich-narvik-eiendom-contacts.ts [--shard 0 --shards 20]
 * Shard: npx tsx scripts/enrich-narvik-eiendom-contacts.ts --shard 0 --shards 20
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const hasIndustry = args.some((a, i) => a === "--industry" && args[i + 1]);
const hasShards = args.some((a) => a === "--shards");

const forwarded = [...args];
if (!hasIndustry) forwarded.unshift("--industry", "eiendom");
if (!hasShards) forwarded.push("--shards", "20");

const script = resolve(process.cwd(), "scripts/enrich-narvik-bygg-contacts.ts");
const result = spawnSync("npx", ["tsx", script, ...forwarded], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
