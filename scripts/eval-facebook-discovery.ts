/**
 * Evaluer Facebook-discovery (Serper + pickFacebookFromHits).
 * Kjør: npx tsx scripts/eval-facebook-discovery.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildFacebookSearchQueries,
  normalizeFacebookUrl,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles.ts";
import {
  companySearchNameVariants,
  dedupeHits,
  type SearchHit,
} from "../src/lib/website-scan/parse-results.ts";
import { searchSerper } from "../src/lib/website-scan/serper.ts";
import { companyGeoPlaces } from "../src/lib/brreg/geo-place.ts";
import {
  MAX_FALLBACK_SOCIAL_QUERIES,
  SOCIAL_SERP_NUM,
} from "../src/lib/website-scan/scan-api-budget.ts";

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

type TestCase = {
  name: string;
  municipality_name: string;
  city?: string;
  orgnr?: string;
  email?: string | null;
  expectedFacebook: string;
  displayName?: string;
  websiteDomain?: string;
};

/** 30 ekte norske bedrifter — forventet FB verifisert via Serper (jun 2026). */
export const FACEBOOK_EVAL_CASES: TestCase[] = [
  {
    name: "SHIP O HOI TATTOO REMY ANDRE MYRENG OTTESEN",
    municipality_name: "BODØ",
    city: "BODØ",
    orgnr: "913213440",
    expectedFacebook: "shipohoitattoo",
  },
  {
    name: "NARVIK FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100083062134005",
  },
  {
    name: "NITAS SPA & MASSASJE AS",
    municipality_name: "BODØ",
    city: "BODØ",
    orgnr: "926440179",
    expectedFacebook: "100077873316244",
  },
  {
    name: "VIRVEL NARVIK AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100077243748335",
  },
  {
    name: "GLOW BY ELENA AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "glowbyelena",
  },
  {
    name: "HEADLINE FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "headline.no",
  },
  {
    name: "QAHRHOM FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100066430936342",
  },
  {
    name: "LIME FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    email: "post@limefrisor.no",
    expectedFacebook: "limefrisor",
  },
  {
    name: "GLAMOUR HAIRSTYLE FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "Glamournarvik",
  },
  {
    name: "KLIPPEN FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "KlippenFrisorAs",
  },
  {
    name: "TRIXIE FRISØR AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100063736926142",
  },
  {
    name: "HÅRSTRÅET FRISØR NARVIK AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100063563710560",
  },
  {
    name: "FAME HÅRDESIGN AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100063997932230",
  },
  {
    name: "PEPPES PIZZA BODØ AS",
    municipality_name: "BODØ",
    city: "BODØ",
    expectedFacebook: "PeppesPizzaBodo",
  },
  {
    name: "PEPPES PIZZA NARVIK AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "PeppesPizzaNarvik",
  },
  {
    name: "NORDLAND TEATER AS",
    municipality_name: "BODØ",
    city: "BODØ",
    expectedFacebook: "nordlandteaterNT",
  },
  {
    name: "NORD UNIVERSITET",
    municipality_name: "BODØ",
    city: "BODØ",
    expectedFacebook: "Norduniversitet",
  },
  {
    name: "POLAR PARK AS",
    municipality_name: "BARDU",
    city: "BARDU",
    expectedFacebook: "polarparknorway",
  },
  {
    name: "NARVIK MUSEUM AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "narvik.museum",
  },
  {
    name: "EDVARDSEN TRAFIKKSKOLE AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "edvardsentrafikkskole",
  },
  {
    name: "ZAVANNA AMFI NARVIK AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "ZavannaAmfiNarvik",
  },
  {
    name: "BUNNPRIS GOURMET AMFI NARVIK AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "BunnprisGourmetAmfiNarvik",
  },
  {
    name: "TARALDSVIK MASKIN AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "TaraldsvikAS",
  },
  {
    name: "LUCKY CUTS BY ARIANA HAVNEVIK RIISE",
    municipality_name: "ÅLESUND",
    city: "ÅLESUND",
    expectedFacebook: "Luckycutshundesalong",
  },
  {
    name: "BURGASM BORN HUNGRY AS",
    municipality_name: "BODØ",
    city: "BODØ",
    expectedFacebook: "burgasmbornhungry",
  },
  {
    name: "ST1 BALLANGEN AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "100040376394360",
  },
  {
    name: "BODØ NU AS",
    municipality_name: "BODØ",
    city: "BODØ",
    expectedFacebook: "bodonu",
  },
  {
    name: "SPAR FINBEKKEN AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "sparfinbekken",
  },
  {
    name: "ORIS DENTAL AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "OrisDentalNarvik",
  },
  {
    name: "BALLANGEN SVØMMEHALL AS",
    municipality_name: "NARVIK",
    city: "NARVIK",
    expectedFacebook: "BallangenSvommehall",
  },
  {
    name: "SUNDBY 'S RØRLEGGERBEDRIFT",
    municipality_name: "BARDU",
    city: "BARDU",
    orgnr: "931443429",
    expectedFacebook: "100093686296313",
  },
];

