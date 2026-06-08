import { hasApi1881 } from "./api1881/config";

export function hasGoogleCse(): boolean {
  return Boolean(
    process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim()
  );
}

export function hasSerpApi(): boolean {
  if (process.env.SERPAPI_DISABLED === "true" || process.env.SERPAPI_DISABLED === "1") {
    return false;
  }
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

/** Gratis nettsøk via DuckDuckGo HTML — alltid tilgjengelig uten API-nøkkel. */
export function hasFreeWebSearch(): boolean {
  return true;
}

export function hasAnyWebsiteScanProvider(): boolean {
  return hasGoogleCse() || hasSerpApi() || hasFreeWebSearch();
}

export function getWebsiteScanProviders(): string[] {
  const providers: string[] = [];
  if (hasGoogleCse()) providers.push("Google Custom Search");
  if (hasSerpApi()) {
    providers.push("SerpAPI Google");
    providers.push("SerpAPI Facebook Profile");
    providers.push("SerpAPI Instagram Profile");
  }
  if (hasFreeWebSearch() && !hasGoogleCse() && !hasSerpApi()) {
    providers.push("DuckDuckGo (gratis)");
  }
  if (hasApi1881()) providers.push("1881 API");
  return providers;
}
