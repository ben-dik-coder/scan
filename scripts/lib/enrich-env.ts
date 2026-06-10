import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Enrichment-scripts skal ikke bruke Serper — kun gratis/alternative kilder. */
export function disableSerperForEnrichment(): void {
  process.env.SERPER_DISABLED = "true";
}

export function loadEnrichEnv(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (existsSync(path)) {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
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
  disableSerperForEnrichment();
}
