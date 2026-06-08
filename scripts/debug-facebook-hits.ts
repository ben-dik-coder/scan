import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { searchSerper } from "../src/lib/website-scan/serper.ts";
import { pickFacebookFromHits } from "../src/lib/website-scan/social-profiles.ts";
import { companyGeoPlaces } from "../src/lib/brreg/geo-place.ts";

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

const cases = process.argv.slice(2).length
  ? [{ name: process.argv[2]!, place: process.argv[3] ?? "NARVIK", q: process.argv[4] ?? `${process.argv[2]} site:facebook.com` }]
  : [
      { name: "NARVIK FRISØR AS", place: "NARVIK", q: "NARVIK FRISØR Narvik site:facebook.com" },
      { name: "HEADLINE FRISØR AS", place: "NARVIK", q: "HEADLINE FRISØR Narvik site:facebook.com" },
      { name: "RENÉES SALONG AS", place: "NARVIK", q: "Renées Salong Narvik site:facebook.com" },
      { name: "SAX FRISØR V/INGRID JACOBSEN", place: "NARVIK", q: "SAX frisør Narvik site:facebook.com" },
      { name: "RAVINE SYKLER AS", place: "KRISTIANSAND S", q: "RAVINE SYKLER Kristiansand site:facebook.com" },
      { name: "SEEME CARE AS", place: "FREDRIKSTAD", q: "SEEME CARE Fredrikstad site:facebook.com" },
      { name: "MAX BURGER BODØ AS", place: "BODØ", q: "MAX BURGER Bodø site:facebook.com" },
    ];

async function main() {
  for (const c of cases) {
    const hits = await searchSerper(c.q, { num: 10 });
    const geoPlaces = companyGeoPlaces({
      municipality_name: c.place,
      city: c.place,
    });
    const pick = pickFacebookFromHits(hits, c.name, c.place, { geoPlaces });
    console.log("\n===", c.name, "===");
    console.log("query:", c.q);
    console.log("pick:", pick.url, pick.confidence);
    for (const h of hits) {
      if (/facebook/i.test(h.link)) {
        console.log(" -", h.title, "|", h.link);
      }
    }
  }
}

main();
