import OpenAI from "openai";
import type { CompanyResearchBundle } from "@/lib/smartliste/company-research";
import { researchToPromptBlock } from "@/lib/smartliste/company-research";
import type { SmartListAiSummary } from "@/lib/smartliste/ai-summary-shared";

export type { SmartListAiSummary } from "@/lib/smartliste/ai-summary-shared";
export { readAiSummaryFromCustomFields } from "@/lib/smartliste/ai-summary-shared";

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function parseSummaryJson(raw: string): Omit<SmartListAiSummary, "generated_at" | "facts" | "sources" | "usedAi" | "researchLinesCount" | "liveScanRan"> | null {
  try {
    const parsed = JSON.parse(raw) as {
      summary?: string;
      whatTheyDo?: string;
      opportunities?: string[];
      approach?: string;
    };
    if (!parsed.summary?.trim()) return null;
    const opportunities = Array.isArray(parsed.opportunities)
      ? parsed.opportunities.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      : [];
    if (opportunities.length === 0) return null;
    return {
      summary: parsed.summary.trim(),
      whatTheyDo: parsed.whatTheyDo?.trim() || "",
      opportunities,
      approach: parsed.approach?.trim() || "",
    };
  } catch {
    return null;
  }
}

const GENERIC_BANNED = [
  "profesjonell nettside som gjør det enkelt",
  "styrke digital synlighet",
  "gjøre det lettere for kunder å ta kontakt",
  "digital profil som matcher",
  "moderne nettside",
  "bedre synlighet på nett",
  "digital tilstedeværelse",
];

function isGeneric(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_BANNED.some((p) => lower.includes(p));
}

function mentionsCompany(text: string, companyName: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+(as|asa|da|enk|ans)$/i, "")
      .replace(/[^a-zæøå0-9]/gi, "")
      .trim();
  const name = norm(companyName);
  if (name.length < 4) return true;
  const compact = norm(text);
  return compact.includes(name.slice(0, Math.min(name.length, 12)));
}

function buildResearchedFallback(
  research: CompanyResearchBundle
): Omit<SmartListAiSummary, "generated_at" | "facts" | "sources" | "usedAi" | "researchLinesCount" | "liveScanRan"> {
  const { facts, scan, roles, webHits } = research;
  const opportunities: string[] = [];

  if (facts.websiteStatus.includes("Ingen egen") || facts.websiteStatus.includes("ukjent")) {
    if (scan?.bookingPlatform) {
      opportunities.push(
        `Erstatte/utfylle ${scan.bookingPlatform} med egen nettside som bygger merkevare for ${facts.name}`
      );
    } else if (scan?.facebookUrl && !scan?.websiteUrl) {
      opportunities.push(
        "Egen nettside i tillegg til Facebook — mange kunder googler før de velger leverandør"
      );
    } else {
      opportunities.push(
        `Synlig nettside for ${facts.name} slik at kunder i ${facts.municipality ?? "området"} finner dem`
      );
    }
  } else if (scan?.websiteUrl) {
    opportunities.push(
      `Forbedre/oppdatere eksisterende nettside (${scan.websiteDomain ?? "funnet domene"}) for bedre konvertering`
    );
  }

  if (!facts.hasPhone && scan?.enrichedPhone) {
    opportunities.push(`Synliggjøre telefon ${scan.enrichedPhone} tydelig på nett`);
  } else if (!facts.hasPhone) {
    opportunities.push("Gjøre det enkelt å ringe/booking — telefon mangler i dagens data");
  }

  if (facts.industryCode?.startsWith("96")) {
    opportunities.push("Online booking og tydelig prisliste — typisk viktig for servicebedrifter");
  }

  if (opportunities.length < 2) {
    opportunities.push(
      `Tilpasset digital løsning for ${facts.industry.toLowerCase()} — basert på det vi vet om ${facts.name}`
    );
  }

  const leader = facts.dagligLeder;
  const roleHint = roles[0] ? `${roles[0].role} ${roles[0].name}` : null;
  const webHint = webHits.find((h) => h.snippet?.trim())?.snippet?.slice(0, 140);
  const brregLine = research.researchLines.find((l) => l.startsWith("Brreg bransje:"));
  const scanLine = research.researchLines.find(
    (l) => l.includes("Facebook") || l.includes("Booking") || l.includes("Funnet nettside")
  );

  let summary = `${facts.name} er registrert ${facts.establishedLabel} og driver med ${facts.industry.toLowerCase()}`;
  if (facts.municipality) summary += ` i ${facts.municipality}`;
  summary += ".";
  if (scanLine) summary += ` ${scanLine.replace(/^[^:]+:\s*/, "")}.`;
  else if (webHint) summary += ` Fra nett: «${webHint}…»`;
  else if (scan?.facebookProfile?.intro) {
    summary += ` Facebook beskriver: «${scan.facebookProfile.intro.slice(0, 100)}…»`;
  } else if (brregLine) {
    summary += ` Brreg: ${brregLine.replace("Brreg bransje: ", "")}.`;
  }

  const whatTheyDo =
    scan?.facebookProfile?.category ??
    scan?.instagramProfile?.category ??
    (webHint ? webHint.slice(0, 120) : facts.industry);

  return {
    summary,
    whatTheyDo,
    opportunities: opportunities.slice(0, 4),
    approach: leader
      ? `Kontakt ${leader} — vis konkret verdi for ${facts.name} basert på ${facts.websiteStatus.toLowerCase()}.`
      : roleHint
        ? `Research fant ${roleHint} — start med deres største digitale gap.`
        : `Research viser ${facts.websiteStatus.toLowerCase()} — tilpass tilbud til ${facts.industry.toLowerCase()}.`,
  };
}

