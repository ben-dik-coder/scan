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
import { capScanJobOrgnrs } from "../src/lib/agent/chunked-scan.ts";
import {
  isContextualListFollowUp,
  isListEnrichFollowUp,
  isScopeClarificationReply,
  isSaveListFollowUp,
  isScanWebsitesFollowUp,
  isSearchAndScanIntent,
  isSimpleListIntent,
  isWebsiteSalesLeadListIntent,
  parseContextualListRequest,
  parseSaveListRequest,
  collectAlreadyScannedOrgnrs,
  parseScanWebsitesRequest,
  wantsFacebookInScan,
  parseSearchAndScanRequest,
  parseSimpleListRequest,
  parseWebsiteSalesLeadRequest,
  formatPoolExhaustedReply,
  formatWebsiteSalesLeadReply,
} from "../src/lib/agent/fast-list.ts";
import {
  isAgentResumeIntent,
  isAgentPostCancelFollowUp,
  isSimpleSearchIntent,
} from "../src/lib/agent/prompt.ts";
import {
  buildAgentCompletionSummary,
  needsConcreteSummary,
} from "../src/lib/agent/run-agent.ts";
import {
  isLikelyTruncatedAgentResponse,
  isStreamLikelyIncomplete,
} from "../src/lib/agent/response-complete.ts";
import { formatCompanyExamples } from "../src/lib/agent/format-summary.ts";
import {
  mapProfessionToIndustryGroup,
  resolveAgentSearchIndustryFilters,
  resolveIndustryKeyword,
} from "../src/lib/agent/search-filters.ts";
import { resolveProfessionQuery } from "../src/lib/constants/professions.ts";
import {
  formatNearbyPlaceSuggestion,
  getNearbyMunicipalitySuggestions,
} from "../src/lib/agent/municipality.ts";
import {
  isWebsiteSalesLeadIntent,
  messageForIndustryResolution,
} from "../src/lib/agent/website-sales-leads.ts";
import { isProfessionRelevantCompany } from "../src/lib/brreg/profession-relevance.ts";
import {
  companyHasKnownWebsite,
  filterWebsiteSalesLeadCompanies,
  isHoldingCompany,
  isWeakWebsiteSalesLead,
  rankWebsiteSalesLeadCompanies,
  websiteSalesLeadRankScore,
} from "../src/lib/brreg/lead-quality.ts";
import type { AgentMessage } from "../src/types/database.ts";
import type { WebsiteScanResult } from "../src/lib/website-scan/types.ts";

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

async function testNationwidePaginationFollowUp() {
  const grillHistory = [
    { role: "user", content: "finn grillbar i Norge" },
    {
      role: "assistant",
      content:
        "Her er 10 grillbar i Norge:\n\n1. **Grill 1 AS** · orgnr 111111111 · OSLO\n2. **Grill 2 AS** · orgnr 222222222 · BERGEN",
    },
    { role: "user", content: "finn 10 til" },
    {
      role: "assistant",
      content:
        "Skal jeg hente 10 til fra hele landet, eller vil du snevre inn til fylke/kommune?",
    },
  ];

  assert.equal(isScopeClarificationReply("fra hele landet"), true);
  assert.equal(isScopeClarificationReply("i norge"), true);

  const moreParsed = await parseContextualListRequest("finn 10 til", grillHistory);
  assert.ok(moreParsed);
  assert.equal(moreParsed.limit, 10);
  assert.equal(moreParsed.searchArgs.nameQuery, "grill");
  assert.equal(moreParsed.searchArgs.displayLimit, 10);
  assert.equal(moreParsed.searchArgs.municipalityCode, undefined);
  assert.deepEqual(moreParsed.excludeOrgnrs, ["111111111", "222222222"]);
  assert.ok(Number(moreParsed.searchArgs.limit) >= 14);

  const scopeParsed = await parseContextualListRequest(
    "fra hele landet",
    [
      ...grillHistory,
      { role: "user", content: "fra hele landet" },
    ]
  );
  assert.ok(scopeParsed);
  assert.equal(scopeParsed.limit, 10);
  assert.equal(scopeParsed.locationLabel, "Norge");
  assert.equal(scopeParsed.searchArgs.nameQuery, "grill");
  assert.equal(scopeParsed.searchArgs.municipalityCode, undefined);
  assert.equal(scopeParsed.searchArgs.regionId, undefined);
  assert.equal(scopeParsed.searchArgs.displayLimit, 10);
}

