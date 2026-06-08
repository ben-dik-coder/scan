import { hasApi1881 } from "./api1881/config";
import { ENABLE_SERPER_PLACES } from "./scan-api-budget";

export function hasGoogleCse(): boolean {
  return Boolean(
    process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim()
  );
}

export function hasSerpApi(): boolean {
  if (process.env.SERPAPI_DISABLED === "true" || process.env.SERPAPI_DISABLED === "1") {
    return false;
  }
  const enabled =
    process.env.SERPAPI_ENABLED === "true" || process.env.SERPAPI_ENABLED === "1";
  if (!enabled) {
    return false;
  }
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

export function hasSerper(): boolean {
  return Boolean(process.env.SERPER_API_KEY?.trim());
}

export function hasSerperPlaces(): boolean {
  return hasSerper();
}

export function isSerperPlacesEnabled(): boolean {
  return hasSerperPlaces() && ENABLE_SERPER_PLACES;
}

/** Gratis nettsøk via DuckDuckGo HTML — alltid tilgjengelig uten API-nøkkel. */
export function hasFreeWebSearch(): boolean {
  return true;
}

export function hasAnyWebsiteScanProvider(): boolean {
  return hasGoogleCse() || hasSerpApi() || hasSerper() || hasFreeWebSearch();
}

export function getWebsiteScanProviders(): string[] {
  const providers: string[] = [];
  if (hasGoogleCse()) providers.push("Google Custom Search");
  if (hasSerpApi()) {
    providers.push("SerpAPI Google");
    providers.push("SerpAPI Facebook Profile");
    providers.push("SerpAPI Instagram Profile");
  }
  if (hasSerper()) providers.push("Serper Google");
  if (isSerperPlacesEnabled()) providers.push("Serper Google Maps");
  if (hasFreeWebSearch() && !hasGoogleCse() && !hasSerpApi() && !hasSerper()) {
    providers.push("DuckDuckGo (gratis)");
  }
  if (hasApi1881()) providers.push("1881 API");
  return providers;
}
