/**
 * Eval: agent-hjelpere uten OpenAI (minne, resume, søkefilter, kontekst).
 * Kjør: npm run eval:agent-scenarios
 */
import assert from "node:assert/strict";
import { buildAgentChatHistory, trimAgentHistory } from "../src/lib/agent/history.ts";
import {
  buildAgentStartupContextPrompt,
  type AgentStartupContext,
} from "../src/lib/agent/context.ts";
import {
  isContextualListFollowUp,
  isSaveListFollowUp,
  isScanWebsitesFollowUp,
  isSimpleListIntent,
  isWebsiteSalesLeadListIntent,
  parseContextualListRequest,
  parseSaveListRequest,
  parseScanWebsitesRequest,
  parseSimpleListRequest,
  parseWebsiteSalesLeadRequest,
} from "../src/lib/agent/fast-list.ts";
import {
  isAgentResumeIntent,
  isAgentPostCancelFollowUp,
  isSimpleSearchIntent,
} from "../src/lib/agent/prompt.ts";
import { needsConcreteSummary } from "../src/lib/agent/run-agent.ts";
import { formatCompanyExamples } from "../src/lib/agent/format-summary.ts";
import {
  mapProfessionToIndustryGroup,
  resolveAgentSearchIndustryFilters,
  resolveIndustryKeyword,
} from "../src/lib/agent/search-filters.ts";
import {
  isWebsiteSalesLeadIntent,
  messageForIndustryResolution,
} from "../src/lib/agent/website-sales-leads.ts";
import { isProfessionRelevantCompany } from "../src/lib/brreg/profession-relevance.ts";
import type { AgentMessage } from "../src/types/database.ts";

function testResumeIntent() {
  assert.equal(isAgentResumeIntent("Start søk igjen"), true);
  assert.equal(isAgentResumeIntent("fortsett"), true);
  assert.equal(isAgentResumeIntent("Hvor mange fant du?"), false);
  assert.equal(isAgentPostCancelFollowUp("Hvor mange fant du?"), true);
  assert.equal(isAgentPostCancelFollowUp("Start søk igjen"), false);
}

function testHistoryWithTools() {
  const messages: AgentMessage[] = [
    {
      id: "1",
      conversation_id: "c",
      role: "user",
      content: "Finn frisører i Bodø",
      tool_calls: null,
      tool_name: null,
      created_at: "2024-01-01",
    },
    {
      id: "2",
      conversation_id: "c",
      role: "tool",
      content: "Fant 50 firma",
      tool_calls: null,
      tool_name: "search_companies",
      created_at: "2024-01-02",
    },
    {
      id: "3",
      conversation_id: "c",
      role: "assistant",
      content: "Jeg fant 50 frisører.",
      tool_calls: null,
      tool_name: null,
      created_at: "2024-01-03",
    },
  ];

  const history = buildAgentChatHistory(messages);
  assert.equal(history.length, 3);
  assert.equal(history[0].role, "user");
  assert.match(history[1].content, /search companies/i);
  assert.equal(history[2].role, "assistant");

  const trimmed = trimAgentHistory(
    Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    })) as { role: "user" | "assistant"; content: string }[]
  );
  assert.ok(trimmed.length <= 24);
}

function testProfessionMapping() {
  assert.equal(mapProfessionToIndustryGroup("bilverksted"), undefined);
  assert.equal(mapProfessionToIndustryGroup("rengjoring"), undefined);
  assert.equal(mapProfessionToIndustryGroup("advokat"), undefined);
  assert.equal(mapProfessionToIndustryGroup("maler"), undefined);
  assert.equal(mapProfessionToIndustryGroup("rorlegger"), undefined);
  assert.equal(
    resolveAgentSearchIndustryFilters({ professionId: "advokat" }).professionId,
    "advokat"
  );
  assert.equal(
    resolveAgentSearchIndustryFilters({ professionId: "maler" }).professionId,
    "maler"
  );
  assert.equal(
    resolveAgentSearchIndustryFilters({ professionId: "maler" }).industryGroup,
    undefined
  );
  assert.equal(resolveAgentSearchIndustryFilters({ professionId: "frisor" }).professionId, "frisor");
  assert.equal(resolveAgentSearchIndustryFilters({ professionId: "frisor" }).industryGroup, undefined);
}