async function testSaveAndScanFollowUp() {
  assert.equal(isSaveListFollowUp("lagre som liste"), true);
  assert.equal(isScanWebsitesFollowUp("skann nettside på de to første"), true);
  assert.equal(isScanWebsitesFollowUp("skann de tre første"), true);
  assert.equal(isScanWebsitesFollowUp("skann de neste 5"), true);
  assert.equal(isScanWebsitesFollowUp("skann neste fem"), true);
  assert.equal(isScanWebsitesFollowUp("skann 10"), true);
  assert.equal(isScanWebsitesFollowUp("sjekk 10"), true);

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

  const longHistory = [
    ...history,
    {
      role: "assistant",
      content:
        "Skannet 2 nettsider:\n\n1. **Advokat AS** · orgnr 935001684 · ingen egen nettside\n2. **Lexx Advokat AS** · orgnr 935987717 · https://lexx.no",
    },
    {
      role: "user",
      content: "finn 5 advokater til i Oslo",
    },
    {
      role: "assistant",
      content:
        "Her er 3 til:\n\n3. **Jus AS** · orgnr 911111111 · tlf 22 00 00 00 · OSLO\n4. **Rett AS** · orgnr 922222222 · tlf 22 00 00 01 · OSLO\n5. **Dom AS** · orgnr 933333333 · tlf 22 00 00 02 · OSLO",
    },
  ];

  assert.deepEqual(collectAlreadyScannedOrgnrs(longHistory), [
    "935001684",
    "935987717",
  ]);

  const nextScan = parseScanWebsitesRequest("skann de neste 3", longHistory);
  assert.ok(nextScan);
  assert.equal(nextScan.count, 3);
  assert.deepEqual(nextScan.orgnrs, ["911111111", "922222222", "933333333"]);

  const tenOrgnrs = Array.from({ length: 12 }, (_, i) =>
    String(910000000 + i)
  );
  const tenHistory = [
    { role: "user", content: "finn 12 advokater i Oslo" },
    {
      role: "assistant",
      content: `Her er 12 advokater:\n\n${tenOrgnrs
        .map((orgnr, index) => `${index + 1}. **Firma ${index + 1}** · orgnr ${orgnr}`)
        .join("\n")}`,
    },
  ];
  const scanTen = parseScanWebsitesRequest("skann de 10 første", tenHistory);
  assert.ok(scanTen);
  assert.equal(scanTen.count, 10);
  assert.equal(scanTen.orgnrs.length, 10);

  const scanTenShort = parseScanWebsitesRequest("skann 10", tenHistory);
  assert.ok(scanTenShort);
  assert.equal(scanTenShort.count, 10);
  assert.equal(scanTenShort.orgnrs.length, 10);

  const capped = capScanJobOrgnrs(tenOrgnrs);
  assert.equal(capped.orgnrs.length, 10);
  assert.equal(capped.remaining, 2);
}

async function testListEnrichFollowUp() {
  const restaurantHistory = [
    { role: "user", content: "finn meg de 5 nyeste restaurantene i norge" },
    {
      role: "assistant",
      content:
        "Her er 5 restauranter i Norge:\n\n" +
        "1. **JAHU CATERING** · orgnr 933492573 · OSLO\n" +
        "2. **HEGGEDAL PIZZA & BAR** · orgnr 933492574 · ASKER\n" +
        "3. **NORDLYS RESTAURANT** · orgnr 933492575 · TROMSØ\n" +
        "4. **FJORD MAT** · orgnr 933492576 · BERGEN\n" +
        "5. **SMAK KJØKKEN** · orgnr 933492577 · TRONDHEIM",
    },
  ];

  const followUp = "finn fb og evt nettside på disse";

  assert.equal(isListEnrichFollowUp(followUp), true);
  assert.equal(isScanWebsitesFollowUp(followUp), true);
  assert.equal(isSimpleListIntent(followUp), false);
  assert.equal(isWebsiteSalesLeadListIntent(followUp), false);
  assert.equal(wantsFacebookInScan(followUp), true);
  assert.match(resolveIndustryKeyword(followUp)?.label ?? "", /webdesign/i);

  const scan = parseScanWebsitesRequest(followUp, restaurantHistory);
  assert.ok(scan);
  assert.equal(scan.count, 5);
  assert.equal(scan.includeFacebook, true);
  assert.deepEqual(scan.orgnrs, [
    "933492573",
    "933492574",
    "933492575",
    "933492576",
    "933492577",
  ]);

  assert.equal(isListEnrichFollowUp("sjekk nettside på disse"), true);
  assert.equal(isScanWebsitesFollowUp("skann disse"), true);
  assert.equal(isListEnrichFollowUp("finn fb på den listen"), true);
  assert.equal(isListEnrichFollowUp("finn 5 webdesign i Oslo"), false);
  assert.equal(isSimpleListIntent("finn 5 webdesign i Oslo"), true);

  const scanWithoutFb = parseScanWebsitesRequest(
    "sjekk nettside på disse",
    restaurantHistory
  );
  assert.ok(scanWithoutFb);
  assert.equal(scanWithoutFb.includeFacebook, false);
}

