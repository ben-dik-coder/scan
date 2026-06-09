import {
  assertSerperQuota,
  recordSerperApiCall,
} from "@/lib/billing/serper-usage";
import { companyGeoPlaces, primaryGeoPlace } from "@/lib/brreg/geo-place";
import {
  companyMatchesResult,
  compactAlnum,
  domainSimilarToCompany,
  extractBrandPortion,
  isNonOwnWebsiteDomain,
  normalizeDomain,
  stripCompanySuffix,
  toTitleCaseName,
} from "./parse-results";
import { phonePlausibleForCompany } from "./phone-plausible";
import type { WebsiteScanCompanyInput } from "./types";

export type SerperPlaceHit = {
  title: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  category?: string;
  rating?: number;
  position?: number;
};

type SerperPlacesResponse = {
  places?: Array<{
    title?: string;
    address?: string;
    phoneNumber?: string;
    website?: string;
    category?: string;
    rating?: number;
    position?: number;
  }>;
  message?: string;
};

export type GooglePlacesDiscovery = {
  websiteUrl?: string;
  websiteDomain?: string;
  phone?: string;
  confidence: "high" | "medium" | "low";
  placeTitle?: string;
};

const SERPER_TIMEOUT_MS = 20_000;

function geoMatchesPlace(text: string, geoPlaces: string[]): boolean {
  if (geoPlaces.length === 0) return true;
  const hay = compactAlnum(text);
  if (!hay) return false;
  return geoPlaces.some((place) => {
    const key = compactAlnum(place);
    return key.length >= 4 && hay.includes(key);
  });
}

function normalizePlaceWebsite(
  website: string | undefined,
  companyName: string,
  placeTitle: string
): { websiteUrl: string; websiteDomain: string } | null {
  if (!website?.trim()) return null;

  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/\//, "")}`;
  }

  try {
    const parsed = new URL(url);
    const domain = normalizeDomain(parsed.href);
    if (!domain || isNonOwnWebsiteDomain(domain)) return null;
    if (
      !domainSimilarToCompany(domain, companyName) &&
      !companyMatchesResult(placeTitle, parsed.href, companyName)
    ) {
      return null;
    }
    return { websiteUrl: parsed.href, websiteDomain: domain };
  } catch {
    return null;
  }
}

function scorePlace(
  place: SerperPlaceHit,
  companyName: string,
  geoPlaces: string[]
): { score: number; confidence: "high" | "medium" | "low" } | null {
  if (!place.title?.trim()) return null;
  if (!companyMatchesResult(place.title, place.website ?? "", companyName)) {
    return null;
  }

  const geoMatch = geoMatchesPlace(
    `${place.title} ${place.address ?? ""}`,
    geoPlaces
  );
  const website = normalizePlaceWebsite(place.website, companyName, place.title);
  const domainMatch = website
    ? domainSimilarToCompany(website.websiteDomain, companyName)
    : false;

  let score = 4;
  if (geoMatch) score += 3;
  if (website) score += 4;
  if (domainMatch) score += 4;
  if (place.phoneNumber?.trim()) score += 2;

  const confidence: "high" | "medium" | "low" =
    domainMatch && geoMatch
      ? "high"
      : geoMatch || domainMatch
        ? "medium"
        : "low";

  if (score < 6) return null;
  return { score, confidence };
}

export function buildPlacesSearchQuery(company: WebsiteScanCompanyInput): string {
  const brand = extractBrandPortion(company.name);
  const display =
    brand != null ? toTitleCaseName(brand) : stripCompanySuffix(company.name).trim();
  const geo = primaryGeoPlace(company) ?? companyGeoPlaces(company)[0];
  return geo ? `${display} ${geo}` : display;
}

export async function searchSerperPlaces(
  query: string,
  options?: { userId?: string }
): Promise<SerperPlaceHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Serper er ikke konfigurert");
  }

  if (options?.userId) {
    await assertSerperQuota(options.userId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "no",
        hl: "no",
      }),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Serper Places tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json()) as SerperPlacesResponse;

  if (!res.ok) {
    throw new Error(data.message ?? `Serper Places feilet (${res.status})`);
  }

  if (options?.userId) {
    await recordSerperApiCall(options.userId);
  }

  return (data.places ?? [])
    .filter((item) => item.title?.trim())
    .map((item) => ({
      title: item.title!.trim(),
      address: item.address?.trim(),
      phoneNumber: item.phoneNumber?.trim(),
      website: item.website?.trim(),
      category: item.category?.trim(),
      rating: item.rating,
      position: item.position,
    }));
}

export async function discoverFromGooglePlaces(
  company: WebsiteScanCompanyInput,
  userId?: string
): Promise<GooglePlacesDiscovery | null> {
  const query = buildPlacesSearchQuery(company);
  const places = await searchSerperPlaces(query, { userId });
  if (!places.length) return null;

  const geoPlaces = companyGeoPlaces(company);
  let best: {
    place: SerperPlaceHit;
    score: number;
    confidence: "high" | "medium" | "low";
    website: { websiteUrl: string; websiteDomain: string } | null;
  } | null = null;

  for (const place of places) {
    const scored = scorePlace(place, company.name, geoPlaces);
    if (!scored) continue;

    const website = normalizePlaceWebsite(place.website, company.name, place.title);
    if (!best || scored.score > best.score) {
      best = {
        place,
        score: scored.score,
        confidence: scored.confidence,
        website,
      };
    }
  }

  if (!best) return null;

  const phone =
    best.place.phoneNumber &&
    phonePlausibleForCompany(best.place.phoneNumber, company.orgnr)
      ? best.place.phoneNumber
      : undefined;

  if (!best.website && !phone) return null;

  return {
    websiteUrl: best.website?.websiteUrl,
    websiteDomain: best.website?.websiteDomain,
    phone,
    confidence: best.confidence,
    placeTitle: best.place.title,
  };
}

export function placesDiscoveryEnoughToSkipOrganic(
  discovery: GooglePlacesDiscovery
): boolean {
  if (
    discovery.websiteUrl &&
    discovery.phone &&
    discovery.confidence !== "low"
  ) {
    return true;
  }
  return Boolean(discovery.websiteUrl && discovery.confidence === "high");
}
