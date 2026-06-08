import { SerperLimitReachedError } from "@/lib/billing/serper-usage";
import { hasFreeWebSearch, hasGoogleCse, hasSerpApi, hasSerper, isSerperPlacesEnabled } from "./config";
import {
  discoverWebsiteByDomainGuess,
  isWeakDomainGuess,
  preferredTldFromPlace,
} from "./domain-guess";
import { websiteFromBrreg } from "./brreg-website-hint";
import { websiteFromCrossLink } from "./cross-link-website";
import { websiteFromEmail } from "./email-hint";
import { fetchWebsitePageMetadata } from "./fetch-website-metadata";
import { companyGeoPlaces, primaryGeoPlace } from "@/lib/brreg/geo-place";
import { searchGoogleCse } from "./google-cse";
import {
  buildGulesiderSearchQuery,
  mergeGulesiderPresence,
  pickGulesiderFromHits,
  type GulesiderPresence,
} from "./directory-presence";
import {
  applyPlatformContactEnrichment,
  enrichPlatformContacts,
  type PlatformContactRecord,
} from "./platform-contact";
import {
  buildSearchQueries,
  buildSearchQuery,
  buildWebsiteSearchQueries,
  companySearchNameVariants,
  dedupeHits,
  displayNameDiffersFromLegal,
  normalizeDomain,
  pickBestWebsite,
  stripCompanySuffix,
  websiteUrlPlausibleForCompany,
  type SearchHit,
} from "./parse-results";
import { discoverFacebookFromDirectoriesFree } from "./discover-social-free";
import { searchDuckDuckGo } from "./duckduckgo-search";
import { searchSerpApi } from "./serpapi";
import { searchSerper, searchSerperForWebsite } from "./serper";
import {
  discoverFromGooglePlaces,
  placesDiscoveryEnoughToSkipOrganic,
  type GooglePlacesDiscovery,
} from "./serper-places";
import { phonePlausibleForCompany } from "./phone-plausible";
import {
  ENABLE_GULESIDER_SERP_SEARCH,
  GOOGLE_SERP_NUM,
  MAX_FALLBACK_SOCIAL_QUERIES,
  SOCIAL_SERP_NUM,
} from "./scan-api-budget";
import { CONTACT_ENRICHMENT_VERSION } from "./scan-cache";
import {
  buildSocialScanMeta,
  DEFAULT_SCAN_SOCIAL_OPTIONS,
  type ScanSocialOptions,
} from "./scan-social-options";
import {
  buildFacebookSearchQueries,
  buildInstagramSearchQueries,
  demoFacebookUrl,
  demoInstagramUrl,
  pickFacebookFromHits,
  pickInstagramFromHits,
  socialUrlMatchesCompany,
  type SocialLinkConfidence,
} from "./social-profiles";
import {
  demoFacebookProfile,
  enrichFacebookWithSerpApi,
} from "./serpapi-facebook-profile";
import {
  enrichInstagramWithSerpApi,
} from "./serpapi-instagram-profile";
import type {
  WebsiteScanCompanyInput,
  WebsiteScanResult,
  WebsiteScanSource,
} from "./types";

type PickResult = ReturnType<typeof pickBestWebsite>;

export type ScanCompanyOptions = {
  demo?: boolean;
  social?: Partial<ScanSocialOptions>;
  userId?: string;
};

type SocialFields = Pick<
  WebsiteScanResult,
  | "facebookUrl"
  | "facebookConfidence"
  | "facebookProfile"
  | "instagramUrl"
  | "instagramConfidence"
  | "instagramProfile"
  | "instagramFromFacebook"
  | "linkedinUrl"
  | "linkedinConfidence"
  | "linkedinFromWebsite"
  | "linkedinFromFacebook"
>;

type ScanExtras = {
  websiteDiscoverySource?: WebsiteScanResult["websiteDiscoverySource"];
  gulesider?: GulesiderPresence;
};

const DEV = process.env.NODE_ENV === "development";

function logScan(orgnr: string, msg: string, detail?: unknown) {
  if (!DEV) return;
  console.info(`[website-scan:${orgnr}] ${msg}`, detail ?? "");
}

function fromPick(
  orgnr: string,
  pick: PickResult,
  source: WebsiteScanSource,
  query: string,
  topHits?: PickResult["topHits"],
  social?: SocialFields,
  displayName?: string | null,
  socialScan?: ScanSocialOptions,
  extras?: ScanExtras
): WebsiteScanResult {
  return {
    orgnr,
    hasWebsite: pick.hasWebsite,
    websiteKind: pick.websiteKind,
    websiteUrl: pick.websiteUrl,
    websiteDomain: pick.websiteDomain
      ? normalizeDomain(pick.websiteUrl ?? pick.websiteDomain)
      : null,
    bookingPlatform: pick.bookingPlatform,
    source,
    confidence: pick.confidence,
    query,
    scannedAt: new Date().toISOString(),
    topHits: topHits ?? pick.topHits,
    displayName: displayName ?? null,
    facebookUrl: social?.facebookUrl ?? null,
    facebookConfidence: social?.facebookConfidence,
    facebookProfile: social?.facebookProfile ?? null,
    instagramUrl: social?.instagramUrl ?? null,
    instagramConfidence: social?.instagramConfidence,
    instagramProfile: social?.instagramProfile ?? null,
    instagramFromFacebook: social?.instagramFromFacebook ?? false,
    linkedinUrl: social?.linkedinUrl ?? null,
    linkedinConfidence: social?.linkedinConfidence,
    linkedinFromWebsite: social?.linkedinFromWebsite ?? false,
    linkedinFromFacebook: social?.linkedinFromFacebook ?? false,
    websiteDiscoverySource: extras?.websiteDiscoverySource ?? null,
    socialScan: socialScan ? buildSocialScanMeta(socialScan) : undefined,
    gulesiderListed: extras?.gulesider?.gulesiderListed ?? false,
    gulesiderUrl: extras?.gulesider?.gulesiderUrl ?? null,
    gulesiderConfidence: extras?.gulesider?.gulesiderConfidence,
  };
}

