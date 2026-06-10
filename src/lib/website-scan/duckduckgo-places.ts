import { companyGeoPlaces } from "@/lib/brreg/geo-place";
import { searchDuckDuckGo } from "./duckduckgo-search";
import {
  companyMatchesResult,
  pickBestWebsite,
} from "./parse-results";
import {
  extractPhoneFromText,
  phonePlausibleForCompany,
} from "./phone-plausible";
import {
  buildPlacesSearchQuery,
  normalizePlaceWebsite,
  scorePlaceHit,
  type GooglePlacesDiscovery,
  type SerperPlaceHit,
} from "./serper-places";
import type { WebsiteScanCompanyInput } from "./types";

function isGoogleMapsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      (host.includes("google.") || host === "maps.app.goo.gl") &&
      (parsed.pathname.includes("/maps") || host === "maps.app.goo.gl")
    );
  } catch {
    return false;
  }
}

function cleanMapsTitle(title: string): string {
  return title
    .replace(/\s*[-–|·]\s*Google\s*Maps.*$/i, "")
    .replace(/\s*[-–|·]\s*Kart.*$/i, "")
    .replace(/\s*\|\s*Google.*$/i, "")
    .trim();
}

async function searchDdgMapsHits(query: string) {
  // Ett DDG-søk holder — det andre søket ga sjelden nye treff og doblet tiden.
  return searchDuckDuckGo(`${query} site:google.com/maps`).catch(() => []);
}

/** Gratis Google Maps-oppslag via DuckDuckGo — bruker Serper-scoring på treff. */
export async function discoverFromDuckDuckGoMaps(
  company: WebsiteScanCompanyInput
): Promise<GooglePlacesDiscovery | null> {
  const query = buildPlacesSearchQuery(company);
  const geoPlaces = companyGeoPlaces(company);

  const [mapsHits, organicHits] = await Promise.all([
    searchDdgMapsHits(query),
    searchDuckDuckGo(query).catch(() => []),
  ]);

  let best: {
    place: SerperPlaceHit;
    score: number;
    confidence: "high" | "medium" | "low";
    website: { websiteUrl: string; websiteDomain: string } | null;
    phone?: string;
  } | null = null;

  for (const hit of mapsHits) {
    if (!isGoogleMapsUrl(hit.link)) continue;

    const placeTitle = cleanMapsTitle(hit.title);
    if (!placeTitle || !companyMatchesResult(placeTitle, hit.link, company.name)) {
      continue;
    }

    const snippetPhone = extractPhoneFromText(hit.snippet ?? hit.title);
    const place: SerperPlaceHit = {
      title: placeTitle,
      address: hit.snippet,
      phoneNumber: snippetPhone ?? undefined,
      website: undefined,
    };

    const scored = scorePlaceHit(place, company.name, geoPlaces);
    if (!scored) continue;

    if (!best || scored.score > best.score) {
      best = {
        place,
        score: scored.score,
        confidence: scored.confidence,
        website: null,
        phone: snippetPhone ?? undefined,
      };
    }
  }

  const websitePick = pickBestWebsite(
    organicHits.filter((hit) => !isGoogleMapsUrl(hit.link)),
    company.name,
    { municipalityName: geoPlaces[0] ?? null }
  );

  let website =
    websitePick.hasWebsite && websitePick.websiteUrl && websitePick.websiteDomain
      ? {
          websiteUrl: websitePick.websiteUrl,
          websiteDomain: websitePick.websiteDomain,
        }
      : null;

  if (!website) {
    for (const hit of organicHits) {
      if (isGoogleMapsUrl(hit.link)) continue;
      const candidate = normalizePlaceWebsite(
        hit.link,
        company.name,
        cleanMapsTitle(hit.title)
      );
      if (candidate) {
        website = candidate;
        break;
      }
    }
  }

  if (!best && !website) return null;

  const phoneFromOrganic = organicHits
    .map((hit) => extractPhoneFromText(`${hit.title} ${hit.snippet ?? ""}`))
    .find(
      (value) => value && phonePlausibleForCompany(value, company.orgnr)
    );

  const phone =
    [best?.phone, best?.place.phoneNumber, phoneFromOrganic].find(
      (value) => value && phonePlausibleForCompany(value, company.orgnr)
    ) ?? undefined;

  if (!website && !phone) return null;

  const confidence =
    best?.confidence ??
    (websitePick.confidence === "low" ? "low" : websitePick.confidence);

  return {
    websiteUrl: website?.websiteUrl ?? best?.website?.websiteUrl,
    websiteDomain: website?.websiteDomain ?? best?.website?.websiteDomain,
    phone,
    confidence,
    placeTitle: best?.place.title ?? company.name,
  };
}
