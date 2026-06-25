import {
  agentLeadRankScore,
  hasCompanyPhone,
  isBadLeadCompany,
  isHoldingCompany,
} from "@/lib/brreg/lead-quality";
import { computeLeadScore } from "@/lib/sales/lead-score";
import type { Company } from "@/types/database";
import { DEFAULT_LANE_SEEDS } from "./board-config";
import type { SmartListLane } from "./types";

export type RankResult = {
  orgnr: string;
  ai_score: number;
  ai_score_reason: string;
  laneKey: string;
};

function clampScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function explainLeadRank(company: Company): string {
  const parts: string[] = [];
  if (isBadLeadCompany(company)) return "Svakt firma (konkurs/avvikling)";
  if (isHoldingCompany(company)) return "Holdingselskap — lav prioritet";

  if (hasCompanyPhone(company)) parts.push("Har telefon");
  else parts.push("Mangler telefon");

  if (company.has_email) parts.push("Har e-post");
  if (company.registered_at) {
    const days = Math.floor(
      (Date.now() - new Date(company.registered_at).getTime()) / 86400000
    );
    if (days <= 7) parts.push("Nytt firma (≤7 dager)");
    else if (days <= 30) parts.push("Relativt nytt firma");
  }

  if (!company.website?.trim()) parts.push("Ingen kjent nettside");
  if (/\bAS\b/i.test(company.name ?? "") && hasCompanyPhone(company)) {
    parts.push("AS med telefon");
  }

  return parts.slice(0, 4).join(" · ") || "Standard vurdering";
}

export function rankCompanyForSmartList(company: Company): RankResult {
  const raw = agentLeadRankScore(company);
  const base = computeLeadScore(company);
  const ai_score = clampScore(Math.max(base, raw > 0 ? raw : base * 0.5));

  let laneKey = "c";
  if (raw < 0 || isBadLeadCompany(company)) laneKey = "archive";
  else if (ai_score >= 75) laneKey = "a";
  else if (ai_score >= 45) laneKey = "b";

  return {
    orgnr: company.orgnr,
    ai_score,
    ai_score_reason: explainLeadRank(company),
    laneKey,
  };
}

export function rankCompaniesForSmartList(companies: Company[]): RankResult[] {
  return companies.map(rankCompanyForSmartList);
}

export function laneIdForKey(
  lanes: SmartListLane[],
  laneKey: string
): string | null {
  const seed = DEFAULT_LANE_SEEDS.find((s) => s.key === laneKey);
  if (!seed) return null;
  const lane = lanes.find((l) => l.name === seed.name);
  return lane?.id ?? null;
}

export function summarizeSmartListStats(items: { ai_score: number | null }[]): {
  avgScore: number;
  aTier: number;
} {
  const scores = items
    .map((i) => i.ai_score)
    .filter((s): s is number => typeof s === "number");
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  const aTier = scores.filter((s) => s >= 75).length;
  return { avgScore, aTier };
}
