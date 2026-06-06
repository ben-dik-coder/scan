/**
 * Regresjonstester for nettside-/sosial-matching.
 * Kjør: npx tsx scripts/verify-website-scan-matching.ts
 */
import assert from "node:assert/strict";
import {
  companyMatchesProfileName,
  companyMatchesResult,
  pickBestWebsite,
} from "../src/lib/website-scan/parse-results";
import {
  socialUrlMatchesCompany,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles";
import { profileMatchesCompany } from "../src/lib/website-scan/serpapi-facebook-profile";
import type { FacebookProfileSnippet } from "../src/lib/website-scan/types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
  }
}

const NARVIK_FRISOR = "NARVIK FRISØR AS";

console.log("Nettside-/sosial-matching\n");

test("Narvik Frisør matcher eget profilnavn", () => {
  assert.equal(companyMatchesProfileName("Narvik Frisør", NARVIK_FRISOR), true);
});

test("Headline Frisør matcher IKKE Narvik Frisør", () => {
  assert.equal(companyMatchesProfileName("Headline Frisør", NARVIK_FRISOR), false);
});

test("Headline Frisør Narvik matcher IKKE Narvik Frisør", () => {
  assert.equal(
    companyMatchesProfileName("Headline Frisør Narvik", NARVIK_FRISOR),
    false
  );
});

test("Facebook-URL headlinefrisor matcher IKKE Narvik Frisør", () => {
  assert.equal(
    socialUrlMatchesCompany("https://www.facebook.com/headlinefrisor", NARVIK_FRISOR),
    false
  );
});

test("Facebook-URL narvikfrisor matcher Narvik Frisør", () => {
  assert.equal(
    socialUrlMatchesCompany("https://www.facebook.com/narvikfrisor", NARVIK_FRISOR),
    true
  );
});

test("Google-treff Headline Frisør velges ikke for Narvik Frisør", () => {
  const pick = pickFacebookFromHits(
    [
      {
        title: "Headline Frisør | Narvik",
        link: "https://www.facebook.com/headlinefrisor",
      },
      {
        title: "Narvik Frisør",
        link: "https://www.facebook.com/narvikfrisor",
      },
    ],
    NARVIK_FRISOR,
    "Narvik"
  );
  assert.equal(pick.url, "https://www.facebook.com/narvikfrisor");
});

test("URL alene kan ikke matche på path-tokens", () => {
  assert.equal(
    companyMatchesResult("", "https://instagram.com/bergentest", "Test Berg AS"),
    false
  );
});

test("Nettside krever tittel-treff — ikke bare domene", () => {
  const pick = pickBestWebsite(
    [
      {
        title: "Tilfeldig side i Narvik",
        link: "https://www.narvik-spa.no/",
      },
    ],
    NARVIK_FRISOR,
    { municipalityName: "Narvik" }
  );
  assert.equal(pick.hasWebsite, false);
});

test("Facebook-profil Headline avvises for Narvik Frisør", () => {
  const profile: FacebookProfileSnippet = {
    profileId: "headlinefrisor",
    name: "Headline Frisør",
    url: "https://www.facebook.com/headlinefrisor",
    verified: false,
    profileType: "PAGE",
    category: "Frisør",
    followers: null,
    likes: null,
    phone: "74999029",
    email: null,
    address: "Narvik",
    intro: null,
    isPrivate: false,
    source: "serpapi_facebook_profile",
    linkedInstagramUrl: null,
    linkedLinkedInUrl: null,
    linkedWebsiteUrl: null,
  };
  assert.equal(profileMatchesCompany(profile, NARVIK_FRISOR, "Narvik"), false);
});

console.log(`\n${passed} bestått, ${failed} feilet`);
if (failed > 0) process.exit(1);
