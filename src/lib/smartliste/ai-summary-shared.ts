import type { SmartListCompanyFacts } from "@/lib/smartliste/company-facts";

/** Klient-sikker type + lesing av lagret oppsummering (ingen server-imports). */
export type SmartListAiSummary = {
  summary: string;
  whatTheyDo: string;
  opportunities: string[];
  approach: string;
  generated_at: string;
  facts: SmartListCompanyFacts;
  sources?: string[];
  usedAi?: boolean;
  researchLinesCount?: number;
  liveScanRan?: boolean;
};

export function readAiSummaryFromCustomFields(
  customFields: Record<string, unknown> | null | undefined
): SmartListAiSummary | null {
  const raw = customFields?.ai_summary;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as SmartListAiSummary;
  if (!obj.summary?.trim()) return null;
  return obj;
}
