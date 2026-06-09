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
  isAgentResumeIntent,
  isAgentPostCancelFollowUp,
} from "../src/lib/agent/prompt.ts";
import { needsConcreteSummary } from "../src/lib/agent/run-agent.ts";
import { formatCompanyExamples } from "../src/lib/agent/format-summary.ts";
import {
  mapProfessionToIndustryGroup,
  resolveAgentSearchIndustryFilters,
} from "../src/lib/agent/search-filters.ts";
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
  assert.ok(trimmed.length <= 40);
}

function testProfessionMapping() {
  assert.equal(mapProfessionToIndustryGroup("bilverksted"), "handel");
  assert.equal(mapProfessionToIndustryGroup("advokat"), "it");
  assert.equal(resolveAgentSearchIndustryFilters({ professionId: "frisor" }).industryGroup, "frisor");
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

function main() {
  testResumeIntent();
  testHistoryWithTools();
  testProfessionMapping();
  testConcreteSummaryGate();
  testFormatExamples();
  testStartupContext();
  console.log("eval-agent-scenarios: 6/6 OK");
}

main();
