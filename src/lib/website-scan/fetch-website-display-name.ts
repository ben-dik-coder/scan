import { fetchWebsitePageMetadata } from "@/lib/website-scan/fetch-website-metadata";

/** Hent visningsnavn fra nettside (tittel / og:site_name / h1). */
export async function fetchWebsiteDisplayName(
  url: string
): Promise<string | null> {
  const meta = await fetchWebsitePageMetadata(url);
  return meta.displayName;
}
