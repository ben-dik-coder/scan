import type { FilterState } from "@/components/CompanyFilters";
import { isLeadWithoutOwnSite } from "@/lib/agent/website-presence";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

export type AgentSavedListFilters = Partial<FilterState> & {
  agentOrgnrs?: string[];
  modus?: string;
  createdBy?: string;
};

export function agentOrgnrsFromFilters(
  filters: AgentSavedListFilters | Record<string, unknown> | null | undefined
): string[] {
  if (!filters || !Array.isArray(filters.agentOrgnrs)) return [];
  return filters.agentOrgnrs.filter(
    (o): o is string => typeof o === "string" && o.trim().length > 0
  );
}

/** AI-lister: vis også firma som ikke er Google-sjekket ennå. */
export function matchesAgentListNoWebsiteTab(
  scan: WebsiteScanResult | undefined,
  agentListActive: boolean
): boolean {
  if (!scan) return agentListActive;
  return isLeadWithoutOwnSite(scan);
}

/** AI-lister skal alltid vise orgnr uavhengig av registreringsdato. */
export const AGENT_LIST_PERIOD_DAYS = 0;

export function isAgentSavedListFilters(
  filters: AgentSavedListFilters | Record<string, unknown> | null | undefined
): boolean {
  if (!filters) return false;
  if (filters.createdBy === "agent") return true;
  return agentOrgnrsFromFilters(filters).length > 0;
}

export function mergeAgentListFilters(
  partial: AgentSavedListFilters & { professionSearch?: string }
): FilterState {
  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: AGENT_LIST_PERIOD_DAYS,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionId: partial.professionId ?? "",
    nameQuery: partial.nameQuery ?? "",
    websitePresence:
      (partial.websitePresence as FilterState["websitePresence"]) ?? "without",
    facebookPresence: partial.facebookPresence ?? "all",
    instagramPresence: partial.instagramPresence ?? "all",
  };
}

/** Filter som brukes når bruker åpner en AI-liste — uten tidsvindu som kan skjule firma. */
export function filtersForAgentListApplication(
  partial: AgentSavedListFilters & { professionSearch?: string },
  current: FilterState
): FilterState {
  const merged = mergeAgentListFilters(partial);
  return {
    ...current,
    ...merged,
    days: AGENT_LIST_PERIOD_DAYS,
    websitePresence: "all",
    facebookPresence: "all",
    instagramPresence: "all",
  };
}
