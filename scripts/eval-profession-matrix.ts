/**
 * Yrke-matrise: parsing, filter og relevans — kun norsk.
 * Kjør: npx tsx scripts/eval-profession-matrix.ts
 */
import assert from "node:assert/strict";
import {
  resolveIndustryKeyword,
  mergeAgentSearchFiltersFromMessage,
  parseListDaysFromMessage,
} from "../src/lib/agent/search-filters.ts";
import { resolveProfessionQuery } from "../src/lib/constants/professions.ts";
import { parseSimpleListRequest } from "../src/lib/agent/fast-list.ts";
import { isProfessionRelevantCompany } from "../src/lib/brreg/profession-relevance.ts";

type Scenario = {
  id: string;
  query: string;
  expect: {
    professionId?: string | null;
    industryGroup?: string | null;
    nameQuery?: string | null;
    days?: number;
    noMatch?: boolean;
  };
  relevance?: Array<{
    professionId: string;
    company: { name: string; industry_code: string };
    relevant: boolean;
  }>;
};

const SCENARIOS: Scenario[] = [
  // Vanlige håndverk
  { id: "no-elektriker", query: "finn 5 elektrikere i Oslo", expect: { professionId: "elektriker", nameQuery: "elektro" } },
  { id: "no-elektro", query: "finn meg en elektro", expect: { professionId: "elektriker", nameQuery: "elektro" } },
  { id: "no-rorlegger", query: "trenger rørleggere i oslo", expect: { professionId: "rorlegger", nameQuery: "rorlegger" } },
  { id: "no-vvs", query: "VVS i Mo i Rana", expect: { professionId: "rorlegger" } },
  { id: "no-snekker", query: "snekker i Trondheim", expect: { professionId: "snekker", nameQuery: "snekker" } },
  { id: "no-tomrer", query: "tømrer i Hamar", expect: { professionId: "snekker" } },
  { id: "no-maler", query: "finn 3 malere i Bodø", expect: { professionId: "maler", nameQuery: "maler" } },
  { id: "no-malermester", query: "malermester i Ålesund", expect: { professionId: "maler" } },
  { id: "no-taktekker", query: "taktekker Nordland", expect: { professionId: "taktekker", nameQuery: "tak" } },
  { id: "no-blikkenslager", query: "blikkenslager i Tromsø", expect: { professionId: "taktekker" } },
  { id: "no-murer", query: "murere i Stavanger", expect: { professionId: "murer", nameQuery: "murer" } },
  { id: "no-flislegger", query: "flislegger Oslo", expect: { professionId: "flislegger", nameQuery: "flis" } },
  { id: "no-arkitekt", query: "arkitekter i Bergen", expect: { professionId: "arkitekt", nameQuery: "arkitekt" } },
  { id: "no-anlegg", query: "anleggsgartner i Norge", expect: { professionId: "anlegg" } },
  { id: "no-byggfirma", query: "byggfirma i Oslo", expect: { industryGroup: "bygg" } },
  { id: "no-bygg-anlegg", query: "bygg og anlegg i Bergen", expect: { industryGroup: "bygg" } },
  { id: "no-handverk", query: "finn 5 håndverkere i Bodø", expect: { industryGroup: "bygg" } },
  { id: "no-el-install", query: "elektro installasjon i Narvik", expect: { professionId: "elektriker" } },

  // Tjenester
  { id: "no-frisor", query: "finn frisører i Narvik", expect: { professionId: "frisor" } },
  { id: "no-neglesalong", query: "neglesalong Tromsø", expect: { industryGroup: "skjonnhet", nameQuery: "negler" } },
  { id: "no-psykolog", query: "finn psykolog i Bergen", expect: { professionId: "psykolog", nameQuery: "psykolog" } },
  { id: "no-advokat", query: "3 advokater Oslo", expect: { professionId: "advokat", nameQuery: "advokat" } },
  { id: "no-regnskap", query: "regnskapsfører Trondheim", expect: { professionId: "regnskap", nameQuery: "regnskap" } },
  { id: "no-revisor", query: "revisjon firma Oslo", expect: { professionId: "regnskap" } },
  { id: "no-megler", query: "eiendomsmegler Bergen", expect: { professionId: "megler" } },
  { id: "no-lege", query: "fastlege i Tromsø", expect: { professionId: "lege" } },
  { id: "no-tannlege", query: "tannleger Bodø", expect: { professionId: "tannlege", nameQuery: "tannlege" } },
  { id: "no-rengjoring", query: "rengjøringsfirma Oslo", expect: { professionId: "rengjoring" } },
  { id: "no-vaktmester", query: "vaktmester i Oslo", expect: { professionId: "rengjoring" } },
  { id: "no-it-konsulent", query: "IT-konsulent Oslo", expect: { industryGroup: "it" } },

  // Bil / handel / servering
  { id: "no-bilverksted", query: "bilverksted Stavanger", expect: { professionId: "bilverksted" } },
  { id: "no-restaurant", query: "nyeste restauranter i Oslo", expect: { professionId: "restaurant", nameQuery: "restaurant" } },
  { id: "no-matkjeder", query: "hei, kan du finne meg 30 nye mat kjeder i norge", expect: { industryGroup: "servering" } },
  { id: "no-matkjede", query: "finn 10 matkjeder i Norge", expect: { industryGroup: "servering" } },
  { id: "no-fastfood", query: "fastfood i Bergen", expect: { industryGroup: "servering" } },
  { id: "no-kafe", query: "kafe i Bergen", expect: { industryGroup: "servering" } },
  { id: "no-baker", query: "bakeri Trondheim", expect: { professionId: "baker", nameQuery: "baker" } },
  { id: "no-hotell", query: "hotell i Lofoten", expect: { professionId: "hotell" } },
  { id: "no-barnehage", query: "barnehage Bergen", expect: { professionId: "barnehage" } },
  { id: "no-markedsforing", query: "markedsføring byrå Bergen", expect: { industryGroup: "reklame" } },

  // Stavefeil / dialekt / nynorsk-inspirert
  { id: "typo-elektrikker", query: "elektrikker i oslo", expect: { professionId: "elektriker" } },
  { id: "typo-rorleggar", query: "rørleggar bodø", expect: { professionId: "rorlegger" } },
  { id: "typo-rorleggerfirma", query: "rørleggerfirma i Bergen", expect: { professionId: "rorlegger" } },
  { id: "typo-snekkerbedrift", query: "snekkerbedrift i Trondheim", expect: { professionId: "snekker" } },
  { id: "typo-malerfirma", query: "malerfirma i Bodø", expect: { professionId: "maler" } },
  { id: "typo-resturanter", query: "finn meg 5 nyeste resturanter", expect: { professionId: "restaurant" } },
  { id: "typo-taktekkjar", query: "finn taktekkjar i Bergen", expect: { professionId: "taktekker" } },
  { id: "typo-malare", query: "finn målare i Oslo", expect: { professionId: "maler" } },

  // Tid + sted
  { id: "days-30", query: "nye byggfirma i Oslo siste 30 dager", expect: { industryGroup: "bygg", days: 30 } },
  {
    id: "days-90-elektriker",
    query: "finn meg 10 av de nyeste elektrikerne i norge, ikke eldre enn 90 dager",
    expect: { professionId: "elektriker", days: 90 },
  },
  {
    id: "days-90-bergen",
    query: "elektrikere siste 90 dager i bergen",
    expect: { professionId: "elektriker", days: 90 },
  },

  // Skal IKKE feiltolkes
  { id: "neg-leder", query: "finn leder i oslo", expect: { noMatch: true } },
  { id: "neg-takst", query: "takstmann oslo", expect: { noMatch: true } },
  { id: "neg-elektriker-not-psykolog", query: "elektriker oslo", expect: { professionId: "elektriker" } },
  { id: "neg-psykolog-not-elektriker", query: "psykolog oslo", expect: { professionId: "psykolog" } },

  // Transport / diverse
  { id: "no-transport", query: "transportfirma Trondheim", expect: { industryGroup: "transport" } },
  { id: "no-taxi", query: "taxi i oslo", expect: { professionId: "taxi" } },
  { id: "no-trening", query: "treningssenter Bergen", expect: { professionId: "trening" } },
  { id: "no-tatovering", query: "tatovering Oslo", expect: { professionId: "tatovering" } },
  { id: "no-blomster", query: "blomsterbutikk Tromsø", expect: { professionId: "blomster" } },
  { id: "no-fotograf", query: "fotograf i Bergen", expect: { professionId: "fotograf" } },
  { id: "no-flyttebyra", query: "flyttebyrå i Oslo", expect: { professionId: "flyttebyra" } },
  { id: "no-kiropraktor", query: "kiropraktor i Trondheim", expect: { professionId: "fysioterapeut" } },

  // Engelsk og blandet språk
  { id: "en-electrician", query: "find electrician in Oslo", expect: { professionId: "elektriker", nameQuery: "elektro" } },
  { id: "en-plumber", query: "find plumber Bergen", expect: { professionId: "rorlegger", nameQuery: "rorlegger" } },
  { id: "en-carpenter", query: "carpenter companies Nordland", expect: { professionId: "snekker", nameQuery: "snekker" } },
  { id: "en-accountant", query: "need accountant Trondheim", expect: { professionId: "regnskap", nameQuery: "regnskap" } },
  { id: "en-lawyer", query: "lawyer firms Oslo", expect: { professionId: "advokat", nameQuery: "advokat" } },
  { id: "en-hairdresser", query: "hairdresser in Bergen", expect: { professionId: "frisor" } },
  { id: "en-cleaner", query: "cleaning company Oslo", expect: { professionId: "rengjoring" } },
  { id: "en-dentist", query: "dentist in Oslo", expect: { professionId: "tannlege", nameQuery: "tannlege" } },
  { id: "en-architect", query: "architect firm Trondheim", expect: { professionId: "arkitekt" } },
  { id: "mix-1", query: "finn elektriker i Oslo", expect: { professionId: "elektriker" } },
  { id: "mix-2", query: "find plumber Bergen", expect: { professionId: "rorlegger" } },
  { id: "mix-3", query: "trenger accountant Trondheim", expect: { professionId: "regnskap" } },

  // Relevansfilter
  {
    id: "rel-elektriker-psykolog",
    query: "elektriker",
    expect: { professionId: "elektriker" },
    relevance: [
      {
        professionId: "elektriker",
        company: { name: "PSYKOLOGSPESIALIST KRISTINE KÅRVIK", industry_code: "86.90" },
        relevant: false,
      },
      {
        professionId: "elektriker",
        company: { name: "Nord Elektro AS", industry_code: "43.21" },
        relevant: true,
      },
      {
        professionId: "elektriker",
        company: { name: "MALERSVEEN ROY STORSVEEN", industry_code: "43.34" },
        relevant: false,
      },
    ],
  },
  {
    id: "rel-maler-service",
    query: "maler",
    expect: { professionId: "maler" },
    relevance: [
      {
        professionId: "maler",
        company: { name: "Ferix Roe Service", industry_code: "43.99" },
        relevant: false,
      },
      {
        professionId: "maler",
        company: { name: "Nordmaling AS", industry_code: "43.34" },
        relevant: true,
      },
    ],
  },
  {
    id: "rel-psykolog-elektro",
    query: "psykolog",
    expect: { professionId: "psykolog" },
    relevance: [
      {
        professionId: "psykolog",
        company: { name: "Vida Psykologtjenester AS", industry_code: "86.90" },
        relevant: true,
      },
      {
        professionId: "psykolog",
        company: { name: "Nord Elektro AS", industry_code: "43.21" },
        relevant: false,
      },
    ],
  },
];