async function testSimpleListIntent() {
  assert.equal(isSimpleListIntent("finn meg 5 byggevarehandlere"), true);
  assert.equal(isSimpleListIntent("finn 5 byggevarehandler i Bodø"), true);
  assert.equal(isSimpleListIntent("finn 5 frisører i Bodø"), true);
  assert.equal(isSimpleListIntent("finn 3 kulturfirma i Narvik"), true);
  assert.equal(isSimpleListIntent("finn grillbar i Norge"), true);
  assert.equal(isSimpleListIntent("finn 5 grillbar i Bergen"), true);
  assert.equal(isSimpleListIntent("finn meg 5 nyeste resturanter"), true);
  assert.equal(isSimpleListIntent("finn 3 tatovering i Oslo"), true);
  assert.equal(isSimpleListIntent("finn 5 firma i Bergen"), true);
  assert.equal(isSimpleListIntent("finn meg 5 bedrifter i Bergen"), true);
  assert.equal(isSimpleListIntent("finn frisører uten nettside"), false);
  assert.equal(isSimpleListIntent("skann nettside for disse"), false);

  const genericBergen = await parseSimpleListRequest("finn 5 firma i Bergen");
  assert.ok(genericBergen);
  assert.equal(genericBergen.limit, 5);
  assert.equal(genericBergen.searchArgs.municipalityCode, "4601");
  assert.equal(genericBergen.searchArgs.fastList, true);
  assert.equal(genericBergen.searchArgs.industryGroup, undefined);

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

  const grillbar = await parseSimpleListRequest("finn grillbar i Norge");
  assert.ok(grillbar);
  assert.equal(grillbar.industryLabel, "grillbar");
  assert.equal(grillbar.searchArgs.industryGroup, "servering");
  assert.equal(grillbar.searchArgs.nameQuery, "grill");
  assert.equal(grillbar.locationLabel, "Norge");

  const grillBergen = await parseSimpleListRequest("finn 5 grillbar i Bergen");
  assert.ok(grillBergen);
  assert.equal(grillBergen.searchArgs.municipalityCode, "4601");

  const resturanterKeyword = resolveIndustryKeyword("finn meg 5 nyeste resturanter");
  assert.notEqual(resturanterKeyword?.filters.professionId, "megler");
  assert.equal(resturanterKeyword?.filters.professionId, "restaurant");
  assert.equal(resturanterKeyword?.filters.nameQuery, "restaurant");
  assert.equal(resturanterKeyword?.filters.industryGroup, undefined);

  const resturanterParsed = await parseSimpleListRequest("finn meg 5 nyeste resturanter");
  assert.ok(resturanterParsed);
  assert.equal(resturanterParsed.limit, 5);
  assert.equal(resturanterParsed.searchArgs.professionId, "restaurant");
  assert.equal(resturanterParsed.searchArgs.nameQuery, "restaurant");
  assert.equal(resturanterParsed.searchArgs.industryGroup, undefined);
  assert.equal(resturanterParsed.searchArgs.days, 0);
  assert.equal(resturanterParsed.locationLabel, "Norge");

  const restauranterKeyword = resolveIndustryKeyword("finn 5 nyeste restauranter i Oslo");
  assert.equal(restauranterKeyword?.filters.professionId, "restaurant");
  assert.notEqual(
    resolveProfessionQuery("finn meg 5 nyeste resturanter")?.professionId,
    "megler"
  );
}

function testNearbySuggestions() {
  assert.deepEqual(getNearbyMunicipalitySuggestions("1806"), [
    "Tromsø",
    "Harstad",
  ]);
  assert.match(
    formatNearbyPlaceSuggestion("1806", "elektrikere"),
    /Tromsø|Harstad/i
  );
  assert.match(
    formatPoolExhaustedReply({
      industryLabel: "elektrikere",
      locationLabel: "Narvik",
      seenCount: 5,
      municipalityCode: "1806",
    }),
    /Tromsø|Harstad/i
  );
  assert.doesNotMatch(
    formatPoolExhaustedReply({
      industryLabel: "elektrikere",
      locationLabel: "Narvik",
      seenCount: 5,
      municipalityCode: "1806",
    }),
    /filter|tool|kommunekode/i
  );
}