function normalizeExpected(expected: string): string {
  const trimmed = expected.trim();
  if (trimmed.startsWith("http")) {
    return normalizeFacebookUrl(trimmed) ?? trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `https://www.facebook.com/${trimmed}`;
  }
  return `https://www.facebook.com/${trimmed}`;
}

function urlMatchesExpected(got: string | null, expected: string): boolean {
  if (!got) return false;
  const normGot = (normalizeFacebookUrl(got) ?? got).toLowerCase();
  const normExp = normalizeExpected(expected).toLowerCase();
  if (normGot === normExp) return true;
  const slug = expected
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
    .split("/")[0]!
    .toLowerCase();
  return normGot.includes(slug);
}

function alternateNames(name: string, displayName?: string): string[] {
  const alts: string[] = [];
  if (displayName?.trim() && displayName.trim() !== name.trim()) {
    alts.push(displayName.trim());
  }
  for (const v of companySearchNameVariants(name)) {
    if (v !== name.trim() && !alts.includes(v)) alts.push(v);
  }
  return alts;
}

function socialFoundInHits(
  hits: SearchHit[],
  company: TestCase,
  alternate: string[]
): boolean {
  const geoPlaces = companyGeoPlaces(company);
  const geoLabel = company.municipality_name;
  const pick = pickFacebookFromHits(hits, company.name, geoLabel, {
    geoPlaces,
    alternateNames: alternate,
  });
  if (pick.url) return true;
  for (const alt of alternate) {
    if (pickFacebookFromHits(hits, alt, geoLabel, { geoPlaces }).url) return true;
  }
  return false;
}

async function discoverFacebook(
  company: TestCase,
  context?: { displayName?: string; websiteDomain?: string }
): Promise<{
  url: string | null;
  confidence: string;
  queriesRun: number;
  queries: string[];
  hitCount: number;
}> {
  const queries = buildFacebookSearchQueries(company, context);
  const alternate = alternateNames(company.name, context?.displayName);
  const allHits: SearchHit[] = [];
  let queriesRun = 0;
  const geoPlaces = companyGeoPlaces(company);
  const geoLabel = company.municipality_name;

  for (const q of queries.slice(0, MAX_FALLBACK_SOCIAL_QUERIES)) {
    queriesRun++;
    const batch = await searchSerper(q, { num: SOCIAL_SERP_NUM }).catch(
      () => [] as SearchHit[]
    );
    allHits.push(...batch);
    const merged = dedupeHits(allHits);
    if (socialFoundInHits(merged, company, alternate)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const merged = dedupeHits(allHits);
  let pick = pickFacebookFromHits(merged, company.name, geoLabel, {
    geoPlaces,
    alternateNames: alternate,
  });

  if (!pick.url) {
    for (const alt of alternate) {
      const altPick = pickFacebookFromHits(merged, alt, geoLabel, { geoPlaces });
      if (altPick.url) {
        pick = altPick;
        break;
      }
    }
  }

  return {
    url: pick.url,
    confidence: pick.confidence,
    queriesRun,
    queries: queries.slice(0, MAX_FALLBACK_SOCIAL_QUERIES),
    hitCount: merged.length,
  };
}

async function main() {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    console.error("SERPER_API_KEY mangler i .env.local");
    process.exit(1);
  }

  console.log(
    `Facebook discovery eval — ${FACEBOOK_EVAL_CASES.length} bedrifter\n`
  );

  let passed = 0;
  let failed = 0;
  const failures: Array<{
    name: string;
    expected: string;
    got: string | null;
    queries: string[];
    queriesRun: number;
    hitCount: number;
    confidence: string;
  }> = [];

  for (const tc of FACEBOOK_EVAL_CASES) {
    const result = await discoverFacebook(tc, {
      displayName: tc.displayName,
      websiteDomain: tc.websiteDomain,
    });

    const ok = urlMatchesExpected(result.url, tc.expectedFacebook);
    if (ok) {
      passed++;
      console.log(`  ✓ ${tc.name} → ${result.url}`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}`);
      console.log(`      forventet: ${tc.expectedFacebook}`);
      console.log(`      fikk:      ${result.url ?? "(null)"}`);
      failures.push({
        name: tc.name,
        expected: tc.expectedFacebook,
        got: result.url,
        queries: result.queries,
        queriesRun: result.queriesRun,
        hitCount: result.hitCount,
        confidence: result.confidence,
      });
    }
  }

  console.log(
    `\nResultat: ${passed}/${FACEBOOK_EVAL_CASES.length} OK, ${failed} feil`
  );

  if (failures.length) {
    console.log("\n--- Feil-detaljer ---");
    for (const f of failures) {
      console.log(`\n${f.name}`);
      console.log(`  forventet: ${f.expected}`);
      console.log(
        `  fikk: ${f.got ?? "(null)"} (${f.confidence}, ${f.hitCount} treff)`
      );
      console.log(`  queries (${f.queriesRun}):`);
      for (const q of f.queries) console.log(`    - ${q}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
