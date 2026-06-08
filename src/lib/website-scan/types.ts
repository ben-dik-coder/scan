export type SocialLinkConfidence = "high" | "medium" | "low";

/** Hvilke sosiale felt som faktisk ble søkt ved denne skann */
export type SocialScanMeta = {
  includeFacebook: boolean;
  includeInstagram: boolean;
  includeLinkedIn: boolean;
  /** Økes når søkelogikk forbedres — utløser ny skann av gamle cache-rader */
  version?: number;
};

export type WebsiteScanSource =
  | "google_cse"
  | "serpapi"
  | "both"
  | "demo"
  | "email_domain"
  | "brreg_website"
  | "none";

export type WebsiteScanStatus = "idle" | "scanning" | "done" | "error";

export type WebsiteKind = "own" | "booking_only" | "none";

/** Data fra SerpAPI Facebook Profile API (https://serpapi.com/facebook-profile-api) */
export type FacebookProfileSnippet = {
  profileId: string;
  name: string | null;
  url: string | null;
  verified: boolean;
  profileType: string | null;
  category: string | null;
  followers: string | null;
  likes: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  intro: string | null;
  isPrivate: boolean;
  source: "serpapi_facebook_profile" | "demo";
  /** Instagram-lenke listet på Facebook-profilen */
  linkedInstagramUrl?: string | null;
  /** LinkedIn company-lenke på Facebook-profilen */
  linkedLinkedInUrl?: string | null;
  /** Nettside-lenke på Facebook-profilen */
  linkedWebsiteUrl?: string | null;
};

/** Data fra SerpAPI Instagram Profile API (https://serpapi.com/instagram-profile-api) */
export type InstagramProfileSnippet = {
  profileId: string;
  username: string;
  name: string | null;
  url: string | null;
  biography: string | null;
  /** SerpAPI business_phone_number når tilgjengelig */
  phone: string | null;
  /** SerpAPI business_email når tilgjengelig */
  email: string | null;
  followers: string | null;
  following: string | null;
  postsCount: string | null;
  category: string | null;
  externalUrl: string | null;
  isPrivate: boolean;
  verified: boolean;
  source: "serpapi_instagram_profile" | "demo";
};

export type WebsiteScanResult = {
  orgnr: string;
  hasWebsite: boolean;
  /** own = egen nettside, booking_only = kun Timma/Fixit osv., none = ingen treff */
  websiteKind: WebsiteKind;
  websiteUrl: string | null;
  websiteDomain: string | null;
  bookingPlatform: string | null;
  source: WebsiteScanSource;
  confidence: "high" | "medium" | "low";
  query: string;
  scannedAt: string;
  error?: string;
  /** Rå treff for debugging / visning */
  topHits?: Array<{ title: string; link: string; domain: string }>;
  /** Facebook-side funnet via Google/SerpAPI */
  facebookUrl?: string | null;
  facebookConfidence?: SocialLinkConfidence;
  /** Utvidet profil via SerpAPI engine=facebook_profile */
  facebookProfile?: FacebookProfileSnippet | null;
  /** Instagram-profil (valgfritt søk) */
  instagramUrl?: string | null;
  instagramConfidence?: SocialLinkConfidence;
  instagramProfile?: InstagramProfileSnippet | null;
  /** Instagram kom fra lenke på Facebook-profilen */
  instagramFromFacebook?: boolean;
  /** LinkedIn company-side (kun URL fra nettside / Facebook-lenker) */
  linkedinUrl?: string | null;
  linkedinConfidence?: SocialLinkConfidence;
  linkedinFromWebsite?: boolean;
  linkedinFromFacebook?: boolean;
  /** Hvor nettsiden ble funnet når ikke Brreg/Google */
  websiteDiscoverySource?:
    | "brreg"
    | "google"
    | "email"
    | "domain_guess"
    | "facebook_link"
    | "instagram_external"
    | null;
  /** Merkenavn fra nettside (tittel / og:site_name) når det avviker fra Brreg */
  displayName?: string | null;
  /** Settes når SerpAPI/Google-sosialsøk er kjørt — brukes for cache-gyldighet */
  socialScan?: SocialScanMeta;
  /** Funnet på gulesider.no via Google-søk (ikke egen nettside) */
  gulesiderListed?: boolean;
  gulesiderUrl?: string | null;
  gulesiderConfidence?: SocialLinkConfidence;
  /** Kontakt funnet på booking/katalog/nettside/Facebook/Instagram */
  platformContacts?: Array<{
    source: "facebook" | "instagram" | "website" | "booking" | "gulesider" | "1881" | "directory" | "proff" | string;
    url: string;
    phone: string | null;
    email: string | null;
    externalWebsite: string | null;
  }>;
  enrichedPhone?: string | null;
  enrichedPhoneSource?: string | null;
  enrichedEmail?: string | null;
  enrichedEmailSource?: string | null;
  /** Settes når plattform-kontakt er beriket — brukes for delt cache */
  contactsEnriched?: boolean;
  /** Versjon av kontakt-berikelse — lav versjon trigget gratis re-berikelse */
  contactEnrichmentVersion?: number;
};

export type WebsiteScanCompanyInput = {
  orgnr: string;
  name: string;
  email?: string | null;
  municipality_name?: string | null;
  city?: string | null;
  website?: string | null;
  industry_code?: string | null;
};