async function testSearchAndScanIntent() {
  assert.equal(
    isSearchAndScanIntent("finn 5 frisører i Bodø og skann nettside"),
    true
  );
  assert.equal(isSearchAndScanIntent("skann de neste 5"), false);
  assert.equal(isSearchAndScanIntent("finn 5 frisører i Bodø"), false);

  const parsed = await parseSearchAndScanRequest(
    "finn 5 frisører i Bodø og skann nettside",
    { defaultMunicipality: { code: "1804", label: "Bodø" } }
  );
  assert.ok(parsed);
  assert.equal(parsed.scanLimit, 5);
  assert.equal(parsed.listRequest.searchArgs.professionId, "frisor");
  assert.equal(parsed.listRequest.searchArgs.municipalityCode, "1804");
}

function testLargeJobCompletionSummary() {
  const summary = buildAgentCompletionSummary({
    toolSummaries: ["Sjekket nettside for 5 firma", "Fant 3 uten egen nettside"],
    hitMaxLoops: false,
  });
  assert.match(summary, /Sjekket nettside for 5 firma/);
  assert.doesNotMatch(summary, /Oppsummert|verktøy|filter/i);

  const capped = buildAgentCompletionSummary({
    toolSummaries: ["Sjekket nettside for 5 firma"],
    hitMaxLoops: true,
  });
  assert.match(capped, /mange steg/i);
}

function testConcreteSummaryGate() {
  assert.equal(needsConcreteSummary("", true), true);
  assert.equal(needsConcreteSummary("Jeg skal søke nå.", true), true);
  assert.equal(
    needsConcreteSummary("Fant 12 frisører i Narvik — f.eks. Klipp AS, Hår & Vel.", true),
    false
  );
  assert.equal(needsConcreteSummary("Hei!", false), false);
  assert.equal(
    isLikelyTruncatedAgentResponse(
      "Jeg har skannet de fem neste. Kort oppsummering: 3 av 5 har egen nettside, 2 mangler. Detaljer: 1."
    ),
    true
  );
  assert.equal(
    needsConcreteSummary(
      "Jeg har skannet de fem neste. Kort oppsummering: 3 av 5 har egen nettside, 2 mangler. Detaljer: 1.",
      true
    ),
    true
  );
  assert.equal(
    isStreamLikelyIncomplete({
      assistantText: "Detaljer: 1.",
      receivedDone: false,
      hadActiveTool: true,
    }),
    true
  );
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
  assert.doesNotMatch(
    withoutPlace.clarificationMessage ?? "",
    /webbyrå|uten nettside|ikke web/i
  );

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
  assert.equal(withDefault.searchArgs.requirePhone, true);
  assert.equal(withDefault.requirePhone, true);

  const withIndustry = await parseWebsiteSalesLeadRequest(
    "finn 10 gode leads frisører uten nettside i Bodø jeg kan selge nettside til"
  );
  assert.ok(withIndustry);
  assert.equal(withIndustry.searchArgs.professionId, "frisor");
  assert.equal(withIndustry.searchArgs.withoutWebsite, true);
  assert.notEqual(withIndustry.searchArgs.industryGroup, "webbyra");
}

