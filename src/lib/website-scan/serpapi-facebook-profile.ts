import { facebookProfileMatchesRegion } from "@/lib/website-scan/facebook-geo";
import { hasSerpApi } from "@/lib/website-scan/config";
import { companyMatchesResult } from "@/lib/website-scan/parse-results";
import { websiteFromCrossLink } from "@/lib/website-scan/cross-link-website";
import { pickBestLinkedInUrl } from "@/lib/website-scan/linkedin-profiles";
import { instagramUrlFromFacebookProfile } from "@/lib/website-scan/serpapi-instagram-profile";
import {
  demoInstagramUrl,
  normalizeFacebookUrl,
  normalizeInstagramUrl,
} from "@/lib/website-scan/social-profiles";
import type { FacebookProfileSnippet } from "@/lib/website-scan/types";

const SERPAPI_TIMEOUT_MS = 25_000;

type SerpApiFacebookResponse = {
  search_metadata?: { status?: string; error?: string };
  error?: string;
  profile_results?: {
    name?: string;
    url?: string;
    verified?: boolean;
    profile_type?: string;
    category?: string;
    followers?: string;
    likes?: string;
    phone?: string;
    email?: string;
    address?: string;
    profile_intro_text?: string;
    private?: boolean;
    links?: Array<{ title?: string; link?: string }>;
  };
};

export function extractFacebookProfileId(facebookUrl: string): string | null {
  try {
    const u = new URL(
      facebookUrl.startsWith("http") ? facebookUrl : `https://${facebookUrl}`
    );
    const host = u.hostname.replace(/^(www\.|m\.|mbasic\.)/i, "").toLowerCase();
    if (host !== "facebook.com" && !host.endsWith(".facebook.com") && host !== "fb.com") {
      return null;
    }

    if (u.pathname.includes("profile.php")) {
      const id = u.searchParams.get("id")?.trim();
      return id || null;
    }

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    if (parts[0] === "pages" && parts[1]) return parts[1];
    if (parts[0] === "people") {
      if (parts[2] && /^\d+$/.test(parts[2])) return parts[2];
      if (parts[1]) return parts[1];
    }

    const slug = parts[0]!;
    const blocked = new Set([
      "groups",
      "watch",
      "marketplace",
      "gaming",
      "events",
      "reel",
      "reels",
      "hashtag",
      "stories",
      "notes",
      "p",
      "posts",
      "photos",
    ]);
    if (blocked.has(slug.toLowerCase())) return null;

    return slug;
  } catch {
    return null;
  }
}

function isSocialLinkUrl(link: string): boolean {
  return (
    Boolean(normalizeFacebookUrl(link)) ||
    Boolean(normalizeInstagramUrl(link)) ||
    /linkedin\.com/i.test(link)
  );
}

/** Nettside-lenke fra Facebook-profilens links[] (tittel «Website» eller ekstern URL). */
export function websiteUrlFromFacebookProfile(
  links?: Array<{ title?: string; link?: string }> | null
): string | null {
  for (const item of links ?? []) {
    if (!item.link) continue;
    if (isSocialLinkUrl(item.link)) continue;
    const hint = websiteFromCrossLink(item.link);
    if (hint) return hint.websiteUrl;
  }
  return null;
}

/** LinkedIn company-URL fra Facebook-profilens links[]. */
export function linkedinUrlFromFacebookProfile(
  links?: Array<{ title?: string; link?: string }> | null
): string | null {
  const rawUrls = (links ?? [])
    .map((item) => item.link)
    .filter((link): link is string => Boolean(link));
  return pickBestLinkedInUrl(rawUrls);
}

function mapProfile(
  profileId: string,
  raw: NonNullable<SerpApiFacebookResponse["profile_results"]>
): FacebookProfileSnippet {
  return {
    profileId,
    name: raw.name ?? null,
    url: raw.url ?? null,
    verified: Boolean(raw.verified),
    profileType: raw.profile_type ?? null,
    category: raw.category ?? null,
    followers: raw.followers ?? null,
    likes: raw.likes ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    address: raw.address ?? null,
    intro: raw.profile_intro_text ?? null,
    isPrivate: Boolean(raw.private),
    source: "serpapi_facebook_profile",
    linkedInstagramUrl: instagramUrlFromFacebookProfile(raw.links),
    linkedLinkedInUrl: linkedinUrlFromFacebookProfile(raw.links),
    linkedWebsiteUrl: websiteUrlFromFacebookProfile(raw.links),
  };
}

