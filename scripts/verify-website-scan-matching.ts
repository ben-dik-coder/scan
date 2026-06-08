/**
 * Regresjonstester for nettside-/sosial-matching.
 * Kjør: npx tsx scripts/verify-website-scan-matching.ts
 */
import assert from "node:assert/strict";
import {
  companyMatchesProfileName,
  companyMatchesResult,
  pickBestWebsite,
  buildWebsiteSearchQueries,
} from "../src/lib/website-scan/parse-results";
import {
  socialUrlMatchesCompany,
  pickFacebookFromHits,
} from "../src/lib/website-scan/social-profiles";
import {
  emailPlausibleForCompany,
  resolveCompanyEmail,
} from "../src/lib/website-scan/resolve-company-email";
import { extractPhonesFromHtml } from "../src/lib/website-scan/parse-page-contact";
import {
  phonePlausibleForCompany,
  phoneLooksLikeDate,
  phoneLooksLikeOrgnr,
} from "../src/lib/website-scan/phone-plausible";
import { resolveCompanyPhone } from "../src/lib/website-scan/resolve-company-contact";
import {
  CONTACT_ENRICHMENT_VERSION,
  needsContactEnrichment,
} from "../src/lib/website-scan/scan-cache";
import {
  enrichFacebookWithSerpApi,
  profileMatchesCompany,
} from "../src/lib/website-scan/serpapi-facebook-profile";
import {
  api1881ContactMatchesCompany,
  extractPhonesFromApi1881Contact,
  finalizePhoneWithApi1881,
} from "../src/lib/website-scan/api1881/phone";
import type { FacebookProfileSnippet } from "../src/lib/website-scan/types";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
  }
}

const NARVIK_FRISOR = "NARVIK FRISØR AS";

