import { regionIdForKommuneCode } from "@/lib/constants/regions";

const KARTVERKET_PUNKT_URL = "https://api.kartverket.no/kommuneinfo/v1/punkt";
const LOOKUP_TIMEOUT_MS = 8_000;

export type KommuneFromCoords = {
  municipalityCode: string;
  municipalityName: string;
  countyName?: string;
  regionId: string;
};

export type KartverketPunktResponse = {
  kommunenummer?: string;
  kommunenavn?: string;
  fylkesnavn?: string;
  fylkesnummer?: string;
};

/** Kartverket svar → kommune-filter (testbar uten nett). */
export function parseKartverketPunktResponse(
  raw: KartverketPunktResponse
): KommuneFromCoords | null {
  const municipalityCode = raw.kommunenummer?.trim();
  const municipalityName = raw.kommunenavn?.trim();
  if (!municipalityCode || !/^\d{4}$/.test(municipalityCode) || !municipalityName) {
    return null;
  }

  return {
    municipalityCode,
    municipalityName,
    countyName: raw.fylkesnavn?.trim() || undefined,
    regionId: regionIdForKommuneCode(municipalityCode),
  };
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Finn norsk kommune for WGS84-koordinater via Kartverket. */
export async function kommuneFromCoords(
  lat: number,
  lng: number
): Promise<KommuneFromCoords | null> {
  if (!isValidCoord(lat, lng)) return null;

  const url = new URL(KARTVERKET_PUNKT_URL);
  url.searchParams.set("nord", String(lat));
  url.searchParams.set("ost", String(lng));
  url.searchParams.set("koordsys", "4258");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as KartverketPunktResponse;
    return parseKartverketPunktResponse(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
