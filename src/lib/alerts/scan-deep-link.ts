import type { FilterState } from "@/components/CompanyFilters";
import { parseProfessionIdFromParam } from "@/lib/constants/professions";
import { parseNaceCodeFromParam } from "@/lib/constants/nace-codes";

type AlertFilters = Partial<FilterState> & { professionSearch?: string };

/** Bygg /app-URL med filter + valgfri Skann-modus / web-fane. */
export function buildScanDeepLink(
  filters: AlertFilters,
  options?: { modus?: "websites" | "profession" | "all_new"; web?: "without" | "with" | "not_scanned" }
): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://nylead.no").replace(/\/$/, "");
  const params = new URLSearchParams();

  if (filters.regionId) params.set("omrade", filters.regionId);
  if (filters.municipalityCode) params.set("kommune", filters.municipalityCode);
  if (filters.days === 0) params.set("dager", "0");
  else if (filters.days != null) params.set("dager", String(filters.days));
  if (filters.hasEmail) params.set("epost", "1");
  if (filters.genericEmailOnly) params.set("generisk", "1");
  if (filters.industryGroup) params.set("bransje", filters.industryGroup);
  const professionId =
    filters.professionId ??
    (filters.professionSearch?.trim()
      ? parseProfessionIdFromParam(filters.professionSearch)
      : "");
  if (professionId) params.set("yrke", professionId);
  if (filters.naceCode) params.set("nace", filters.naceCode);
  if (filters.nameQuery?.trim()) params.set("navn", filters.nameQuery.trim());
  if (filters.websitePresence && filters.websitePresence !== "all") {
    params.set("web", filters.websitePresence);
  }

  if (options?.modus) params.set("modus", options.modus);
  if (options?.web === "without") params.set("web", "without");
  else if (options?.web === "with") params.set("web", "with");
  else if (options?.web === "not_scanned") params.set("web", "not_scanned");

  const q = params.toString();
  return q ? `${appUrl}/app?${q}` : `${appUrl}/app`;
}
