export type AgentListFilters = {
  municipalityCode?: string;
  regionId?: string;
  industryGroup?: string;
  professionId?: string;
  days?: number;
  orgnrs?: string[];
  savedListId?: string;
};

export function buildAgentScanUrl(filters: AgentListFilters): string {
  const params = new URLSearchParams();
  params.set("modus", "websites");
  params.set("web", "without");
  if (filters.savedListId) params.set("liste", filters.savedListId);
  if (filters.municipalityCode) params.set("kommune", filters.municipalityCode);
  if (filters.regionId) params.set("omrade", filters.regionId);
  if (filters.industryGroup) params.set("bransje", filters.industryGroup);
  if (filters.professionId) params.set("yrke", filters.professionId);
  if (filters.days !== undefined) {
    params.set("dager", filters.days === 0 ? "alle" : String(filters.days));
  }
  return `/app?${params.toString()}`;
}
