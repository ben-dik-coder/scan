import { websiteFromBrreg } from "@/lib/website-scan/brreg-website-hint";
import {
  isBookingPlatformDomain,
  isNonOwnWebsiteDomain,
  normalizeDomain,
} from "@/lib/website-scan/parse-results";

export type CrossLinkWebsiteHint = {
  websiteUrl: string;
  websiteDomain: string;
  kind: "own" | "booking_only";
};

const SOCIAL_OR_SKIP_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "google.com",
  "apple.com",
  "play.google.com",
];

function isSkippableExternalHost(domain: string): boolean {
  const d = domain.toLowerCase();
  return SOCIAL_OR_SKIP_HOSTS.some((h) => d === h || d.endsWith(`.${h}`));
}

/** Valider ekstern URL fra Facebook-lenke eller Instagram externalUrl. */
export function websiteFromCrossLink(
  url: string | null | undefined
): CrossLinkWebsiteHint | null {
  const base = websiteFromBrreg(url);
  if (!base) return null;

  const domain = normalizeDomain(base.websiteUrl);
  if (!domain || isSkippableExternalHost(domain)) return null;

  if (isBookingPlatformDomain(domain)) {
    return { ...base, kind: "booking_only" };
  }
  if (isNonOwnWebsiteDomain(domain)) return null;

  return { ...base, kind: "own" };
}
