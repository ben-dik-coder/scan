import type { FilterState } from "@/components/CompanyFilters";
import { DEFAULT_MARKET_FILTERS } from "@/lib/constants/market";

export type ScanLeadMode = "websites" | "profession" | "all_new";

export const SCAN_LEAD_MODE_LABELS: Record<
  ScanLeadMode,
  { title: string; description: string }
> = {
  websites: {
    title: "Selger nettsider",
    description: "Nye firma i ditt område — sjekk hvem som mangler nettside",
  },
  profession: {
    title: "Yrke i mitt område",
    description: "Velg yrke under — vi henter matchende firma",
  },
  all_new: {
    title: "Alle nye firma",
    description: "Siste 30 dager i valgt område",
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
      professionSearch: "",
      hasEmail: false,
      genericEmailOnly: false,
      websitePresence: "all",
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
    professionSearch: "",
    hasEmail: false,
    genericEmailOnly: false,
    websitePresence: "all",
    facebookPresence: "all",
    instagramPresence: "all",
  };
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
    return JSON.parse(raw) as Partial<FilterState>;
  } catch {
    return null;
  }
}