function testSimpleSearchIntent() {
  assert.equal(isSimpleSearchIntent("Finn frisører i Narvik"), true);
  assert.equal(isSimpleSearchIntent("Nye byggfirma i Oslo siste 30 dager"), true);
  assert.equal(isSimpleSearchIntent("Finn frisører i Narvik uten nettside"), false);
  assert.equal(isSimpleSearchIntent("Skann nettside for disse"), false);
}

async function testContextualFollowUp() {
  assert.equal(isContextualListFollowUp("finn meg 3 til"), true);
  assert.equal(isContextualListFollowUp("finn 3 til"), true);
  assert.equal(isContextualListFollowUp("finn meg flere"), true);
  assert.equal(isContextualListFollowUp("finn flere"), true);
  assert.equal(isContextualListFollowUp("hei"), false);

  const history = [
    { role: "user", content: "8 private tannleger i Bodø med telefon" },
    {
      role: "assistant",
      content:
        "Her er 8 tannleger i Bodø (alle med telefon):\n\n1. **Test AS** · orgnr 123456789 · tlf 123",
    },
  ];

  const parsed = await parseContextualListRequest("finn meg 3 til", history);
  assert.ok(parsed);
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.industryLabel, "tannleger");
  assert.equal(parsed.searchArgs.municipalityCode, "1804");
  assert.equal(parsed.searchArgs.professionId, "tannlege");
  assert.equal(parsed.searchArgs.requirePhone, true);
  assert.deepEqual(parsed.excludeOrgnrs, ["123456789"]);

  const switchHistory = [
    { role: "user", content: "finn 3 regnskapsførere i Oslo" },
    {
      role: "assistant",
      content:
        "Her er 3 regnskapsførere i oslo:\n\n1. **Bygdøy Regnskap AS** · orgnr 936926169 · OSLO",
    },
    { role: "user", content: "nei, det var feil — advokater i stedet" },
  ];
  const switched = await parseContextualListRequest(
    "nei, det var feil — advokater i stedet",
    switchHistory
  );
  assert.ok(switched);
  assert.equal(switched.searchArgs.municipalityCode, "0301");
  assert.equal(switched.searchArgs.professionId, "advokat");
}

async function testSaveAndScanFollowUp() {
  assert.equal(isSaveListFollowUp("lagre som liste"), true);
  assert.equal(isScanWebsitesFollowUp("skann nettside på de to første"), true);
  assert.equal(isScanWebsitesFollowUp("skann de tre første"), true);

  const history = [
    { role: "user", content: "finn 3 advokater i Oslo" },
    {
      role: "assistant",
      content:
        "Her er 3 advokater i oslo:\n\n1. **Advokat AS** · orgnr 935001684 · tlf 22335815 · OSLO\n2. **Lexx Advokat AS** · orgnr 935987717 · tlf 958 13 340 · OSLO",
    },
  ];

  const save = await parseSaveListRequest("lagre som liste", history);
  assert.ok(save);
  assert.equal(save.orgnrs.length, 2);
  assert.match(save.name, /advokater/i);
  assert.equal(save.municipalityCode, "0301");

  const scan = parseScanWebsitesRequest("skann nettside på de to første", history);
  assert.ok(scan);
  assert.equal(scan.count, 2);
  assert.deepEqual(scan.orgnrs, ["935001684", "935987717"]);
}

