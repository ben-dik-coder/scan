import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildWebsiteSearchQueries,
  companyMatchesResult,
  normalizeDomain,
  pickBestWebsite,
} from "../src/lib/website-scan/parse-results.ts";
import {
  searchSerper,
  searchSerperForWebsite,
} from "../src/lib/website-scan/serper.ts";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v[0] === '"' && v.at(-1) === '"') ||
      (v[0] === "'" && v.at(-1) === "'")
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const company = {
  name: process.argv[2] ?? "NARVIK FRISØR AS",
  municipality_name: process.argv[3] ?? "NARVIK",
  city: process.argv[3] ?? "NARVIK",
  industry_code: "96.210",
};

async function main() {
  console.log("Company:", company.name, "@", company.municipality_name);
  const queries = buildWebsiteSearchQueries(company);
  console.log("Queries:", queries.slice(0, 5));

  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    console.error("SERPER_API_KEY missing");
    process.exit(1);
  }

  const q = queries[0]!;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "no", hl: "no", num: 10 }),
  });
  const raw = (await res.json()) as {
    organic?: Array<Record<string, unknown>>;
    message?: string;
  };
  console.log("\nRaw status:", res.status);
  console.log(
    "Raw organic[0] keys:",
    raw.organic?.[0] ? Object.keys(raw.organic[0]) : "none"
  );
  console.log("Organic count:", raw.organic?.length ?? 0);
  if (raw.organic?.[0]) {
    console.log("First hit:", JSON.stringify(raw.organic[0], null, 2));
  }

  const hits = await searchSerper(q, { num: 15 });
  console.log("\nsearchSerper hits:", hits.length);
  for (const h of hits.slice(0, 8)) {
    const match = companyMatchesResult(h.title, h.link, company.name);
    console.log(` - [${match ? "MATCH" : "no"}] ${h.title?.slice(0, 55)} | ${normalizeDomain(h.link)}`);
  }

  const { hits: allHits, queries: usedQueries } =
    await searchSerperForWebsite(company);
  console.log("\nsearchSerperForWebsite queries:", usedQueries);
  console.log("Total hits:", allHits.length);

  const pick = pickBestWebsite(allHits, company.name, {
    municipalityName: company.municipality_name,
  });
  console.log("\npickBestWebsite:", {
    domain: pick.websiteDomain,
    confidence: pick.confidence,
    hasWebsite: pick.hasWebsite,
    url: pick.websiteUrl,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
