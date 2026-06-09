import type { ToolExecutionResult } from "@/lib/agent/execute-tool";

const MAX_ORGNR_SAMPLE = 8;

/** Strip store lister fra tool-svar — modellen trenger sammendrag + antall, ikke alle orgnr. */
export function compactToolResultForModel(
  result: ToolExecutionResult
): Record<string, unknown> {
  const payload: Record<string, unknown> = { summary: result.summary };

  for (const [key, value] of Object.entries(result.data)) {
    if (key === "orgnrs" || key === "remainingOrgnrs") {
      if (Array.isArray(value)) {
        const orgnrs = value as string[];
        payload[`${key}Count`] = orgnrs.length;
        if (orgnrs.length > 0 && orgnrs.length <= MAX_ORGNR_SAMPLE) {
          payload[key] = orgnrs;
        } else if (orgnrs.length > MAX_ORGNR_SAMPLE) {
          payload[`${key}Sample`] = orgnrs.slice(0, MAX_ORGNR_SAMPLE);
        }
      }
      continue;
    }

    if (key === "companies" && Array.isArray(value)) {
      const companies = value as Array<{
        orgnr?: string;
        name?: string;
        phone?: string | null;
        municipality_name?: string | null;
      }>;
      payload.companyCount = companies.length;
      payload.companies = companies.slice(0, 8).map((company) => ({
        orgnr: company.orgnr,
        name: company.name,
        phone: company.phone ?? undefined,
        municipality_name: company.municipality_name ?? undefined,
      }));
      continue;
    }

    if (typeof value === "string" && value.length > 500) {
      payload[key] = `${value.slice(0, 500)}…`;
      continue;
    }

    payload[key] = value;
  }

  return payload;
}
