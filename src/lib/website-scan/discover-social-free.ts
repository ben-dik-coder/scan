import { fetchPublicHtml } from "./fetch-public-html";
import { parseWebsitePageMetadata } from "./fetch-website-metadata";
import { stripCompanySuffix, type SearchHit } from "./parse-results";
import { socialUrlMatchesCompany } from "./social-profiles";
import type { WebsiteScanCompanyInput } from "./types";

export type DirectorySocialInput = {
  gulesiderUrl?: string | null;
  url1881?: string | null;
  alternateNames?: string[];
  /** Gjenbruk HTML fra tidligere fetch i samme skann */
  cachedHtml?: Map<string, string>;
};

function buildGulesiderSlugUrls(companyName: string): string[] {
  const stripped = stripCompanySuffix(companyName).trim();
  const names = new Set([companyName.trim(), stripped]);
  const urls = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const slug = encodeURIComponent(name);
    urls.add(`https://www.gulesider.no/${slug}/bedrifter`);
    urls.add(`https://www.gulesider.no/${slug}/bedrifter/1`);
  }
  return [...urls];
}

function facebookHitsFromHtml(
  html: string,
  companyName: string,
  alternateNames?: string[]
): SearchHit[] {
  const meta = parseWebsitePageMetadata(html);
  const candidates = meta.facebookUrl ? [meta.facebookUrl] : [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const url of candidates) {
    if (seen.has(url)) continue;
    const names = [companyName, ...(alternateNames ?? [])];
    const ok = names.some((name) => socialUrlMatchesCompany(url, name));
    if (!ok) continue;
    seen.add(url);
    hits.push({ title: companyName, link: url });
  }

  return hits;
}

async function fetchDirectoryHtml(
  url: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) return cached;

  const html = await fetchPublicHtml(url);
  if (html) cache.set(url, html);
  return html;
}

/** Finn Facebook-side fra Gulesider/1881 HTML — gratis, uten SerpAPI/Google. */
export async function discoverFacebookFromDirectoriesFree(
  company: WebsiteScanCompanyInput,
  options?: DirectorySocialInput
): Promise<SearchHit[]> {
  const cache = options?.cachedHtml ?? new Map<string, string>();
  const urls: string[] = [];

  if (options?.gulesiderUrl?.trim()) urls.push(options.gulesiderUrl.trim());
  if (options?.url1881?.trim()) urls.push(options.url1881.trim());

  for (const slugUrl of buildGulesiderSlugUrls(company.name)) {
    if (!urls.includes(slugUrl)) urls.push(slugUrl);
  }

  const hits: SearchHit[] = [];
  const seenLinks = new Set<string>();

  for (const url of urls) {
    const html = await fetchDirectoryHtml(url, cache);
    if (!html) continue;

    for (const hit of facebookHitsFromHtml(
      html,
      company.name,
      options?.alternateNames
    )) {
      if (seenLinks.has(hit.link)) continue;
      seenLinks.add(hit.link);
      hits.push(hit);
    }
  }

  return hits;
}
