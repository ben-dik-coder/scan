import { hasSerpApi } from "@/lib/website-scan/config";
import { companyMatchesResult } from "@/lib/website-scan/parse-results";
import { normalizeInstagramUrl } from "@/lib/website-scan/social-profiles";
import type { InstagramProfileSnippet } from "@/lib/website-scan/types";

const SERPAPI_TIMEOUT_MS = 25_000;

type SerpApiInstagramResponse = {
  search_metadata?: { status?: string; error?: string };
  error?: string;
  profile_results?: {
    username?: string;
    full_name?: string;
    biography?: string;
    followers?: number;
    following?: number;
    posts_count?: number;
    is_private?: boolean;
    is_verified?: boolean;
    category_name?: string;
    external_url?: string;
  };
};

export function extractInstagramProfileId(instagramUrl: string): string | null {
  try {
    const u = new URL(
      instagramUrl.startsWith("http") ? instagramUrl : `https://${instagramUrl}`
    );
    const host = u.hostname.replace(/^(www\.|m\.)/i, "").toLowerCase();
    if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    const blocked = new Set([
      "p",
      "reel",
      "reels",
      "stories",
      "explore",
      "accounts",
      "direct",
      "tv",
    ]);
    const slug = parts[0]!.toLowerCase();
    if (blocked.has(slug)) return null;

    return parts[0]!;
  } catch {
    return null;
  }
}

function mapInstagramProfile(
  profileId: string,
  raw: NonNullable<SerpApiInstagramResponse["profile_results"]>
): InstagramProfileSnippet {
  const username = raw.username ?? profileId;
  return {
    profileId: username,
    username,
    name: raw.full_name ?? null,
    url: `https://www.instagram.com/${username}/`,
    biography: raw.biography ?? null,
    followers:
      raw.followers != null ? String(raw.followers) : null,
    following:
      raw.following != null ? String(raw.following) : null,
    postsCount:
      raw.posts_count != null ? String(raw.posts_count) : null,
    category: raw.category_name ?? null,
    externalUrl: raw.external_url ?? null,
    isPrivate: Boolean(raw.is_private),
    verified: Boolean(raw.is_verified),
    source: "serpapi_instagram_profile",
  };
}

/**
 * SerpAPI Instagram Profile API
 * @see https://serpapi.com/instagram-profile-api
 */
export async function fetchSerpApiInstagramProfile(
  profileId: string
): Promise<InstagramProfileSnippet | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "instagram_profile",
    profile_id: profileId,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });

    const data = (await res.json()) as SerpApiInstagramResponse;

    if (!res.ok) {
      throw new Error(data.error ?? `SerpAPI Instagram feilet (${res.status})`);
    }

    if (data.search_metadata?.status === "Error") {
      throw new Error(data.search_metadata.error ?? "Instagram-profil ikke funnet");
    }

    if (!data.profile_results) return null;

    return mapInstagramProfile(profileId, data.profile_results);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("SerpAPI Instagram tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function demoInstagramProfile(
  company: { name: string; orgnr: string },
  instagramUrl: string,
  fromFacebook: boolean
): InstagramProfileSnippet {
  const profileId = extractInstagramProfileId(instagramUrl) ?? "demo";
  return {
    profileId,
    username: profileId,
    name: company.name.replace(/\s+(AS|ASA|DA|SA|ENK)\s*$/i, "").trim(),
    url: instagramUrl,
    biography: fromFacebook
      ? "Fant via Facebook-profilen (demo)"
      : "Demo Instagram",
    followers: "890",
    following: "120",
    postsCount: "45",
    category: null,
    externalUrl: null,
    isPrivate: false,
    verified: false,
    source: "demo",
  };
}

export async function enrichInstagramWithSerpApi(
  instagramUrl: string | null,
  companyName: string,
  options?: {
    demo?: boolean;
    verifiedViaSearch?: boolean;
    fromFacebook?: boolean;
  }
): Promise<{
  instagramUrl: string | null;
  instagramProfile: InstagramProfileSnippet | null;
  instagramFromFacebook: boolean;
}> {
  if (!instagramUrl) {
    return {
      instagramUrl: null,
      instagramProfile: null,
      instagramFromFacebook: false,
    };
  }

  const fromFacebook = options?.fromFacebook ?? false;
  const normalized = normalizeInstagramUrl(instagramUrl) ?? instagramUrl;

  if (options?.demo || !hasSerpApi()) {
    return {
      instagramUrl: normalized,
      instagramProfile: demoInstagramProfile(
        { name: companyName, orgnr: "" },
        normalized,
        fromFacebook
      ),
      instagramFromFacebook: fromFacebook,
    };
  }

  const profileId = extractInstagramProfileId(normalized);
  if (!profileId) {
    return {
      instagramUrl: normalized,
      instagramProfile: null,
      instagramFromFacebook: fromFacebook,
    };
  }

  try {
    const profile = await fetchSerpApiInstagramProfile(profileId);
    if (!profile) {
      return {
        instagramUrl: normalized,
        instagramProfile: null,
        instagramFromFacebook: fromFacebook,
      };
    }

    if (
      !options?.verifiedViaSearch &&
      !fromFacebook &&
      profile.name &&
      !companyMatchesResult(profile.name, profile.url ?? "", companyName)
    ) {
      return {
        instagramUrl: normalized,
        instagramProfile: null,
        instagramFromFacebook: fromFacebook,
      };
    }

    return {
      instagramUrl: profile.url ?? normalized,
      instagramProfile: profile,
      instagramFromFacebook: fromFacebook,
    };
  } catch (err) {
    console.warn(
      "[instagram_profile]",
      profileId,
      err instanceof Error ? err.message : err
    );
    return {
      instagramUrl: normalized,
      instagramProfile: null,
      instagramFromFacebook: fromFacebook,
    };
  }
}

/** Finn Instagram-URL i Facebook-profilens lenker (SerpAPI links[]) */
export function instagramUrlFromFacebookProfile(
  links?: Array<{ link?: string; title?: string }> | null
): string | null {
  for (const item of links ?? []) {
    if (!item.link) continue;
    const normalized = normalizeInstagramUrl(item.link);
    if (normalized) return normalized;
  }
  return null;
}
