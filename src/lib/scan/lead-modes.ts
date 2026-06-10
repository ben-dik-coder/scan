import type { FilterState } from "@/components/CompanyFilters";
import type { AgentListTab } from "@/lib/agent/saved-list-filters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";
import { parseProfessionIdFromParam } from "@/lib/constants/professions";

export type ScanLeadMode = "websites" | "profession" | "all_new";

export const SCAN_LEAD_MODE_LABELS: Record<
  ScanLeadMode,
  { title: string; description: string }
> = {
  websites: {
    title: "Trenger nettside",
    description: "Sterkt for web/design — finn firma uten ordentlig nettside",
  },
  profession: {
    title: "Bransje i mitt område",
    description:
      "Bruker GPS for å finne din kommune — regnskap, IT, markedsføring og andre lokale B2B-leads",
  },
  all_new: {
    title: "Alle nye firma",
    description: "Nye firma siste 30 dager — med kontakt når vi finner det",
  },
};

/** Filter som brukes når bruker velger en lead-modus */
export function filtersForLeadMode(
  mode: ScanLeadMode,
  current: FilterState
): FilterState {
  const regionId = current.regionId || DEFAULT_MARKET_FILTERS.regionId;
  const municipalityCode = current.municipalityCode;

  if (mode === "websites") {
    return {
      ...current,
      regionId,
      municipalityCode,
      days: 30,
      industryGroup: "",
      professionId: "",
      hasEmail: false,
      genericEmailOnly: false,
      websitePresence: "without",
      facebookPresence: "all",
      instagramPresence: "all",
    };
  }

  if (mode === "profession") {
    return {
      ...current,
      regionId,
      municipalityCode,
      days: 30,
      websitePresence: "all",
      facebookPresence: "all",
      instagramPresence: "all",
    };
  }

  return {
    ...current,
    regionId,
    municipalityCode,
    days: 30,
    industryGroup: "",
    professionId: "",
    hasEmail: false,
    genericEmailOnly: false,
    websitePresence: "all",
    facebookPresence: "all",
    instagramPresence: "all",
  };
}

/** Listefane som hører til valgt lead-modus (web=without for nettside-modus). */
export function listTabForLeadMode(mode: ScanLeadMode): AgentListTab {
  return mode === "websites" ? "no_website" : "all";
}

export const SCAN_AUDIENCE_STORAGE_KEY = "nylead-scan-audience-filters";

export function persistScanAudienceFilters(filters: FilterState) {
  try {
    localStorage.setItem(SCAN_AUDIENCE_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export function loadScanAudienceFilters(): Partial<FilterState> | null {
  try {
    const raw = localStorage.getItem(SCAN_AUDIENCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FilterState> & {
      professionSearch?: string;
    };
    if (!parsed.professionId && parsed.professionSearch?.trim()) {
      parsed.professionId = parseProfessionIdFromParam(parsed.professionSearch);
    }
    return parsed;
  } catch {
    return null;
  }
}
