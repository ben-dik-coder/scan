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

export function mergeAgentListFilters(
  partial: AgentSavedListFilters & { professionSearch?: string }
): FilterState {
  return {
    regionId: partial.regionId ?? "",
    municipalityCode: partial.municipalityCode ?? "",
    days: partial.days ?? 30,
    hasEmail: partial.hasEmail ?? false,
    genericEmailOnly: partial.genericEmailOnly ?? false,
    industryGroup: partial.industryGroup ?? "",
    professionId: partial.professionId ?? "",
    websitePresence:
      (partial.websitePresence as FilterState["websitePresence"]) ?? "without",
    facebookPresence: partial.facebookPresence ?? "all",
    instagramPresence: partial.instagramPresence ?? "all",
  };
}
