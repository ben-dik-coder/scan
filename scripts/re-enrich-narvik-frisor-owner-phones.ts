/** 1881 eiersøk kun for Narvik frisør uten telefon. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = resolve(process.cwd(), "scripts/re-enrich-narvik-1881-owner-phones.ts");
const backup = target + ".bak-frisor-run";
const src = readFileSync(target, "utf8");
const patched = src.replace(
  /const INDUSTRIES = \[[^\]]+\] as const;/,
  'const INDUSTRIES = ["frisor"] as const;'
);
writeFileSync(backup, src);
writeFileSync(target, patched);
const result = spawnSync("npx", ["tsx", target], { stdio: "inherit", cwd: process.cwd() });
writeFileSync(target, readFileSync(backup, "utf8"));
if (existsSync(backup)) unlinkSync(backup);
process.exit(result.status ?? 1);
