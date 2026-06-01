export function hasGoogleCse(): boolean {
  return Boolean(
    process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim()
  );
}

export function hasSerpApi(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

export function hasAnyWebsiteScanProvider(): boolean {
  return hasGoogleCse() || hasSerpApi();
}

export function getWebsiteScanProviders(): string[] {
  const providers: string[] = [];
  if (hasGoogleCse()) providers.push("Google Custom Search");
  if (hasSerpApi()) providers.push("SerpAPI");
  return providers;
}
