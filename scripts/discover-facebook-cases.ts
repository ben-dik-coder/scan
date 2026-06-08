/**
 * Finn verifiserte Facebook-sider for norske bedrifter via Serper.
 * Kjør: npx tsx scripts/discover-facebook-cases.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { searchSerper } from "../src/lib/website-scan/serper.ts";
import {
  buildFacebookSearchQueries,
  normalizeFacebookUrl,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles.ts";
import { dedupeHits } from "../src/lib/website-scan/parse-results.ts";
import { companyGeoPlaces } from "../src/lib/brreg/geo-place.ts";
import { MAX_FALLBACK_SOCIAL_QUERIES, SOCIAL_SERP_NUM } from "../src/lib/website-scan/scan-api-budget.ts";

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

const CANDIDATES = [
  { name: "SHIP O HOI TATTOO REMY ANDRE MYRENG OTTESEN", municipality_name: "BODØ", orgnr: "913213440" },
  { name: "NARVIK FRISØR AS", municipality_name: "NARVIK" },
  { name: "NITAS SPA & MASSASJE AS", municipality_name: "BODØ", orgnr: "926440179" },
  { name: "VIRVEL NARVIK AS", municipality_name: "NARVIK" },
  { name: "GLOW BY ELENA AS", municipality_name: "NARVIK" },
  { name: "HEADLINE FRISØR AS", municipality_name: "NARVIK" },
  { name: "MARIA FRISØR AS", municipality_name: "NARVIK" },
  { name: "QAHRHOM FRISØR AS", municipality_name: "NARVIK" },
  { name: "LIME FRISØR AS", municipality_name: "NARVIK", email: "post@limefrisor.no" },
  { name: "GLAMOUR HAIRSTYLE FRISØR AS", municipality_name: "NARVIK" },
  { name: "KLIPPEN FRISØR AS", municipality_name: "NARVIK" },
  { name: "TRIXIE FRISØR AS", municipality_name: "NARVIK" },
  { name: "HÅRSTRÅET FRISØR NARVIK AS", municipality_name: "NARVIK" },
  { name: "FAME HÅRDESIGN AS", municipality_name: "NARVIK" },
  { name: "PEPPES PIZZA BODØ AS", municipality_name: "BODØ" },
  { name: "PEPPES PIZZA NARVIK AS", municipality_name: "NARVIK" },
  { name: "NORDLAND TEATER AS", municipality_name: "BODØ" },
  { name: "NORD UNIVERSITET", municipality_name: "BODØ" },
  { name: "POLAR PARK AS", municipality_name: "BARDU" },
  { name: "NARVIK MUSEUM AS", municipality_name: "NARVIK" },
  { name: "EDVARDSEN TRAFIKKSKOLE AS", municipality_name: "NARVIK" },
  { name: "ZAVANNA AMFI NARVIK AS", municipality_name: "NARVIK" },
  { name: "BUNNPRIS GOURMET AMFI NARVIK AS", municipality_name: "NARVIK" },
  { name: "TARALDSVIK MASKIN AS", municipality_name: "NARVIK" },
  { name: "RAVINE SYKLER AS", municipality_name: "KRISTIANSAND S" },
  { name: "LUCKY CUTS BY ARIANA HAVNEVIK RIISE", municipality_name: "ÅLESUND" },
  { name: "MASSIVO AS", municipality_name: "OSLO" },
  { name: "SEEME CARE AS", municipality_name: "FREDRIKSTAD" },
  { name: "AQ PARTNER QUESADA", municipality_name: "KRISTIANSAND S" },
  { name: "BURGASM BORN HUNGRY AS", municipality_name: "BODØ" },
  { name: "MAX BURGER BODØ AS", municipality_name: "BODØ" },
  { name: "BODØ NU AS", municipality_name: "BODØ" },
  { name: "OFOTEN BIL AS", municipality_name: "NARVIK" },
  { name: "SPAR FINBEKKEN AS", municipality_name: "NARVIK" },
  { name: "ORIS DENTAL AS", municipality_name: "NARVIK" },
  { name: "BALLANGEN SVØMMEHALL AS", municipality_name: "NARVIK" },
  { name: "ST1 BALLANGEN AS", municipality_name: "NARVIK" },
  { name: "TAKSTFABRIKKEN AS", municipality_name: "NARVIK" },
  { name: "SALONGEN DAME OG HERREFRISØR Tone Saboh", municipality_name: "NARVIK" },
  { name: "RENÉES SALONG AS", municipality_name: "NARVIK" },
];

async function discover(company: (typeof CANDIDATES)[0]) {
  const queries = buildFacebookSearchQueries(company);
  const geoPlaces = companyGeoPlaces(company);
  const allHits: SearchHit[] = [];

  for (const q of queries.slice(0, MAX_FALLBACK_SOCIAL_QUERIES)) {
    const batch = await searchSerper(q, { num: SOCIAL_SERP_NUM }).catch(() => []);
    allHits.push(...batch);
    await new Promise((r) => setTimeout(r, 250));
  }

  const merged = dedupeHits(allHits);
  const pick = pickFacebookFromHits(merged, company.name, company.municipality_name, {
    geoPlaces,
  });

  return { pick, queries: queries.slice(0, 4), hitCount: merged.length };
}

type SearchHit = { title: string; link: string };

async function main() {
  const found: Array<{ company: (typeof CANDIDATES)[0]; url: string; confidence: string }> = [];
  const missing: typeof CANDIDATES = [];

  for (const c of CANDIDATES) {
    const { pick } = await discover(c);
    if (pick.url) {
      found.push({ company: c, url: pick.url, confidence: pick.confidence });
      console.log(`✓ ${c.name} → ${pick.url}`);
    } else {
      missing.push(c);
      console.log(`✗ ${c.name}`);
    }
  }

  console.log(`\n${found.length}/${CANDIDATES.length} funnet`);
  console.log("\n// Test cases:");
  for (const f of found.slice(0, 30)) {
    const url = normalizeFacebookUrl(f.url) ?? f.url;
    const slug = url.replace("https://www.facebook.com/", "").replace("profile.php?id=", "");
    console.log(JSON.stringify({
      name: f.company.name,
      municipality_name: f.company.municipality_name,
      orgnr: f.company.orgnr,
      email: f.company.email,
      expectedFacebook: slug,
    }) + ",");
  }
}

main();
