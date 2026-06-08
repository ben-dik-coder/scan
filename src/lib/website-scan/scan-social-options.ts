import type { SocialScanMeta, WebsiteScanResult } from "@/lib/website-scan/types";

export type ScanSocialOptions = {
  /** Google-søk for Facebook-side + SerpAPI facebook_profile */
  includeFacebook: boolean;
  /** Instagram via lenke på Facebook-profil, ellers eget søk + instagram_profile */
  includeInstagram: boolean;
  /** LinkedIn company-URL fra nettside-HTML / Facebook-lenker (ingen ekstra SerpAPI) */
  includeLinkedIn: boolean;
};

export const DEFAULT_SCAN_SOCIAL_OPTIONS: ScanSocialOptions = {
  includeFacebook: false,
  includeInstagram: false,
  includeLinkedIn: true,
};

/** Øk når sosialsøk forbedres — gamle cache-rader skannes på nytt automatisk */
export const SOCIAL_SCAN_VERSION = 6;

/**
 * True når bruker ba om sosial-funksjon som forrige skann ikke kjørte
 * (f.eks. glemte å huke av Facebook første gang).
 */
export function needsSocialRescan(
  scan: WebsiteScanResult,
  social: ScanSocialOptions
): boolean {
  const done: SocialScanMeta | undefined = scan.socialScan;
  if ((done?.version ?? 1) < SOCIAL_SCAN_VERSION) return true;
  if (social.includeFacebook && !done?.includeFacebook) return true;
  if (social.includeInstagram && !done?.includeInstagram) return true;
  return false;
}

/** Full SerpAPI-sosialsjekk — skiller fra hurtig e-postskann uten FB/IG-felt */
export function isSocialScanComplete(
  scan: WebsiteScanResult,
  social: ScanSocialOptions
): boolean {
  const done: SocialScanMeta | undefined = scan.socialScan;

  if (needsSocialRescan(scan, social)) return false;

  if (social.includeFacebook) {
    if (!("facebookUrl" in scan)) return false;
  }
  if (social.includeInstagram) {
    if (!("instagramUrl" in scan)) return false;
  }
  if (social.includeLinkedIn) {
    if (!done?.includeLinkedIn) return false;
    if (!("linkedinUrl" in scan)) return false;
  }
  return true;
}

export function buildSocialScanMeta(
  social: ScanSocialOptions
): SocialScanMeta {
  return {
    includeFacebook: social.includeFacebook,
    includeInstagram: social.includeInstagram,
    includeLinkedIn: social.includeLinkedIn,
    version: SOCIAL_SCAN_VERSION,
  };
}

const STORAGE_KEY = "nylead-scan-social-v2";

export function loadScanSocialOptions(): ScanSocialOptions {
  if (typeof window === "undefined") return DEFAULT_SCAN_SOCIAL_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCAN_SOCIAL_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<ScanSocialOptions>;
    return {
      includeFacebook: parsed.includeFacebook === true,
      includeInstagram: parsed.includeInstagram === true,
      includeLinkedIn: parsed.includeLinkedIn !== false,
    };
  } catch {
    return DEFAULT_SCAN_SOCIAL_OPTIONS;
  }
}

export function saveScanSocialOptions(options: ScanSocialOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}