/** Berik eksisterende delt cache med kontakt fra alle plattformer — uten full ny Google-skann. */
function placesSeedContactsFromPhone(
  places: GooglePlacesDiscovery,
  orgnr: string
): PlatformContactRecord[] | undefined {
  if (
    !places.phone ||
    !phonePlausibleForCompany(places.phone, orgnr)
  ) {
    return undefined;
  }

  return [
    {
      source: "google_places",
      url: "https://www.google.com/maps",
      phone: places.phone,
      email: null,
      externalWebsite: places.websiteUrl ?? null,
    },
  ];
}

export async function enrichScanContacts(
  company: WebsiteScanCompanyInput,
  scan: WebsiteScanResult,
  options?: {
    skipFetch?: boolean;
    allowSocialProfileEnrichment?: boolean;
    seedContacts?: PlatformContactRecord[];
    userId?: string;
  }
): Promise<WebsiteScanResult> {
  const needsPlacesPhone =
    !scan.enrichedPhone && isSerperPlacesEnabled() && !options?.seedContacts?.length;

  if (
    scan.contactsEnriched &&
    (scan.contactEnrichmentVersion ?? 1) >= CONTACT_ENRICHMENT_VERSION &&
    !needsPlacesPhone
  ) {
    return scan;
  }

  let workingScan = scan;

  if (
    options?.allowSocialProfileEnrichment &&
    !options?.skipFetch &&
    hasSerpApi()
  ) {
    if (scan.facebookUrl && !scan.facebookProfile) {
      const fb = await enrichFacebookWithSerpApi(scan.facebookUrl, company.name, {
        municipalityName: primaryGeoPlace(company),
        verifiedViaSearch: false,
      });
      if (fb.facebookProfile) {
        workingScan = {
          ...workingScan,
          facebookUrl: fb.facebookUrl ?? workingScan.facebookUrl,
          facebookProfile: fb.facebookProfile,
        };
      }
    }

    if (scan.instagramUrl && !scan.instagramProfile) {
      const ig = await enrichInstagramWithSerpApi(scan.instagramUrl, company.name, {
        verifiedViaSearch: false,
        fromFacebook: scan.instagramFromFacebook ?? false,
      });
      if (ig.instagramProfile) {
        workingScan = {
          ...workingScan,
          instagramUrl: ig.instagramUrl ?? workingScan.instagramUrl,
          instagramProfile: ig.instagramProfile,
        };
      }
    }
  }

  const hits: SearchHit[] = (workingScan.topHits ?? []).map((h) => ({
    title: h.title,
    link: h.link,
  }));

  let seedContacts = options?.seedContacts;
  if (!seedContacts?.length && needsPlacesPhone) {
    if (!isSerperPlacesEnabled()) {
      seedContacts = undefined;
    } else {
      try {
        const places = await discoverFromGooglePlaces(company, options?.userId);
        seedContacts =
          (places && placesSeedContactsFromPhone(places, company.orgnr)) ?? [
            {
              source: "google_places",
              url: "https://www.google.com/maps",
              phone: null,
              email: null,
              externalWebsite: places?.websiteUrl ?? null,
            },
          ];
      } catch (err) {
        if (err instanceof SerperLimitReachedError) throw err;
        logScan(
          company.orgnr,
          "Serper Places under kontakt-berikelse feilet",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const enrichment = await enrichPlatformContacts(company, workingScan, {
    hits,
    runDirectorySearch: false,
    fetchHitsForQueries: undefined,
    skipFetch: options?.skipFetch,
    seedContacts,
  });

  return applyPlatformContactEnrichment(workingScan, enrichment);
}

/** @deprecated Bruk enrichScanContacts */
export const enrichScanWithGulesider = enrichScanContacts;

async function resolveGulesiderPresence(
  company: WebsiteScanCompanyInput,
  hits: SearchHit[],
  options: {
    canSearch: boolean;
    ranGoogleSearch: boolean;
    hasConfidentWebsite?: boolean;
  }
): Promise<GulesiderPresence> {
  let presence = pickGulesiderFromHits(hits, company.name);

  if (
    ENABLE_GULESIDER_SERP_SEARCH &&
    !presence.gulesiderListed &&
    options.canSearch &&
    options.ranGoogleSearch &&
    !options.hasConfidentWebsite
  ) {
    try {
      const query = buildGulesiderSearchQuery(company);
      const extraHits = await fetchHitsForQueries([query], {
        orgnr: company.orgnr,
        serpNum: 8,
      });
      presence = mergeGulesiderPresence(
        presence,
        pickGulesiderFromHits(extraHits, company.name)
      );
      logScan(company.orgnr, "Gulesider-søk", {
        query,
        listed: presence.gulesiderListed,
        url: presence.gulesiderUrl,
      });
    } catch {
      /* behold resultat fra hovedsøk */
    }
  }

  return presence;
}

function resolveLinkedInFromUrls(options: {
  includeLinkedIn: boolean;
  websiteLinkedInUrl?: string | null;
  facebookLinkedInUrl?: string | null;
}): Pick<
  SocialFields,
  | "linkedinUrl"
  | "linkedinConfidence"
  | "linkedinFromWebsite"
  | "linkedinFromFacebook"
> {
  if (!options.includeLinkedIn) {
    return {
      linkedinUrl: null,
      linkedinConfidence: undefined,
      linkedinFromWebsite: false,
      linkedinFromFacebook: false,
    };
  }

  if (options.websiteLinkedInUrl) {
    return {
      linkedinUrl: options.websiteLinkedInUrl,
      linkedinConfidence: "high",
      linkedinFromWebsite: true,
      linkedinFromFacebook: false,
    };
  }

  if (options.facebookLinkedInUrl) {
    return {
      linkedinUrl: options.facebookLinkedInUrl,
      linkedinConfidence: "medium",
      linkedinFromWebsite: false,
      linkedinFromFacebook: true,
    };
  }

  return {
    linkedinUrl: null,
    linkedinConfidence: undefined,
    linkedinFromWebsite: false,
    linkedinFromFacebook: false,
  };
}

const EMPTY_WEBSITE_PICK: PickResult = {
  hasWebsite: false,
  websiteKind: "none",
  websiteUrl: null,
  websiteDomain: null,
  bookingPlatform: null,
  topHits: [],
  confidence: "low",
};

type WebsiteDiscovery = {
  pick: PickResult;
  displayName: string | null;
  websiteFacebookUrl: string | null;
  websiteInstagramUrl: string | null;
  websiteLinkedInUrl: string | null;
  effectiveQuery: string;
  websiteDiscoverySource: WebsiteScanResult["websiteDiscoverySource"];
};

async function discoverWebsiteFromDomainGuess(
  company: WebsiteScanCompanyInput,
  options?: { preferredTld?: string | null }
): Promise<WebsiteDiscovery | null> {
  const guessed = await discoverWebsiteByDomainGuess(company.name, {
    preferredTld:
      options?.preferredTld ?? preferredTldFromPlace(primaryGeoPlace(company)),
  });
  if (!guessed) return null;

  const meta = await fetchWebsitePageMetadata(guessed.websiteUrl).catch(() => ({
    displayName: null,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
  }));

  if (
    !websiteUrlPlausibleForCompany(
      guessed.websiteUrl,
      company.name,
      meta.displayName
    )
  ) {
    return null;
  }

  return {
    pick: {
      hasWebsite: true,
      websiteKind: "own",
      websiteUrl: guessed.websiteUrl,
      websiteDomain: guessed.websiteDomain,
      bookingPlatform: null,
      topHits: [
        {
          title: company.name,
          link: guessed.websiteUrl,
          domain: guessed.websiteDomain,
        },
      ],
      confidence: "high",
    },
    displayName: meta.displayName,
    websiteFacebookUrl: meta.facebookUrl,
    websiteInstagramUrl: meta.instagramUrl,
    websiteLinkedInUrl: meta.linkedinUrl,
    effectiveQuery: `Domene-gjetning @${guessed.websiteDomain}`,
    websiteDiscoverySource: "domain_guess",
  };
}

async function applyPlacesWebsiteDiscovery(
  company: WebsiteScanCompanyInput,
  places: GooglePlacesDiscovery
): Promise<WebsiteDiscovery | null> {
  if (!places.websiteUrl || !places.websiteDomain) return null;

  const meta = await fetchWebsitePageMetadata(places.websiteUrl).catch(() => ({
    displayName: null,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
  }));

  if (
    !websiteUrlPlausibleForCompany(
      places.websiteUrl,
      company.name,
      meta.displayName
    )
  ) {
    return null;
  }

  return {
    pick: {
      hasWebsite: true,
      websiteKind: "own",
      websiteUrl: places.websiteUrl,
      websiteDomain: places.websiteDomain,
      bookingPlatform: null,
      topHits: [
        {
          title: places.placeTitle ?? company.name,
          link: places.websiteUrl,
          domain: places.websiteDomain,
        },
      ],
      confidence: places.confidence,
    },
    displayName: meta.displayName,
    websiteFacebookUrl: meta.facebookUrl,
    websiteInstagramUrl: meta.instagramUrl,
    websiteLinkedInUrl: meta.linkedinUrl,
    effectiveQuery: `Google Maps @${places.websiteDomain}`,
    websiteDiscoverySource: "google_places",
  };
}

function applyPlacesHint(
  company: WebsiteScanCompanyInput,
  places: GooglePlacesDiscovery,
  hintMeta: Awaited<ReturnType<typeof fetchWebsitePageMetadata>>
): {
  hits: SearchHit[];
  finalPick: PickResult;
  source: WebsiteScanSource;
  effectiveQuery: string;
  websiteDiscoverySource: WebsiteScanResult["websiteDiscoverySource"];
  displayName: string | null;
  websiteFacebookUrl: string | null;
  websiteInstagramUrl: string | null;
  websiteLinkedInUrl: string | null;
} {
  const websiteUrl = places.websiteUrl!;
  const websiteDomain = places.websiteDomain!;
  return {
    hits: [{ title: places.placeTitle ?? company.name, link: websiteUrl }],
    finalPick: {
      hasWebsite: true,
      websiteKind: "own",
      websiteUrl,
      websiteDomain,
      bookingPlatform: null,
      topHits: [
        {
          title: places.placeTitle ?? company.name,
          link: websiteUrl,
          domain: websiteDomain,
        },
      ],
      confidence: places.confidence === "low" ? "medium" : places.confidence,
    },
    source: "serper",
    effectiveQuery: `Google Maps @${websiteDomain}`,
    websiteDiscoverySource: "google_places",
    displayName: hintMeta.displayName,
    websiteFacebookUrl: hintMeta.facebookUrl,
    websiteInstagramUrl: hintMeta.instagramUrl,
    websiteLinkedInUrl: hintMeta.linkedinUrl,
  };
}

function applyCrossLinkWebsiteFallback(
  pick: PickResult,
  options: {
    companyName: string;
    facebookWebsiteUrl?: string | null;
    instagramExternalUrl?: string | null;
  }
): { pick: PickResult; discoverySource?: WebsiteScanResult["websiteDiscoverySource"] } {
  if (pick.hasWebsite) {
    return { pick };
  }

  const fbHint = websiteFromCrossLink(options.facebookWebsiteUrl, options.companyName);
  if (fbHint) {
    return {
      pick: {
        hasWebsite: fbHint.kind === "own",
        websiteKind: fbHint.kind,
        websiteUrl: fbHint.websiteUrl,
        websiteDomain: fbHint.websiteDomain,
        bookingPlatform: fbHint.kind === "booking_only" ? fbHint.websiteDomain : null,
        topHits: pick.topHits,
        confidence: "medium",
      },
      discoverySource: "facebook_link",
    };
  }

  const igHint = websiteFromCrossLink(options.instagramExternalUrl, options.companyName);
  if (igHint) {
    return {
      pick: {
        hasWebsite: igHint.kind === "own",
        websiteKind: igHint.kind,
        websiteUrl: igHint.websiteUrl,
        websiteDomain: igHint.websiteDomain,
        bookingPlatform: igHint.kind === "booking_only" ? igHint.websiteDomain : null,
        topHits: pick.topHits,
        confidence: "medium",
      },
      discoverySource: "instagram_external",
    };
  }

  return { pick };
}

async function resolveFacebook(
  company: WebsiteScanCompanyInput,
  hits: SearchHit[],
  fbHits: SearchHit[],
  options?: {
    demo?: boolean;
    includeFacebook?: boolean;
    alternateNames?: string[];
    websiteUrl?: string | null;
    websiteConfidence?: SocialLinkConfidence;
    geoPlaces?: string[];
  }
): Promise<Pick<SocialFields, "facebookUrl" | "facebookConfidence" | "facebookProfile">> {
  if (options?.includeFacebook === false) {
    return {
      facebookUrl: null,
      facebookConfidence: undefined,
      facebookProfile: null,
    };
  }

  const geoPlaces = options?.geoPlaces ?? companyGeoPlaces(company);
  const geoLabel = primaryGeoPlace(company);

  let facebookUrl: string | null = null;
  let facebookConfidence: SocialLinkConfidence | undefined;
  let pickedFromSearch = false;

  const mergedHits = dedupeHits([...hits, ...fbHits]);
  const picked = pickFacebookFromHits(mergedHits, company.name, geoLabel, {
    alternateNames: options?.alternateNames,
    geoPlaces,
  });
  facebookUrl = picked.url;
  facebookConfidence = picked.confidence;
  pickedFromSearch = Boolean(picked.url);

  for (const altName of options?.alternateNames ?? []) {
    if (facebookUrl) break;
    const altPick = pickFacebookFromHits(mergedHits, altName, geoLabel, {
      geoPlaces,
    });
    facebookUrl = altPick.url;
    facebookConfidence = altPick.confidence;
    pickedFromSearch = Boolean(altPick.url);
  }

  if (
    !facebookUrl &&
    options?.websiteUrl &&
    socialUrlMatchesCompany(options.websiteUrl, company.name)
  ) {
    facebookUrl = options.websiteUrl;
    facebookConfidence = options.websiteConfidence ?? "medium";
  }

  if (!facebookUrl && options?.demo) {
    facebookUrl = demoFacebookUrl(company);
    facebookConfidence = "medium";
  }

  if (!facebookUrl) {
    return {
      facebookUrl: null,
      facebookConfidence: undefined,
      facebookProfile: null,
    };
  }

  if (options?.demo) {
    return {
      facebookUrl,
      facebookConfidence: facebookConfidence ?? "medium",
      facebookProfile: demoFacebookProfile(company, facebookUrl),
    };
  }

  if (!pickedFromSearch) {
    return {
      facebookUrl,
      facebookConfidence: facebookConfidence ?? "medium",
      facebookProfile: null,
    };
  }

  const enriched = await enrichFacebookWithSerpApi(facebookUrl, company.name, {
    ...options,
    municipalityName: geoLabel,
    verifiedViaSearch: pickedFromSearch,
  });

  return {
    facebookUrl: enriched.facebookUrl,
    facebookConfidence: enriched.facebookUrl
      ? (facebookConfidence ?? "medium")
      : undefined,
    facebookProfile: enriched.facebookProfile,
  };
}

async function resolveInstagram(
  company: WebsiteScanCompanyInput,
  hits: SearchHit[],
  igHits: SearchHit[],
  facebookProfile: WebsiteScanResult["facebookProfile"],
  options?: {
    demo?: boolean;
    includeInstagram?: boolean;
    alternateNames?: string[];
    websiteUrl?: string | null;
    websiteConfidence?: SocialLinkConfidence;
    geoPlaces?: string[];
  }
): Promise<
  Pick<
    SocialFields,
    | "instagramUrl"
    | "instagramConfidence"
    | "instagramProfile"
    | "instagramFromFacebook"
  >
> {
  if (!options?.includeInstagram) {
    return {
      instagramUrl: null,
      instagramConfidence: undefined,
      instagramProfile: null,
      instagramFromFacebook: false,
    };
  }

  const geoPlaces = options?.geoPlaces ?? companyGeoPlaces(company);
  const geoLabel = primaryGeoPlace(company);

  let instagramUrl: string | null = null;
  let instagramConfidence: SocialLinkConfidence | undefined;
  let fromFacebook = false;
  let pickedFromSearch = false;

  if (
    options?.websiteUrl &&
    socialUrlMatchesCompany(options.websiteUrl, company.name)
  ) {
    instagramUrl = options.websiteUrl;
    instagramConfidence = options.websiteConfidence ?? "medium";
  }

  if (!instagramUrl && facebookProfile?.linkedInstagramUrl) {
    const candidate = facebookProfile.linkedInstagramUrl;
    if (socialUrlMatchesCompany(candidate, company.name)) {
      instagramUrl = candidate;
      fromFacebook = true;
      instagramConfidence = "medium";
    }
  }

  const mergedIgHits = dedupeHits([...hits, ...igHits]);

  if (!instagramUrl) {
    const picked = pickInstagramFromHits(
      mergedIgHits,
      company.name,
      geoLabel,
      { alternateNames: options?.alternateNames, geoPlaces }
    );
    instagramUrl = picked.url;
    instagramConfidence = picked.confidence;
    pickedFromSearch = Boolean(picked.url);
  }

  for (const altName of options?.alternateNames ?? []) {
    if (instagramUrl) break;
    const altPick = pickInstagramFromHits(
      mergedIgHits,
      altName,
      geoLabel,
      { geoPlaces }
    );
    instagramUrl = altPick.url;
    instagramConfidence = altPick.confidence;
    pickedFromSearch = Boolean(altPick.url);
  }

  if (!instagramUrl && options?.demo) {
    instagramUrl = demoInstagramUrl(company);
    fromFacebook = false;
    instagramConfidence = "medium";
  }

  if (!instagramUrl) {
    return {
      instagramUrl: null,
      instagramConfidence: undefined,
      instagramProfile: null,
      instagramFromFacebook: false,
    };
  }

  const ig = await enrichInstagramWithSerpApi(instagramUrl, company.name, {
    demo: options?.demo,
    verifiedViaSearch: pickedFromSearch,
    fromFacebook,
  });

  return {
    instagramUrl: ig.instagramUrl,
    instagramConfidence: ig.instagramUrl
      ? (instagramConfidence ?? (fromFacebook ? "high" : "medium"))
      : undefined,
    instagramProfile: ig.instagramProfile,
    instagramFromFacebook: ig.instagramFromFacebook,
  };
}

async function resolveSocial(
  company: WebsiteScanCompanyInput,
  hits: SearchHit[],
  fbHits: SearchHit[],
  igHits: SearchHit[],
  options: {
    demo?: boolean;
    social: ScanSocialOptions;
    alternateNames?: string[];
    websiteFacebookUrl?: string | null;
    websiteInstagramUrl?: string | null;
  }
): Promise<SocialFields> {
  const alt = options.alternateNames ?? [];
  const geoPlaces = companyGeoPlaces(company);
  const { facebookUrl, facebookConfidence, facebookProfile } =
    await resolveFacebook(company, hits, fbHits, {
      demo: options.demo,
      includeFacebook: options.social.includeFacebook,
      alternateNames: alt,
      websiteUrl: options.websiteFacebookUrl,
      websiteConfidence: "medium",
      geoPlaces,
    });

  const ig = await resolveInstagram(company, hits, igHits, facebookProfile, {
    demo: options.demo,
    includeInstagram: options.social.includeInstagram,
    alternateNames: alt,
    websiteUrl: options.websiteInstagramUrl,
    websiteConfidence: "medium",
    geoPlaces,
  });

  return { facebookUrl, facebookConfidence, facebookProfile, ...ig };
}

function hasPaidWebSearch(): boolean {
  return hasGoogleCse() || hasSerpApi() || hasSerper();
}

async function trySerperSearch(
  query: string,
  options?: { serpNum?: number; orgnr?: string; userId?: string }
): Promise<SearchHit[]> {
  try {
    return await searchSerper(query, {
      num: options?.serpNum,
      userId: options?.userId,
    });
  } catch (err) {
    if (err instanceof SerperLimitReachedError) throw err;
    logScan(
      options?.orgnr ?? "?",
      `Serper feilet: ${query}`,
      err instanceof Error ? err.message : err
    );
    if (hasFreeWebSearch()) {
      return await searchDuckDuckGo(query);
    }
    throw err;
  }
}

async function fetchHitsForQuery(
  query: string,
  options?: { serpNum?: number; orgnr?: string; userId?: string }
): Promise<SearchHit[]> {
  if (hasSerper()) {
    try {
      return await trySerperSearch(query, options);
    } catch (err) {
      if (err instanceof SerperLimitReachedError) throw err;
      logScan(
        options?.orgnr ?? "?",
        `Serper feilet: ${query}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (hasFreeWebSearch()) {
    try {
      return await searchDuckDuckGo(query);
    } catch (err) {
      logScan(
        options?.orgnr ?? "?",
        `DuckDuckGo feilet: ${query}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (hasGoogleCse()) {
    try {
      return await searchGoogleCse(query);
    } catch (err) {
      logScan(
        options?.orgnr ?? "?",
        `Google CSE feilet: ${query}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (hasSerpApi()) {
    return await searchSerpApi(query, { num: options?.serpNum });
  }

  return [];
}

function resolveSearchSource(): WebsiteScanSource {
  if (hasSerper()) return "serper";
  if (hasFreeWebSearch()) return "google_cse";
  if (hasGoogleCse()) return "google_cse";
  if (hasSerpApi()) return "serpapi";
  return "google_cse";
}

function socialFoundInHits(
  mainHits: SearchHit[],
  company: WebsiteScanCompanyInput,
  platform: "facebook" | "instagram",
  context: { alternateNames: string[]; websiteUrl?: string | null }
): boolean {
  if (
    context.websiteUrl &&
    socialUrlMatchesCompany(context.websiteUrl, company.name)
  ) {
    return true;
  }

  const geoLabel = primaryGeoPlace(company);
  const geoPlaces = companyGeoPlaces(company);
  const pick =
    platform === "facebook"
      ? pickFacebookFromHits(mainHits, company.name, geoLabel, {
          geoPlaces,
          alternateNames: context.alternateNames,
        })
      : pickInstagramFromHits(mainHits, company.name, geoLabel, {
          geoPlaces,
          alternateNames: context.alternateNames,
        });

  if (pick.url) return true;

  for (const altName of context.alternateNames) {
    const altPick =
      platform === "facebook"
        ? pickFacebookFromHits(mainHits, altName, geoLabel, { geoPlaces })
        : pickInstagramFromHits(mainHits, altName, geoLabel, { geoPlaces });
    if (altPick.url) return true;
  }

  return false;
}

async function fetchWebsiteSearchHits(
  company: WebsiteScanCompanyInput,
  options: { canSearch: boolean; userId?: string }
): Promise<SearchHit[]> {
  if (!options.canSearch) return [];

  if (hasSerper()) {
    try {
      const { hits } = await searchSerperForWebsite(company, {
        userId: options.userId,
      });
      if (hits.length) return hits;
    } catch (err) {
      if (err instanceof SerperLimitReachedError) throw err;
      logScan(
        company.orgnr,
        "Serper nettside-søk feilet — prøver fallback",
        err instanceof Error ? err.message : err
      );
    }
  }

  const query =
    buildWebsiteSearchQueries(company)[0] ?? buildSearchQuery(company);
  return fetchHitsForQuery(query, {
    orgnr: company.orgnr,
    serpNum: GOOGLE_SERP_NUM,
    userId: options.userId,
  }).catch((err) => {
    if (err instanceof SerperLimitReachedError) throw err;
    return [] as SearchHit[];
  });
}

async function fetchHitsForQueries(
  queries: string[],
  options?: { serpNum?: number; orgnr?: string; userId?: string }
): Promise<SearchHit[]> {
  const batches = await Promise.all(
    queries.map((q) =>
      fetchHitsForQuery(q, options).catch(() => [] as SearchHit[])
    )
  );
  return dedupeHits(batches.flat());
}

async function fetchSocialSerpHitsUntilFound(
  queries: string[],
  maxQueries: number,
  platform: "facebook" | "instagram",
  company: WebsiteScanCompanyInput,
  context: {
    alternateNames: string[];
    websiteUrl?: string | null;
  },
  serpOpts: { serpNum?: number; orgnr?: string; userId?: string }
): Promise<{ hits: SearchHit[]; queriesRun: number }> {
  const allHits: SearchHit[] = [];
  let queriesRun = 0;

  for (const q of queries.slice(0, maxQueries)) {
    queriesRun++;
    const batch = await fetchHitsForQuery(q, serpOpts).catch(
      () => [] as SearchHit[]
    );
    allHits.push(...batch);
    const merged = dedupeHits(allHits);
    if (
      socialFoundInHits(merged, company, platform, {
        alternateNames: context.alternateNames,
        websiteUrl: context.websiteUrl,
      })
    ) {
      return { hits: merged, queriesRun };
    }
  }

  return { hits: dedupeHits(allHits), queriesRun };
}

function alternateCompanyNames(
  company: WebsiteScanCompanyInput,
  displayName?: string | null
): string[] {
  const alts: string[] = [];
  if (
    displayName?.trim() &&
    displayNameDiffersFromLegal(displayName, company.name)
  ) {
    alts.push(displayName.trim());
  }
  for (const variant of companySearchNameVariants(company.name)) {
    if (variant !== company.name.trim() && !alts.includes(variant)) {
      alts.push(variant);
    }
  }
  return alts;
}

function demoScan(company: WebsiteScanCompanyInput): WebsiteScanResult {
  const queryLabel = buildSearchQueries(company).join(" | ");
  const emailHint = websiteFromEmail(company.email, company.name);

  const emptySocial: SocialFields = {
    facebookUrl: null,
    facebookConfidence: undefined,
    facebookProfile: null,
    instagramUrl: null,
    instagramConfidence: undefined,
    instagramProfile: null,
    instagramFromFacebook: false,
    linkedinUrl: null,
    linkedinConfidence: undefined,
    linkedinFromWebsite: false,
    linkedinFromFacebook: false,
  };

  if (emailHint) {
    return fromPick(
      company.orgnr,
      {
        hasWebsite: true,
        websiteKind: "own",
        websiteUrl: emailHint.websiteUrl,
        websiteDomain: emailHint.websiteDomain,
        bookingPlatform: null,
        topHits: [
          {
            title: company.name,
            link: emailHint.websiteUrl,
            domain: emailHint.websiteDomain,
          },
        ],
        confidence: "high",
      },
      "demo",
      `E-post @${emailHint.websiteDomain}`,
      undefined,
      emptySocial
    );
  }

  return fromPick(
    company.orgnr,
    {
      hasWebsite: false,
      websiteKind: "none",
      websiteUrl: null,
      websiteDomain: null,
      bookingPlatform: null,
      topHits: [],
      confidence: "low",
    },
    "demo",
    `${queryLabel} (demo — legg inn SerpAPI for ekte Google-sjekk)`,
    undefined,
    emptySocial
  );
}

async function fetchSocialSerpHits(
  company: WebsiteScanCompanyInput,
  social: ScanSocialOptions,
  context: {
    displayName?: string | null;
    websiteDomain?: string | null;
    mainHits: SearchHit[];
    websiteFacebookUrl?: string | null;
    websiteInstagramUrl?: string | null;
    alternateNames: string[];
    userId?: string;
  }
): Promise<{ fbHits: SearchHit[]; igHits: SearchHit[] }> {
  const canSearch = hasPaidWebSearch() || hasFreeWebSearch();
  if (!canSearch) return { fbHits: [], igHits: [] };

  const serpOpts = {
    serpNum: SOCIAL_SERP_NUM,
    orgnr: company.orgnr,
    userId: context.userId,
  };
  const socialContext = {
    alternateNames: context.alternateNames,
  };

  let fbHits: SearchHit[] = [];
  let igHits: SearchHit[] = [];
  let fbQueriesRun = 0;
  let igQueriesRun = 0;

  if (social.includeFacebook) {
    const hasFb = socialFoundInHits(
      context.mainHits,
      company,
      "facebook",
      { ...socialContext, websiteUrl: context.websiteFacebookUrl }
    );
    if (!hasFb) {
      const fbQueries = buildFacebookSearchQueries(company, context);
      const fbResult = await fetchSocialSerpHitsUntilFound(
        fbQueries,
        MAX_FALLBACK_SOCIAL_QUERIES,
        "facebook",
        company,
        { ...socialContext, websiteUrl: context.websiteFacebookUrl },
        serpOpts
      );
      fbQueriesRun = fbResult.queriesRun;
      fbHits = fbResult.hits;
    }
  }

  if (social.includeInstagram) {
    const hasIg = socialFoundInHits(
      context.mainHits,
      company,
      "instagram",
      { ...socialContext, websiteUrl: context.websiteInstagramUrl }
    );
    if (!hasIg) {
      const igQueries = buildInstagramSearchQueries(company, context);
      const igResult = await fetchSocialSerpHitsUntilFound(
        igQueries,
        MAX_FALLBACK_SOCIAL_QUERIES,
        "instagram",
        company,
        { ...socialContext, websiteUrl: context.websiteInstagramUrl },
        serpOpts
      );
      igQueriesRun = igResult.queriesRun;
      igHits = igResult.hits;
    }
  }

  logScan(company.orgnr, "Sosialt søk", {
    fbSkipped: social.includeFacebook && fbQueriesRun === 0,
    igSkipped: social.includeInstagram && igQueriesRun === 0,
    fbQueries: fbQueriesRun,
    igQueries: igQueriesRun,
    fbHits: fbHits.length,
    igHits: igHits.length,
  });

  return { fbHits, igHits };
}

export async function scanCompanyWebsite(
  company: WebsiteScanCompanyInput,
  options?: ScanCompanyOptions
): Promise<WebsiteScanResult> {
  const social: ScanSocialOptions = {
    ...DEFAULT_SCAN_SOCIAL_OPTIONS,
    ...options?.social,
  };

  const searchQueries = buildSearchQueries(company);
  const queryLabel = searchQueries.join(" | ");
  const brregHint = websiteFromBrreg(company.website, company.name);
  const emailHint = brregHint ? null : websiteFromEmail(company.email, company.name);
  const websiteHint = brregHint ?? emailHint;
  const canSearch = hasPaidWebSearch() || hasFreeWebSearch();

  if (options?.demo) {
    const base = demoScan(company);
    const socialResult = await resolveSocial(company, [], [], [], {
      demo: true,
      social,
    });
    const demoListed =
      !base.hasWebsite && parseInt(company.orgnr.replace(/\D/g, "").slice(-2), 10) % 3 === 0;
    const demoBase: WebsiteScanResult = {
      ...base,
      ...socialResult,
      socialScan: buildSocialScanMeta(social),
      gulesiderListed: demoListed,
      gulesiderUrl: demoListed
        ? `https://www.gulesider.no/${encodeURIComponent(stripCompanySuffix(company.name))}/bedrifter`
        : null,
      gulesiderConfidence: demoListed ? "medium" : undefined,
    };
    return enrichScanContacts(company, demoBase, { skipFetch: true });
  }

  let hits: SearchHit[] = [];
  let finalPick: PickResult = EMPTY_WEBSITE_PICK;
  let source: WebsiteScanSource = "google_cse";
  let effectiveQuery = queryLabel;
  let displayName: string | null = null;
  let websiteFacebookUrl: string | null = null;
  let websiteInstagramUrl: string | null = null;
  let websiteLinkedInUrl: string | null = null;
  let websiteDiscoverySource: WebsiteScanResult["websiteDiscoverySource"] = null;
  let usedVerifiedHint = false;
  let placesDiscovery: GooglePlacesDiscovery | null = null;
  let skipOrganicGoogleSearch = false;
  let placesSeedContacts: PlatformContactRecord[] | undefined;

  if (websiteHint) {
    const hintMeta = await fetchWebsitePageMetadata(websiteHint.websiteUrl).catch(
      () => ({
        displayName: null,
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      })
    );
    if (
      websiteUrlPlausibleForCompany(
        websiteHint.websiteUrl,
        company.name,
        hintMeta.displayName
      )
    ) {
      usedVerifiedHint = true;
      displayName = hintMeta.displayName;
      websiteFacebookUrl = hintMeta.facebookUrl;
      websiteInstagramUrl = hintMeta.instagramUrl;
      websiteLinkedInUrl = hintMeta.linkedinUrl;
      hits = [{ title: company.name, link: websiteHint.websiteUrl }];
      finalPick = {
        hasWebsite: true,
        websiteKind: "own",
        websiteUrl: websiteHint.websiteUrl,
        websiteDomain: websiteHint.websiteDomain,
        bookingPlatform: null,
        topHits: [
          {
            title: company.name,
            link: websiteHint.websiteUrl,
            domain: websiteHint.websiteDomain,
          },
        ],
        confidence: brregHint ? "high" : "medium",
      };
      source = brregHint ? "brreg_website" : "email_domain";
      effectiveQuery = brregHint
        ? `Brreg hjemmeside @${websiteHint.websiteDomain}`
        : `E-post @${websiteHint.websiteDomain}`;
      websiteDiscoverySource = brregHint ? "brreg" : "email";
    } else {
      logScan(company.orgnr, "Hint avvist — prøver Google", {
        url: websiteHint.websiteUrl,
        displayName: hintMeta.displayName,
      });
    }
  }

  const userId = options?.userId;

  if (!usedVerifiedHint && isSerperPlacesEnabled()) {
    try {
      placesDiscovery = await discoverFromGooglePlaces(company, userId);
      if (placesDiscovery) {
        logScan(company.orgnr, "Google Maps (Serper Places)", {
          placeTitle: placesDiscovery.placeTitle,
          website: placesDiscovery.websiteUrl,
          phone: placesDiscovery.phone,
          confidence: placesDiscovery.confidence,
        });

        placesSeedContacts =
          placesSeedContactsFromPhone(placesDiscovery, company.orgnr) ?? [
            {
              source: "google_places",
              url: "https://www.google.com/maps",
              phone: null,
              email: null,
              externalWebsite: placesDiscovery.websiteUrl ?? null,
            },
          ];

        if (placesDiscovery.websiteUrl) {
          const hintMeta = await fetchWebsitePageMetadata(
            placesDiscovery.websiteUrl
          ).catch(() => ({
            displayName: null,
            facebookUrl: null,
            instagramUrl: null,
            linkedinUrl: null,
          }));
          if (
            websiteUrlPlausibleForCompany(
              placesDiscovery.websiteUrl,
              company.name,
              hintMeta.displayName
            )
          ) {
            usedVerifiedHint = true;
            const applied = applyPlacesHint(company, placesDiscovery, hintMeta);
            hits = applied.hits;
            finalPick = applied.finalPick;
            source = applied.source;
            effectiveQuery = applied.effectiveQuery;
            websiteDiscoverySource = applied.websiteDiscoverySource;
            displayName = applied.displayName;
            websiteFacebookUrl = applied.websiteFacebookUrl;
            websiteInstagramUrl = applied.websiteInstagramUrl;
            websiteLinkedInUrl = applied.websiteLinkedInUrl;
          }
        }

        const placesWebsiteRejected =
          Boolean(placesDiscovery.websiteUrl) && !usedVerifiedHint;
        if (
          !usedVerifiedHint &&
          !placesWebsiteRejected &&
          placesDiscoveryEnoughToSkipOrganic(placesDiscovery)
        ) {
          skipOrganicGoogleSearch = true;
        }
      }
    } catch (err) {
      if (err instanceof SerperLimitReachedError) throw err;
      logScan(
        company.orgnr,
        "Serper Places feilet",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (!usedVerifiedHint) {
    let organicSearchNeeded = false;

    const domainDiscovery = await discoverWebsiteFromDomainGuess(company);
    const weakDomainGuess = Boolean(
      domainDiscovery &&
        isWeakDomainGuess(
          company.name,
          domainDiscovery.pick.websiteDomain,
          primaryGeoPlace(company)
        )
    );

    if (domainDiscovery && !weakDomainGuess) {
      finalPick = domainDiscovery.pick;
      displayName = domainDiscovery.displayName;
      websiteFacebookUrl = domainDiscovery.websiteFacebookUrl;
      websiteInstagramUrl = domainDiscovery.websiteInstagramUrl;
      websiteLinkedInUrl = domainDiscovery.websiteLinkedInUrl;
      effectiveQuery = domainDiscovery.effectiveQuery;
      websiteDiscoverySource = domainDiscovery.websiteDiscoverySource;
      source = resolveSearchSource();
      hits = domainDiscovery.pick.topHits?.map((h) => ({
        title: h.title,
        link: h.link,
      })) ?? [];
      logScan(company.orgnr, "Nettside via domene-gjetning (før Google)", {
        url: finalPick.websiteUrl,
      });
    } else if (skipOrganicGoogleSearch && placesDiscovery) {
      const placesWebsite = await applyPlacesWebsiteDiscovery(
        company,
        placesDiscovery
      );
      if (placesWebsite) {
        finalPick = placesWebsite.pick;
        displayName = placesWebsite.displayName;
        websiteFacebookUrl = placesWebsite.websiteFacebookUrl;
        websiteInstagramUrl = placesWebsite.websiteInstagramUrl;
        websiteLinkedInUrl = placesWebsite.websiteLinkedInUrl;
        effectiveQuery = placesWebsite.effectiveQuery;
        websiteDiscoverySource = placesWebsite.websiteDiscoverySource;
        source = "serper";
        hits =
          placesWebsite.pick.topHits?.map((h) => ({
            title: h.title,
            link: h.link,
          })) ?? [];
        logScan(company.orgnr, "Nettside via Google Maps (uten organisk Google)", {
          url: finalPick.websiteUrl,
        });
      } else {
        logScan(company.orgnr, "Google Maps uten nettside — prøver Serper organisk", {
          phone: placesDiscovery.phone,
          website: placesDiscovery.websiteUrl,
        });
        organicSearchNeeded = true;
      }
    } else {
      organicSearchNeeded = true;
    }

    if (weakDomainGuess) {
      logScan(company.orgnr, "Svak domene-gjetning — prøver Serper organisk", {
        url: domainDiscovery?.pick.websiteUrl,
      });
    }

    if (organicSearchNeeded) {
      try {
        hits = await fetchWebsiteSearchHits(company, { canSearch, userId });
        finalPick = pickBestWebsite(hits, company.name, {
          municipalityName: primaryGeoPlace(company),
        });
      } catch (err) {
        if (err instanceof SerperLimitReachedError) throw err;
        hits = [];
        finalPick = EMPTY_WEBSITE_PICK;
      }

      source = resolveSearchSource();
      effectiveQuery = buildWebsiteSearchQueries(company).slice(0, 2).join(" | ");
      websiteDiscoverySource = finalPick.hasWebsite ? "google" : null;

      if (finalPick.hasWebsite && finalPick.websiteUrl) {
        const meta = await fetchWebsitePageMetadata(finalPick.websiteUrl).catch(
          () => ({
            displayName: null,
            facebookUrl: null,
            instagramUrl: null,
            linkedinUrl: null,
          })
        );
        displayName = meta.displayName;
        websiteFacebookUrl = meta.facebookUrl;
        websiteInstagramUrl = meta.instagramUrl;
        websiteLinkedInUrl = meta.linkedinUrl;

        if (
          !websiteUrlPlausibleForCompany(
            finalPick.websiteUrl,
            company.name,
            displayName
          )
        ) {
          logScan(company.orgnr, "Google-treff avvist", {
            url: finalPick.websiteUrl,
            displayName,
          });
          finalPick = EMPTY_WEBSITE_PICK;
          websiteDiscoverySource = null;
        }
      }

      const prefTld = preferredTldFromPlace(primaryGeoPlace(company));
      if (
        finalPick.hasWebsite &&
        prefTld &&
        finalPick.websiteDomain &&
        !finalPick.websiteDomain.endsWith(prefTld.slice(1))
      ) {
        const tldDiscovery = await discoverWebsiteFromDomainGuess(company, {
          preferredTld: prefTld,
        });
        if (tldDiscovery) {
          finalPick = tldDiscovery.pick;
          displayName = tldDiscovery.displayName;
          websiteFacebookUrl = tldDiscovery.websiteFacebookUrl;
          websiteInstagramUrl = tldDiscovery.websiteInstagramUrl;
          websiteLinkedInUrl = tldDiscovery.websiteLinkedInUrl;
          websiteDiscoverySource = tldDiscovery.websiteDiscoverySource;
          effectiveQuery = tldDiscovery.effectiveQuery;
        }
      }
    }

    logScan(company.orgnr, "Nettside-metadata", {
      displayName,
      websiteFacebookUrl,
      websiteInstagramUrl,
      websiteLinkedInUrl,
    });
  }

  const alts = alternateCompanyNames(company, displayName);
  const socialContext = {
    displayName,
    websiteDomain: finalPick.websiteDomain ?? undefined,
  };

  const earlyGulesider = pickGulesiderFromHits(hits, company.name);
  const directoryHtmlCache = new Map<string, string>();

  let freeFbHits: SearchHit[] = [];
  if (social.includeFacebook) {
    freeFbHits = await discoverFacebookFromDirectoriesFree(company, {
      gulesiderUrl: earlyGulesider.gulesiderUrl,
      alternateNames: alts,
      cachedHtml: directoryHtmlCache,
    }).catch(() => [] as SearchHit[]);
    if (freeFbHits.length) {
      logScan(company.orgnr, "Facebook via katalog (gratis)", {
        hits: freeFbHits.length,
        urls: freeFbHits.map((h) => h.link),
      });
    }
  }

  const { fbHits, igHits } = await fetchSocialSerpHits(company, social, {
    ...socialContext,
    mainHits: hits,
    websiteFacebookUrl,
    websiteInstagramUrl,
    alternateNames: alts,
    userId,
  });

  const mergedFbHits = dedupeHits([...freeFbHits, ...fbHits]);

  const socialResult = await resolveSocial(company, hits, mergedFbHits, igHits, {
    demo: options?.demo,
    social,
    alternateNames: alts,
    websiteFacebookUrl,
    websiteInstagramUrl,
  });

  const linkedInResult = resolveLinkedInFromUrls({
    includeLinkedIn: social.includeLinkedIn,
    websiteLinkedInUrl,
    facebookLinkedInUrl: socialResult.facebookProfile?.linkedLinkedInUrl,
  });

  const fallback = applyCrossLinkWebsiteFallback(finalPick, {
    companyName: company.name,
    facebookWebsiteUrl: socialResult.facebookProfile?.linkedWebsiteUrl,
    instagramExternalUrl: socialResult.instagramProfile?.externalUrl,
  });
  finalPick = fallback.pick;
  if (fallback.discoverySource) {
    websiteDiscoverySource = fallback.discoverySource;
  }

  const mergedSocial: SocialFields = {
    ...socialResult,
    ...linkedInResult,
  };

  logScan(company.orgnr, "Sosialt resultat", {
    facebookUrl: mergedSocial.facebookUrl,
    instagramUrl: mergedSocial.instagramUrl,
    linkedinUrl: mergedSocial.linkedinUrl,
    websiteDiscoverySource,
  });

  const gulesider = await resolveGulesiderPresence(company, hits, {
    canSearch,
    ranGoogleSearch: !usedVerifiedHint && !skipOrganicGoogleSearch,
    hasConfidentWebsite:
      finalPick.hasWebsite && finalPick.confidence !== "low",
  });

  const base = fromPick(
    company.orgnr,
    finalPick,
    source,
    effectiveQuery,
    finalPick.topHits ?? [],
    mergedSocial,
    displayName,
    social,
    { websiteDiscoverySource, gulesider }
  );

  return enrichScanContacts(company, base, {
    seedContacts: placesSeedContacts,
  });
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