async function testSimpleListIntent() {
  assert.equal(isSimpleListIntent("finn meg 5 byggevarehandlere"), true);
  assert.equal(isSimpleListIntent("finn 5 byggevarehandler i Bodø"), true);
  assert.equal(isSimpleListIntent("finn 5 frisører i Bodø"), true);
  assert.equal(isSimpleListIntent("finn 3 kulturfirma i Narvik"), true);
  assert.equal(isSimpleListIntent("finn frisører uten nettside"), false);
  assert.equal(isSimpleListIntent("skann nettside for disse"), false);

  const parsed = await parseSimpleListRequest("finn meg 5 byggevarehandlere i Bodø");
  assert.ok(parsed);
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.searchArgs.municipalityCode, "1804");
  assert.equal(parsed.searchArgs.industryGroup, "bygg");
  assert.equal(parsed.searchArgs.nameQuery, "byggevare");
  assert.equal(parsed.searchArgs.days, 0);

  const frisor = await parseSimpleListRequest("finn 5 frisører i Bodø");
  assert.ok(frisor);
  assert.equal(frisor.limit, 5);
  assert.equal(frisor.searchArgs.municipalityCode, "1804");
  assert.equal(frisor.searchArgs.professionId, "frisor");
  assert.equal(frisor.searchArgs.industryGroup, undefined);
  assert.equal(frisor.searchArgs.nameQuery, undefined);
  assert.equal(frisor.searchArgs.days, 0);

  const kultur = await parseSimpleListRequest("finn 3 kulturfirma i Narvik");
  assert.ok(kultur);
  assert.equal(kultur.searchArgs.industryGroup, "kultur");
  assert.equal(kultur.searchArgs.municipalityCode, "1806");

  const bygg = resolveIndustryKeyword("byggevarehandler i norge");
  assert.equal(bygg?.filters.industryGroup, "bygg");
  assert.equal(bygg?.filters.nameQuery, "byggevare");

  const negle = resolveIndustryKeyword("neglesalong Tromsø");
  assert.equal(negle?.filters.industryGroup, "skjonnhet");
  assert.equal(negle?.filters.nameQuery, "negler");

  const advokat = resolveIndustryKeyword("3 advokater Oslo");
  assert.equal(advokat?.filters.professionId, "advokat");

  const megler = resolveIndustryKeyword("finn 5 eiendomsmeglere i Harstad");
  assert.equal(megler?.filters.professionId, "megler");
  assert.equal(megler?.filters.nameQuery, undefined);

  const apotek = resolveIndustryKeyword("finn 5 apotek i Tromsø");
  assert.equal(apotek?.filters.professionId, "apotek");
  assert.equal(apotek?.filters.nameQuery, "apotek");

  const tannlege = resolveIndustryKeyword("finn 5 tannleger i Tromsø");
  assert.equal(tannlege?.filters.professionId, "tannlege");
  assert.equal(tannlege?.filters.nameQuery, "tannlege");

  const maler = resolveIndustryKeyword("finn 5 malere i Bodø");
  assert.equal(maler?.filters.professionId, "maler");
  assert.equal(maler?.filters.nameQuery, "maler");
  assert.equal(maler?.filters.industryGroup, undefined);

  const rorlegger = resolveIndustryKeyword("finn 20 rørleggere i Bodø");
  assert.equal(rorlegger?.filters.professionId, "rorlegger");
  assert.equal(rorlegger?.filters.nameQuery, "rorlegger");
  assert.equal(rorlegger?.filters.industryGroup, undefined);

  const elektriker = resolveIndustryKeyword("finn 5 elektrikere i Oslo");
  assert.equal(elektriker?.filters.professionId, "elektriker");
  assert.equal(elektriker?.filters.nameQuery, "elektro");

  const murer = resolveIndustryKeyword("finn 3 murere i Trondheim");
  assert.equal(murer?.filters.professionId, "murer");
  assert.equal(murer?.filters.nameQuery, "murer");

  const blomster = resolveIndustryKeyword("finn blomsterbutikker i Bergen");
  assert.equal(blomster?.filters.professionId, "blomster");
  assert.equal(blomster?.filters.nameQuery, "blomster");

  const handverk = resolveIndustryKeyword("finn 5 håndverkere i Bodø");
  assert.equal(handverk?.filters.industryGroup, "bygg");
  assert.equal(handverk?.filters.professionId, undefined);

  const malerParsed = await parseSimpleListRequest("finn 5 malere i Bodø");
  assert.ok(malerParsed);
  assert.equal(malerParsed.searchArgs.professionId, "maler");
  assert.equal(malerParsed.searchArgs.nameQuery, "maler");
  assert.equal(malerParsed.searchArgs.industryGroup, undefined);

  const harstadFrisor = resolveIndustryKeyword("finn 5 eiendomsmeglere i Harstad");
  assert.notEqual(harstadFrisor?.filters.professionId, "frisor");

  const short = await parseSimpleListRequest("byggevare Bodø");
  assert.ok(short);
  assert.equal(short.searchArgs.municipalityCode, "1804");
  assert.equal(short.searchArgs.industryGroup, "bygg");

  const svalbard = await parseSimpleListRequest("finn 5 frisører i Svalbard");
  assert.ok(svalbard);
  assert.equal(svalbard.unknownPlace, true);
}