function resolve(query: string) {
  const industry = resolveIndustryKeyword(query);
  const merged = mergeAgentSearchFiltersFromMessage(query, { limit: 5 });
  const days = parseListDaysFromMessage(query);
  return { industry, merged, days };
}

function checkScenario(scenario: Scenario): { ok: boolean; note?: string } {
  const { industry, merged, days } = resolve(scenario.query);
  const exp = scenario.expect;

  if (exp.noMatch) {
    const gotProfession = industry?.filters.professionId ?? merged.professionId;
    const gotIndustry = industry?.filters.industryGroup ?? merged.industryGroup;
    if (gotProfession || gotIndustry) {
      return {
        ok: false,
        note: `forventet ingen match, fikk professionId=${gotProfession} industryGroup=${gotIndustry}`,
      };
    }
    return { ok: true };
  }

  const gotProfessionId =
    (industry?.filters.professionId as string | undefined) ??
    (merged.professionId as string | undefined);
  const gotIndustryGroup =
    (industry?.filters.industryGroup as string | undefined) ??
    (merged.industryGroup as string | undefined);
  const gotNameQuery =
    (industry?.filters.nameQuery as string | undefined) ??
    (merged.nameQuery as string | undefined);

  if (exp.professionId !== undefined && exp.professionId !== gotProfessionId) {
    return {
      ok: false,
      note: `professionId: forventet ${exp.professionId}, fikk ${gotProfessionId ?? "null"}`,
    };
  }
  if (exp.industryGroup !== undefined && exp.industryGroup !== gotIndustryGroup) {
    return {
      ok: false,
      note: `industryGroup: forventet ${exp.industryGroup}, fikk ${gotIndustryGroup ?? "null"}`,
    };
  }
  if (exp.nameQuery !== undefined && exp.nameQuery !== gotNameQuery) {
    return {
      ok: false,
      note: `nameQuery: forventet ${exp.nameQuery}, fikk ${gotNameQuery ?? "null"}`,
    };
  }
  if (exp.days !== undefined && exp.days !== days) {
    return { ok: false, note: `days: forventet ${exp.days}, fikk ${days ?? "undefined"}` };
  }

  if (scenario.relevance) {
    for (const rel of scenario.relevance) {
      const isRel = isProfessionRelevantCompany(rel.professionId, rel.company);
      if (isRel !== rel.relevant) {
        return {
          ok: false,
          note: `relevans ${rel.company.name}: forventet ${rel.relevant}, fikk ${isRel}`,
        };
      }
    }
  }

  return { ok: true };
}

