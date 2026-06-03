import type { SocialScanMeta, WebsiteScanResult } from "@/lib/website-scan/types";

export type ScanSocialOptions = {
  /** Google-søk for Facebook-side + SerpAPI facebook_profile */
  includeFacebook: boolean;
  /** Instagram via lenke på Facebook-profil, ellers eget søk + instagram_profile */
  includeInstagram: boolean;
};

export const DEFAULT_SCAN_SOCIAL_OPTIONS: ScanSocialOptions = {
  includeFacebook: true,
  includeInstagram: true,
};

/** Øk når sosialsøk forbedres — gamle cache-rader skannes på nytt automatisk */
export const SOCIAL_SCAN_VERSION = 3;

/** Full SerpAPI-sosialsjekk — skiller fra hurtig e-postskann uten FB/IG-felt */
export function isSocialScanComplete(
  scan: WebsiteScanResult,
  social: ScanSocialOptions
): boolean {
  const done: SocialScanMeta | undefined = scan.socialScan;

  if ((done?.version ?? 1) < SOCIAL_SCAN_VERSION) return false;

  if (social.includeFacebook) {
    if (!done?.includeFacebook) return false;
    if (!("facebookUrl" in scan)) return false;
  }
  if (social.includeInstagram) {
    if (!done?.includeInstagram) return false;
    if (!("instagramUrl" in scan)) return false;
  }
  return true;
}

export function buildSocialScanMeta(
  social: ScanSocialOptions
): SocialScanMeta {
  return {
    includeFacebook: social.includeFacebook,
    includeInstagram: social.includeInstagram,
    version: SOCIAL_SCAN_VERSION,
  };
}

const STORAGE_KEY = "nylead-scan-social";

export function loadScanSocialOptions(): ScanSocialOptions {
  if (typeof window === "undefined") return DEFAULT_SCAN_SOCIAL_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCAN_SOCIAL_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<ScanSocialOptions>;
    return {
      includeFacebook: parsed.includeFacebook !== false,
      includeInstagram: parsed.includeInstagram !== false,
    };
  } catch {
    return DEFAULT_SCAN_SOCIAL_OPTIONS;
  }
}

export function saveScanSocialOptions(options: ScanSocialOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}