function testConcreteSummaryGate() {
  assert.equal(needsConcreteSummary("", true), true);
  assert.equal(needsConcreteSummary("Jeg skal søke nå.", true), true);
  assert.equal(
    needsConcreteSummary("Fant 12 frisører i Narvik — f.eks. Klipp AS, Hår & Vel.", true),
    false
  );
  assert.equal(needsConcreteSummary("Hei!", false), false);
}

function testFormatExamples() {
  assert.match(formatCompanyExamples(["A AS", "B AS"]), /A AS/);
  assert.equal(formatCompanyExamples([]), "");
}

function testStartupContext() {
  const ctx: AgentStartupContext = {
    serperUsed: 1400,
    serperLimit: 1500,
    serperRemaining: 100,
    contactRemaining: 50,
    contactLimit: 500,
    userMemoryBlock: "BRUKER-PREFERANSER:\n- default_municipality: 1806",
  };
  const prompt = buildAgentStartupContextPrompt(ctx);
  assert.match(prompt, /Serper/);
  assert.match(prompt, /100 igjen/);
  assert.match(prompt, /lav/i);
  assert.match(prompt, /1806/);
}

function testMalerRelevanceFilter() {
  assert.equal(
    isProfessionRelevantCompany("maler", {
      name: "Ferix Roe Service",
      industry_code: "43.99",
    }),
    false
  );
  assert.equal(
    isProfessionRelevantCompany("maler", {
      name: "Beiermann Bygg AS",
      industry_code: "43.39",
    }),
    false
  );
  assert.equal(
    isProfessionRelevantCompany("maler", {
      name: "Nordmaling AS",
      industry_code: "43.34",
    }),
    true
  );
  assert.equal(
    isProfessionRelevantCompany("maler", {
      name: "Malermester Hansen",
      industry_code: "43.99",
    }),
    true
  );
}

async function testWebsiteSalesLeadIntent() {
  const query =
    "finn meg 10 gode leads jeg mest sannsynlig kan kontakte og selge nettside til";

  assert.equal(isWebsiteSalesLeadIntent(query), true);
  assert.equal(isWebsiteSalesLeadListIntent(query), true);
  assert.equal(isSimpleListIntent(query), false);
  assert.equal(isSimpleSearchIntent(query), true);
  assert.equal(resolveIndustryKeyword(query), null);

  const cleaned = messageForIndustryResolution(query);
  assert.equal(resolveIndustryKeyword(cleaned), null);
  assert.doesNotMatch(cleaned, /nettside/i);

  const withoutPlace = await parseWebsiteSalesLeadRequest(query);
  assert.ok(withoutPlace);
  assert.equal(withoutPlace.limit, 10);
  assert.equal(withoutPlace.needsClarification, true);
  assert.match(withoutPlace.clarificationMessage ?? "", /område|Bodø|Narvik/i);

  const withDefault = await parseWebsiteSalesLeadRequest(query, {
    defaultMunicipality: { code: "1804", label: "Bodø" },
  });
  assert.ok(withDefault);
  assert.equal(withDefault.needsClarification, undefined);
  assert.equal(withDefault.searchArgs.municipalityCode, "1804");
  assert.equal(withDefault.searchArgs.withoutWebsite, true);
  assert.deepEqual(withDefault.searchArgs.excludeIndustryGroups, [
    "webbyra",
    "it",
    "reklame",
  ]);
  assert.equal(withDefault.searchArgs.industryGroup, undefined);
  assert.equal(withDefault.searchArgs.professionId, undefined);

  const withIndustry = await parseWebsiteSalesLeadRequest(
    "finn 10 gode leads frisører uten nettside i Bodø jeg kan selge nettside til"
  );
  assert.ok(withIndustry);
  assert.equal(withIndustry.searchArgs.professionId, "frisor");
  assert.equal(withIndustry.searchArgs.withoutWebsite, true);
  assert.notEqual(withIndustry.searchArgs.industryGroup, "webbyra");
}

async function main() {
  testResumeIntent();
  testHistoryWithTools();
  testProfessionMapping();
  testMalerRelevanceFilter();
  testSimpleSearchIntent();
  await testContextualFollowUp();
  await testSaveAndScanFollowUp();
  await testSimpleListIntent();
  await testWebsiteSalesLeadIntent();
  testConcreteSummaryGate();
  testFormatExamples();
  testStartupContext();
  console.log("eval-agent-scenarios: 11/11 OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