function testWebsiteSalesLeadQuality() {
  const screenshotLeads = [
    {
      orgnr: "937402384",
      name: "MILJØ SØNVISEN",
      website: null,
      phone: null,
      mobile: null,
      industry_code: null,
      municipality_name: "BODØ",
      email: null,
      registered_at: "2024-01-01",
      has_email: false,
      email_is_generic: false,
      municipality_code: "1804",
      city: null,
      brreg_updated_at: null,
      daglig_leder: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    {
      orgnr: "937775032",
      name: "ANDREAS ØSTVIK HOLDING AS",
      website: null,
      phone: "12345678",
      mobile: null,
      industry_code: "00.000",
      municipality_name: "BODØ",
      email: null,
      registered_at: "2024-01-01",
      has_email: false,
      email_is_generic: false,
      municipality_code: "1804",
      city: null,
      brreg_updated_at: null,
      daglig_leder: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    {
      orgnr: "937731590",
      name: "SEVERINSEN TAK- OG BYGGESERVICE AS",
      website: null,
      phone: "98765432",
      mobile: null,
      industry_code: "43.410",
      municipality_name: "BODØ",
      email: null,
      registered_at: "2024-01-02",
      has_email: false,
      email_is_generic: false,
      municipality_code: "1804",
      city: null,
      brreg_updated_at: null,
      daglig_leder: null,
      created_at: "2024-01-02",
      updated_at: "2024-01-02",
    },
    {
      orgnr: "937771460",
      name: "VASJUCENKO ENK",
      website: null,
      phone: null,
      mobile: null,
      industry_code: "53.200",
      municipality_name: "BODØ",
      email: null,
      registered_at: "2024-01-03",
      has_email: false,
      email_is_generic: false,
      municipality_code: "1804",
      city: null,
      brreg_updated_at: null,
      daglig_leder: null,
      created_at: "2024-01-03",
      updated_at: "2024-01-03",
    },
  ];

  assert.equal(isHoldingCompany(screenshotLeads[1]), true);
  assert.equal(isWeakWebsiteSalesLead(screenshotLeads[0]), true);
  assert.equal(isWeakWebsiteSalesLead(screenshotLeads[1]), true);
  assert.equal(isWeakWebsiteSalesLead(screenshotLeads[3]), true);
  assert.equal(isWeakWebsiteSalesLead(screenshotLeads[2]), false);

  const filtered = filterWebsiteSalesLeadCompanies(screenshotLeads);
  assert.deepEqual(
    filtered.map((company) => company.orgnr),
    ["937731590"]
  );

  const scanWithSite: WebsiteScanResult = {
    orgnr: "937731590",
    hasWebsite: true,
    websiteKind: "own",
    websiteUrl: "https://severinsen-tak.no",
    websiteDomain: "severinsen-tak.no",
    bookingPlatform: null,
    source: "google",
    confidence: "high",
    query: "test",
    scannedAt: "2024-01-01",
  };
  assert.equal(companyHasKnownWebsite(screenshotLeads[2], scanWithSite), true);

  const scanNoSite: WebsiteScanResult = {
    ...scanWithSite,
    hasWebsite: false,
    websiteKind: "none",
    websiteUrl: null,
    websiteDomain: null,
    confidence: "medium",
  };
  const scanMap = new Map<string, WebsiteScanResult>([
    ["937731590", scanNoSite],
  ]);
  assert.equal(
    websiteSalesLeadRankScore(screenshotLeads[2], scanNoSite) >
      websiteSalesLeadRankScore(screenshotLeads[2]),
    true
  );
  const ranked = rankWebsiteSalesLeadCompanies(
    filterWebsiteSalesLeadCompanies(screenshotLeads),
    scanMap
  );
  assert.equal(ranked[0]?.orgnr, "937731590");
}

function testWebsiteSalesLeadReplyFormat() {
  const reply = formatWebsiteSalesLeadReply(
    [
      {
        orgnr: "123456789",
        name: "Klipp AS",
        phone: "90000000",
        municipality_name: "Bodø",
      },
    ],
    {
      limit: 10,
      industryLabel: "frisører",
      locationLabel: "Bodø",
      searchArgs: {},
    }
  );

  assert.match(reply, /Her er 1 frisører i Bodø du kan ta kontakt med/i);
  assert.doesNotMatch(reply, /webbyrå|webbyra|uten nettside|gode leads|ekskluder|IT/i);

  const clarification = formatWebsiteSalesLeadReply([], {
    limit: 10,
    industryLabel: "firma",
    locationLabel: "",
    searchArgs: {},
    needsClarification: true,
    clarificationMessage:
      "Hvilket område vil du søke i? Si for eksempel «i Bodø» eller «i Narvik».",
  });
  assert.match(clarification, /område/i);
  assert.doesNotMatch(clarification, /webbyrå|uten nettside|ikke web/i);
}

async function main() {
  testResumeIntent();
  testHistoryWithTools();
  testProfessionMapping();
  testMalerRelevanceFilter();
  testSimpleSearchIntent();
  await testContextualFollowUp();
  await testNationwidePaginationFollowUp();
  await testSaveAndScanFollowUp();
  await testListEnrichFollowUp();
  await testSearchAndScanIntent();
  await testSimpleListIntent();
  testNearbySuggestions();
  await testWebsiteSalesLeadIntent();
  testWebsiteSalesLeadQuality();
  testWebsiteSalesLeadReplyFormat();
  testLargeJobCompletionSummary();
  testConcreteSummaryGate();
  testFormatExamples();
  testStartupContext();
  console.log("eval-agent-scenarios: 18/18 OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