async function main() {
console.log("Nettside-/sosial-matching\n");

await test("Narvik Frisør matcher eget profilnavn", () => {
  assert.equal(companyMatchesProfileName("Narvik Frisør", NARVIK_FRISOR), true);
});

await test("Headline Frisør matcher IKKE Narvik Frisør", () => {
  assert.equal(companyMatchesProfileName("Headline Frisør", NARVIK_FRISOR), false);
});

await test("Headline Frisør Narvik matcher IKKE Narvik Frisør", () => {
  assert.equal(
    companyMatchesProfileName("Headline Frisør Narvik", NARVIK_FRISOR),
    false
  );
});

await test("Facebook-URL headlinefrisor matcher IKKE Narvik Frisør", () => {
  assert.equal(
    socialUrlMatchesCompany("https://www.facebook.com/headlinefrisor", NARVIK_FRISOR),
    false
  );
});

await test("Facebook-URL narvikfrisor matcher Narvik Frisør", () => {
  assert.equal(
    socialUrlMatchesCompany("https://www.facebook.com/narvikfrisor", NARVIK_FRISOR),
    true
  );
});

await test("Google-treff Headline Frisør velges ikke for Narvik Frisør", () => {
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

await test("URL alene kan ikke matche på path-tokens", () => {
  assert.equal(
    companyMatchesResult("", "https://instagram.com/bergentest", "Test Berg AS"),
    false
  );
});

await test("Google Maps-tittel matcher selv når nettside er Facebook", () => {
  assert.equal(
    companyMatchesResult(
      "Nita Spa&Massasje",
      "https://www.facebook.com/profile.php?id=61576058440821",
      "NITAS SPA & MASSASJE AS"
    ),
    true
  );
});

await test("Proff-treff matcher tittel men velges ikke som nettside", () => {
  assert.equal(
    companyMatchesResult(
      "Nitas Spa & Massasje AS - Org.nr. 926 440 179 - Bodø",
      "https://www.proff.no/selskap/nitas-spa-massasje-as/bodo",
      "NITAS SPA & MASSASJE AS"
    ),
    true
  );
  const pick = pickBestWebsite(
    [
      {
        title: "Nitas Spa & Massasje AS - Org.nr. 926 440 179 - Bodø",
        link: "https://www.proff.no/selskap/nitas-spa-massasje-as/bodo",
      },
    ],
    "NITAS SPA & MASSASJE AS",
    { municipalityName: "Bodø" }
  );
  assert.equal(pick.hasWebsite, false);
});

await test("Nettside avviser delvis domene-treff (narvik-spa ≠ frisør)", () => {
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

const RECALL_FIXTURES = [
  { name: "AQ PARTNER QUESADA", domain: "aqpartner.no", place: "KRISTIANSAND" },
  { name: "RAVINE SYKLER AS", domain: "ravine.no", place: "KRISTIANSAND" },
  { name: "LUCKY CUTS BY ARIANA HAVNEVIK RIISE", domain: "luckycuts.no", place: "ÅLESUND" },
  { name: "POLI-MAP", domain: "poli-map.org", place: "OSLO" },
  { name: "MASSIVO AS", domain: "massivo.no", place: "OSLO" },
  { name: "SEEME CARE AS", domain: "seemecare.no", place: "FREDRIKSTAD" },
] as const;

for (const fx of RECALL_FIXTURES) {
  await test(`Recall: ${fx.domain} med generisk tittel`, () => {
    const pick = pickBestWebsite(
      [{ title: "Hjem", link: `https://www.${fx.domain}/` }],
      fx.name,
      { municipalityName: fx.place }
    );
    assert.equal(pick.hasWebsite, true, fx.name);
    assert.equal(pick.websiteDomain, fx.domain);
  });
}

await test("Poli-Map avviser thepolimap.com (annet domene)", () => {
  const pick = pickBestWebsite(
    [{ title: "The Poli Map", link: "https://thepolimap.com/" }],
    "POLI-MAP",
    { municipalityName: "OSLO" }
  );
  assert.equal(pick.hasWebsite, false);
});

await test("Seeme Care avviser seeme.no (kort prefiks ≠ seemecare)", () => {
  const pick = pickBestWebsite(
    [{ title: "Seeme", link: "https://seeme.no/" }],
    "SEEME CARE AS",
    { municipalityName: "FREDRIKSTAD" }
  );
  assert.equal(pick.hasWebsite, false);
});

await test("EF AUTO avviser eidangerauto.no (generisk «auto»)", () => {
  const pick = pickBestWebsite(
    [{ title: "Eidanger Auto", link: "https://eidangerauto.no/" }],
    "EF AUTO AS",
    { municipalityName: "PORSGRUNN" }
  );
  assert.equal(pick.hasWebsite, false);
});

await test("Booking-plattform godtas når tittel matcher firmanavn", () => {
  const pick = pickBestWebsite(
    [
      {
        title: "VIRVEL NARVIK AS",
        link: "https://frisorvirvel.bestille.no/",
      },
    ],
    "VIRVEL NARVIK AS",
    { municipalityName: "Narvik" }
  );
  assert.equal(pick.websiteKind, "booking_only");
  assert.equal(pick.websiteDomain, "frisorvirvel.bestille.no");
});

await test("Nettside-spørringer prioriterer firmanavn+sted uten nettside", () => {
  const queries = buildWebsiteSearchQueries({
    name: "RAVINE SYKLER AS",
    municipality_name: "KRISTIANSAND S",
    city: "KRISTIANSAND",
  });
  assert.ok(!/\bnettside\b/i.test(queries[0] ?? ""));
  assert.match(queries[0] ?? "", /RAVINE SYKLER/i);
  assert.match(queries[0] ?? "", /Kristiansand/i);
});

await test("Nettside godtar riktig domene selv med generisk tittel", () => {
  const pick = pickBestWebsite(
    [
      {
        title: "Hjem",
        link: "https://www.narvikfrisor.no/",
      },
    ],
    NARVIK_FRISOR,
    { municipalityName: "Narvik" }
  );
  assert.equal(pick.hasWebsite, true);
  assert.equal(pick.websiteDomain, "narvikfrisor.no");
});

await test("Facebook-profil Headline avvises for Narvik Frisør", () => {
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

await test("facebook_profile kalles ikke uten Google-treff", async () => {
  const result = await enrichFacebookWithSerpApi(
    "https://www.facebook.com/narvikfrisor",
    NARVIK_FRISOR,
    { verifiedViaSearch: false }
  );
  assert.equal(result.facebookUrl, "https://www.facebook.com/narvikfrisor");
  assert.equal(result.facebookProfile, null);
});

const SALONGEN = "SALONGEN DAME OG HERREFRISØR Tone Saboh";

await test("Sykehus-e-post avvises for frisør", () => {
  assert.equal(
    emailPlausibleForCompany(
      "kommunikasjon@nordlandssykehuset.no",
      SALONGEN
    ),
    false
  );
});

await test("resolveCompanyEmail ignorerer sykehus-e-post fra Brreg på frisør", () => {
  const resolved = resolveCompanyEmail(
    {
      name: SALONGEN,
      email: "kommunikasjon@nordlandssykehuset.no",
      has_email: true,
    },
    null
  );
  assert.equal(resolved, null);
});

await test("E-post på eget domene godtas for frisør", () => {
  assert.equal(
    emailPlausibleForCompany("post@limefrisor.no", "LIME FRISØR AS"),
    true
  );
});

await test("Facebook-e-post krever validert profil", () => {
  const resolved = resolveCompanyEmail(
    { name: NARVIK_FRISOR, has_email: false },
    {
      orgnr: "1",
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      source: "serpapi",
      confidence: "low",
      query: "",
      scannedAt: new Date().toISOString(),
      facebookUrl: "https://www.facebook.com/headlinefrisor",
      facebookProfile: {
        profileId: "headlinefrisor",
        name: "Headline Frisør",
        url: "https://www.facebook.com/headlinefrisor",
        verified: false,
        profileType: "PAGE",
        category: null,
        followers: null,
        likes: null,
        phone: null,
        email: "post@headlinefrisor.no",
        address: null,
        intro: null,
        isPrivate: false,
        source: "serpapi_facebook_profile",
        linkedInstagramUrl: null,
        linkedLinkedInUrl: null,
        linkedWebsiteUrl: null,
      },
    }
  );
  assert.equal(resolved, null);
});

console.log("\nTelefonvalidering\n");

await test("Wild Horse mobil 96687189 godtas for org 936662889", () => {
  assert.equal(phonePlausibleForCompany("96687189", "936662889"), true);
});

await test("Hair by Ellen org.nr-prefix 93751017 avvises", () => {
  assert.equal(phonePlausibleForCompany("93751017", "937510179"), false);
  assert.equal(phoneLooksLikeOrgnr("93751017", "937510179"), true);
});

await test("Karlsen org.nr-prefix 93763926 avvises", () => {
  assert.equal(phonePlausibleForCompany("93763926", "937639260"), false);
});

await test("Barauske nesten-org.nr 93742994 avvises (fuzzy)", () => {
  assert.equal(phonePlausibleForCompany("93742994", "937429924"), false);
});

await test("Nails by Marit 17047328 avvises (ugyldig norsk prefiks)", () => {
  assert.equal(phonePlausibleForCompany("17047328", "937359276"), false);
});

await test("Dato-lignende tall 20230930 avvises", () => {
  assert.equal(phoneLooksLikeDate("20230930"), true);
  assert.equal(phonePlausibleForCompany("20230930", "937796803"), false);
});

await test("Dato-lignende tall 20260522 avvises", () => {
  assert.equal(phoneLooksLikeDate("20260522"), true);
  assert.equal(phonePlausibleForCompany("20260522", "937802471"), false);
});

await test("Nettside-HTML med løs tekst gir ingen telefon uten tel:/JSON-LD", () => {
  const html = `
    <p>Stiftet 20230930</p>
    <p>Kontakt oss på 56623002 eller 63438899</p>
  `;
  const phones = extractPhonesFromHtml(html, { trustTextRegex: false });
  assert.equal(phones.length, 0);
});

await test("Nettside-HTML med tel:-lenke godtas", () => {
  const html = `<a href="tel:+4748853389">Ring</a>`;
  const phones = extractPhonesFromHtml(html, { trustTextRegex: false });
  assert.equal(phones.includes("488 53 389"), true);
});

const PROFF_HTML = `
  <div>Org nr 937 785 674</div>
  <div>Resultat før skatt -578 000</div>
  <div>Årsresultat -578 000</div>
  <p>Omsetning 578 31 276</p>
`;

await test("Proff/katalog-HTML uten tel: gir ingen telefon fra regex", () => {
  const phones = extractPhonesFromHtml(PROFF_HTML, { trustTextRegex: false });
  assert.equal(phones.length, 0);
});

await test("Proff-HTML med tel:-lenke godtar 91908244", () => {
  const html = `${PROFF_HTML}<a href="tel:+4791908244">Ring oss</a>`;
  const phones = extractPhonesFromHtml(html, { trustTextRegex: false });
  assert.equal(phones.includes("919 08 244"), true);
});

await test("resolveCompanyPhone avviser ugyldig enrichedPhone", () => {
  const resolved = resolveCompanyPhone(
    { orgnr: "937510179", mobile: null, phone: null },
    {
      orgnr: "937510179",
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      source: "serpapi",
      confidence: "low",
      query: "",
      scannedAt: new Date().toISOString(),
      enrichedPhone: "937 51 017",
      enrichedPhoneSource: "directory",
      contactsEnriched: true,
      contactEnrichmentVersion: CONTACT_ENRICHMENT_VERSION,
    }
  );
  assert.equal(resolved, null);
});

await test("Hundetrener 10601148 avvises (ugyldig prefiks 10)", () => {
  assert.equal(phonePlausibleForCompany("106 01 148", "936804306"), false);
});

await test("resolveCompanyPhone bruker scan.orgnr når company mangler orgnr", () => {
  const resolved = resolveCompanyPhone(
    { mobile: null, phone: null },
    {
      orgnr: "936804306",
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      source: "serpapi",
      confidence: "low",
      query: "",
      scannedAt: new Date().toISOString(),
      enrichedPhone: "106 01 148",
      enrichedPhoneSource: "website",
    }
  );
  assert.equal(resolved, null);
});

await test("1881 Company matcher på org.nr", () => {
  assert.equal(
    api1881ContactMatchesCompany(
      { type: "Company", name: "Hundetrener Trine Rødahl", organizationNumber: "936804306" },
      "HUNDETRENER TRINE RØDAHL",
      "936804306"
    ),
    true
  );
});

await test("1881 Company med feil org.nr og navn matcher ikke", () => {
  assert.equal(
    api1881ContactMatchesCompany(
      { type: "Company", name: "Annen Bedrift AS", organizationNumber: "123456789" },
      "HUNDETRENER TRINE RØDAHL",
      "936804306"
    ),
    false
  );
});

await test("1881 contactPoints henter telefon og mobil", () => {
  const phones = extractPhonesFromApi1881Contact({
    contactPoints: [
      { type: "Phone", value: "73 50 12 34" },
      { type: "Mobil", value: "918 76 543" },
      { type: "Email", value: "test@example.com" },
    ],
  });
  assert.deepEqual(phones, ["73 50 12 34", "918 76 543"]);
});

await test("finalizePhoneWithApi1881 uten API-nøkkel beholder kandidat", async () => {
  const result = await finalizePhoneWithApi1881(
    { name: "Test AS", orgnr: "937510179" },
    { phone: "919 08 244", source: "website" }
  );
  assert.equal(result.phone, "919 08 244");
  assert.equal(result.source, "website");
  assert.equal(result.from1881, false);
});

await test("Gammel cache med contactsEnriched v1 trenger re-berikelse", () => {
  assert.equal(
    needsContactEnrichment({
      orgnr: "937510179",
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      source: "serpapi",
      confidence: "low",
      query: "",
      scannedAt: new Date().toISOString(),
      contactsEnriched: true,
      contactEnrichmentVersion: 1,
    }),
    true
  );
});

console.log(`\n${passed} bestått, ${failed} feilet`);
if (failed > 0) process.exit(1);
}

main();