async function testParseSimpleListSamples() {
  const samples = [
    { q: "finn 5 elektrikere i Oslo", professionId: "elektriker", municipality: "0301", days: 0 },
    { q: "finn 5 frisører i Bodø", professionId: "frisor", municipality: "1804", days: 0 },
    { q: "finn psykolog i Bergen", professionId: "psykolog", municipality: "4601", days: 0 },
    {
      q: "elektrikere siste 90 dager i bergen",
      professionId: "elektriker",
      municipality: "4601",
      days: 90,
    },
    { q: "finn taktekkjar i Bergen", professionId: "taktekker", municipality: "4601", days: 0 },
    { q: "finn målare i Oslo", professionId: "maler", municipality: "0301", days: 0 },
    { q: "find plumber Bergen", professionId: "rorlegger", municipality: "4601", days: 0 },
    {
      q: "hei, kan du finne meg 30 nye mat kjeder i norge",
      industryGroup: "servering",
      limit: 30,
      location: "Norge",
      days: 0,
    },
  ];
  for (const s of samples) {
    const parsed = await parseSimpleListRequest(s.q.startsWith("finn") || s.q.startsWith("hei") ? s.q : `finn ${s.q}`);
    assert.ok(parsed, `parseSimpleListRequest failed for ${s.q}`);
    if ("professionId" in s && s.professionId) {
      assert.equal(parsed!.searchArgs.professionId, s.professionId, s.q);
    }
    if ("industryGroup" in s && s.industryGroup) {
      assert.equal(parsed!.searchArgs.industryGroup, s.industryGroup, s.q);
    }
    if ("municipality" in s && s.municipality) {
      assert.equal(parsed!.searchArgs.municipalityCode, s.municipality, s.q);
    }
    if ("limit" in s && s.limit) {
      assert.equal(parsed!.limit, s.limit, s.q);
    }
    if ("location" in s && s.location) {
      assert.equal(parsed!.locationLabel, s.location, s.q);
    }
    assert.equal(parsed!.searchArgs.days, s.days, s.q);
  }
}

async function main() {
  let pass = 0;
  let fail = 0;
  const failures: Array<{ id: string; query: string; note: string }> = [];

  for (const scenario of SCENARIOS) {
    const result = checkScenario(scenario);
    if (result.ok) {
      pass++;
    } else {
      fail++;
      failures.push({ id: scenario.id, query: scenario.query, note: result.note ?? "ukjent" });
      console.log(`FAIL [${scenario.id}] ${scenario.query}`);
      console.log(`  → ${result.note}`);
    }
  }

  await testParseSimpleListSamples();

  const total = SCENARIOS.length;
  console.log(`\neval-profession-matrix: ${pass}/${total} OK (${Math.round((pass / total) * 100)}%)`);
  if (fail > 0) {
    console.log(`\n${fail} feil:`);
    for (const f of failures) {
      console.log(`  - ${f.id}: ${f.note}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