export async function generateSmartListAiSummary(
  research: CompanyResearchBundle,
  icpPrompt?: string
): Promise<SmartListAiSummary> {
  const generated_at = new Date().toISOString();
  const { facts, sources, researchLines, liveScanRan } = research;
  const meta = {
    researchLinesCount: researchLines.length,
    liveScanRan: Boolean(liveScanRan),
  };

  const client = getOpenAIClient();
  if (!client) {
    return {
      ...buildResearchedFallback(research),
      generated_at,
      facts,
      sources,
      usedAi: false,
      ...meta,
    };
  }

  const icpBlock = icpPrompt?.trim()
    ? `\nDette selger vi:\n${icpPrompt.trim()}\n`
    : "\nVi selger nettsider, synlighet og digital tilstedeværelse til norske SMB.\n";

  const system = `Du er senior salgsanalytiker for norske B2B-leads.
Du får RESEARCH-data fra Brreg, web-skanning og Google — bruk KUN dette, ikke generelle floskler.
Svar på norsk. Returner KUN gyldig JSON:
{ "summary": "...", "whatTheyDo": "...", "opportunities": ["...", "..."], "approach": "..." }

Regler:
- summary: 2-4 setninger som ALLTID nevner firmanavnet og minst 2 konkrete fakta fra research (etablering, bransje, nett, Facebook/Instagram, roller, søketreff).
- whatTheyDo: presis beskrivelse av virksomheten basert på bransje + web/Facebook/Instagram/søketreff — ikke bare bransjenavn.
- opportunities: 2-4 punkter — hver må peke på et KONKRET gap eller mulighet for DETTE firmaet (mangler web, kun booking, gammel profil, osv.). Ingen generiske setninger alle firma kan få.
- approach: én setning med navngitt kontaktperson hvis funnet, ellers konkret planleggingsråd for dette firmaet.
- FORBUDT uten firmaspesifikk kontekst: "profesjonell nettside", "styrke digital synlighet", "digital tilstedeværelse", "moderne nettside".
- Hvert svar skal være UNIKT — to ulike firma skal aldri få identisk tekst.`;

  const user = `${icpBlock}
${researchToPromptBlock(research)}

Analyser GRUNDIG og gi unikt svar for ${facts.name}. Nevn firmanavnet i summary.`;

  try {
    const response = await client.chat.completions.create({
      model:
        process.env.OPENAI_SMARTLISTE_MODEL?.trim() ||
        process.env.OPENAI_AGENT_MODEL?.trim() ||
        "gpt-4o-mini",
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    const parsed = parseSummaryJson(content);
    if (
      parsed &&
      mentionsCompany(parsed.summary, facts.name) &&
      !isGeneric(parsed.summary) &&
      !parsed.opportunities.every((o) => isGeneric(o))
    ) {
      return { ...parsed, generated_at, facts, sources, usedAi: true, ...meta };
    }
  } catch (err) {
    console.error("[smartliste/ai-summarize]", err);
  }

  return {
    ...buildResearchedFallback(research),
    generated_at,
    facts,
    sources,
    usedAi: false,
    ...meta,
  };
}
