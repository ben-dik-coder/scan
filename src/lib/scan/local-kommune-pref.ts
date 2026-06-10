import { municipalityCodeForName } from "@/lib/agent/municipality";
import { regionIdForKommuneCode } from "@/lib/constants/regions";
import { loadScanAudienceFilters } from "@/lib/scan/lead-modes";

export type LocalKommunePref = {
  municipalityCode: string;
  municipalityName?: string;
  regionId: string;
  source: "memory" | "saved_filters" | "current";
};

function prefFromCode(
  code: string,
  source: LocalKommunePref["source"],
  municipalityName?: string
): LocalKommunePref | null {
  const municipalityCode = code.trim();
  if (!/^\d{4}$/.test(municipalityCode)) return null;
  return {
    municipalityCode,
    municipalityName,
    regionId: regionIdForKommuneCode(municipalityCode),
    source,
  };
}

function prefFromMemoryValue(value: string): LocalKommunePref | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}$/.test(trimmed)) {
    return prefFromCode(trimmed, "memory");
  }
  const code = municipalityCodeForName(trimmed);
  if (!code) return null;
  return prefFromCode(code, "memory", trimmed);
}

/** Lagret kommune når GPS ikke fungerer (minne → lagrede filter → nåværende). */
export function resolveLocalKommuneFallback(input: {
  memoryValue?: string | null;
  currentMunicipalityCode?: string;
  municipalities?: Array<{ code: string; name: string }>;
}): LocalKommunePref | null {
  if (input.memoryValue) {
    const fromMemory = prefFromMemoryValue(input.memoryValue);
    if (fromMemory) return fromMemory;
  }

  const saved = loadScanAudienceFilters();
  if (saved?.municipalityCode) {
    const fromSaved = prefFromCode(saved.municipalityCode, "saved_filters");
    if (fromSaved) {
      const name = input.municipalities?.find(
        (m) => m.code === fromSaved.municipalityCode
      )?.name;
      if (name) fromSaved.municipalityName = name;
      return fromSaved;
    }
  }

  if (input.currentMunicipalityCode) {
    const fromCurrent = prefFromCode(input.currentMunicipalityCode, "current");
    if (fromCurrent) {
      const name = input.municipalities?.find(
        (m) => m.code === fromCurrent.municipalityCode
      )?.name;
      if (name) fromCurrent.municipalityName = name;
      return fromCurrent;
    }
  }

  return null;
}