export function profileMatchesCompany(
  profile: FacebookProfileSnippet,
  companyName: string,
  municipalityName?: string | null
): boolean {
  if (!facebookProfileMatchesRegion(profile, municipalityName)) return false;
  if (profile.isPrivate) return true;
  if (!profile.name) return true;
  return companyMatchesResult(profile.name, profile.url ?? "", companyName);
}

/**
 * SerpAPI Facebook Profile API
 * @see https://serpapi.com/facebook-profile-api
 */
export async function fetchSerpApiFacebookProfile(
  profileId: string
): Promise<FacebookProfileSnippet | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "facebook_profile",
    profile_id: profileId,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });

    const data = (await res.json()) as SerpApiFacebookResponse;

    if (!res.ok) {
      throw new Error(data.error ?? `SerpAPI Facebook feilet (${res.status})`);
    }

    if (data.search_metadata?.status === "Error") {
      throw new Error(data.search_metadata.error ?? "Facebook-profil ikke funnet");
    }

    if (!data.profile_results) return null;

    return mapProfile(profileId, data.profile_results);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("SerpAPI Facebook tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichFacebookWithSerpApi(
  facebookUrl: string | null,
  companyName: string,
  options?: {
    demo?: boolean;
    municipalityName?: string | null;
    /** Allerede matchet firmanavn i Google-søk */
    verifiedViaSearch?: boolean;
  }
): Promise<{ facebookUrl: string | null; facebookProfile: FacebookProfileSnippet | null }> {
  if (!facebookUrl) {
    return { facebookUrl: null, facebookProfile: null };
  }

  if (options?.demo || !hasSerpApi()) {
    return { facebookUrl, facebookProfile: null };
  }

  const profileId = extractFacebookProfileId(facebookUrl);
  if (!profileId) {
    return { facebookUrl, facebookProfile: null };
  }

  try {
    const profile = await fetchSerpApiFacebookProfile(profileId);
    if (!profile) {
      return options?.verifiedViaSearch
        ? { facebookUrl, facebookProfile: null }
        : { facebookUrl: null, facebookProfile: null };
    }

    const regionOk = facebookProfileMatchesRegion(
      profile,
      options?.municipalityName
    );
    const companyOk =
      options?.verifiedViaSearch ||
      profileMatchesCompany(profile, companyName, options?.municipalityName);

    if (!regionOk || !companyOk) {
      if (options?.verifiedViaSearch) {
        return { facebookUrl, facebookProfile: null };
      }
      return { facebookUrl: null, facebookProfile: null };
    }

    return {
      facebookUrl: profile.url ?? facebookUrl,
      facebookProfile: profile,
    };
  } catch (err) {
    console.warn(
      "[facebook_profile]",
      profileId,
      err instanceof Error ? err.message : err
    );
    return { facebookUrl, facebookProfile: null };
  }
}

export function demoFacebookProfile(
  company: { name: string; orgnr: string },
  facebookUrl: string
): FacebookProfileSnippet {
  const profileId = extractFacebookProfileId(facebookUrl) ?? "demo";
  return {
    profileId,
    name: company.name.replace(/\s+(AS|ASA|DA|SA|ENK)\s*$/i, "").trim(),
    url: facebookUrl,
    verified: false,
    profileType: "PAGE",
    category: "Lokal bedrift",
    followers: "1,2K",
    likes: "980",
    phone: null,
    email: null,
    address: null,
    intro: "Demo-profil (ekte data med SerpAPI Facebook Profile API)",
    isPrivate: false,
    source: "demo",
    linkedInstagramUrl: demoInstagramUrl(company),
    linkedLinkedInUrl: null,
    linkedWebsiteUrl: null,
  };
}
