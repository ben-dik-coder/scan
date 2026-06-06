import { hasGoogleCse, hasSerpApi } from "./config";
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
} from "./platform-contact";
import {
  buildSearchQueries,
  dedupeHits,
  displayNameDiffersFromLegal,
  normalizeDomain,
  pickBestWebsite,
  stripCompanySuffix,
  type SearchHit,
} from "./parse-results";
import { searchSerpApi } from "./serpapi";
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

const SOCIAL_SERP_NUM = 15;
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
export async function enrichScanContacts(
  company: WebsiteScanCompanyInput,
  scan: WebsiteScanResult,
  options?: { skipFetch?: boolean; allowSocialProfileEnrichment?: boolean }
): Promise<WebsiteScanResult> {
  if (scan.contactsEnriched) return scan;

  let workingScan = scan;

  if (
    options?.allowSocialProfileEnrichment &&
    !options?.skipFetch &&
    hasSerpApi()
  ) {
    if (scan.facebookUrl && !scan.facebookProfile) {
      const fb = await enrichFacebookWithSerpApi(scan.facebookUrl, company.name, {
        municipalityName: primaryGeoPlace(company),
        verifiedViaSearch: true,
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
        verifiedViaSearch: !scan.instagramFromFacebook,
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

  const enrichment = await enrichPlatformContacts(company, workingScan, {
    hits,
    runDirectorySearch: false,
    fetchHitsForQueries: undefined,
    skipFetch: options?.skipFetch,
  });

  return applyPlatformContactEnrichment(workingScan, enrichment);
}

/** @deprecated Bruk enrichScanContacts */
export const enrichScanWithGulesider = enrichScanContacts;

async function resolveGulesiderPresence(
  company: WebsiteScanCompanyInput,
  hits: SearchHit[],
  options: { canSearch: boolean; ranGoogleSearch: boolean }
): Promise<GulesiderPresence> {
  let presence = pickGulesiderFromHits(hits, company.name);

  if (
    !presence.gulesiderListed &&
    options.canSearch &&
    options.ranGoogleSearch
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

function applyCrossLinkWebsiteFallback(
  pick: PickResult,
  options: {
    facebookWebsiteUrl?: string | null;
    instagramExternalUrl?: string | null;
  }
): { pick: PickResult; discoverySource?: WebsiteScanResult["websiteDiscoverySource"] } {
  if (pick.hasWebsite) {
    return { pick };
  }

  const fbHint = websiteFromCrossLink(options.facebookWebsiteUrl);
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

  const igHint = websiteFromCrossLink(options.instagramExternalUrl);
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

  let facebookUrl = options?.websiteUrl ?? null;
  let facebookConfidence: SocialLinkConfidence | undefined =
    facebookUrl ? (options?.websiteConfidence ?? "high") : undefined;

  if (!facebookUrl) {
    const mergedHits = dedupeHits([...hits, ...fbHits]);
    const picked = pickFacebookFromHits(
      mergedHits,
      company.name,
      geoLabel,
      { alternateNames: options?.alternateNames, geoPlaces }
    );
    facebookUrl = picked.url;
    facebookConfidence = picked.confidence;

    for (const altName of options?.alternateNames ?? []) {
      if (facebookUrl) break;
      const altPick = pickFacebookFromHits(
        mergedHits,
        altName,
        geoLabel,
        { geoPlaces }
      );
      facebookUrl = altPick.url;
      facebookConfidence = altPick.confidence;
    }
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

  const enriched = await enrichFacebookWithSerpApi(facebookUrl, company.name, {
    ...options,
    municipalityName: geoLabel,
    verifiedViaSearch: true,
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

  let instagramUrl = options?.websiteUrl ?? null;
  let instagramConfidence: SocialLinkConfidence | undefined =
    instagramUrl ? (options?.websiteConfidence ?? "high") : undefined;
  let fromFacebook = false;

  if (!instagramUrl) {
    instagramUrl = facebookProfile?.linkedInstagramUrl ?? null;
    fromFacebook = Boolean(instagramUrl);
    if (instagramUrl) instagramConfidence = "high";
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
    verifiedViaSearch: !fromFacebook,
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
      websiteConfidence: "high",
      geoPlaces,
    });

  const ig = await resolveInstagram(company, hits, igHits, facebookProfile, {
    demo: options.demo,
    includeInstagram: options.social.includeInstagram,
    alternateNames: alt,
    websiteUrl: options.websiteInstagramUrl,
    websiteConfidence: "high",
    geoPlaces,
  });

  return { facebookUrl, facebookConfidence, facebookProfile, ...ig };
}

async function fetchHitsForQuery(
  query: string,
  options?: { serpNum?: number; orgnr?: string }
): Promise<SearchHit[]> {
  const batches: SearchHit[][] = [];

  if (hasSerpApi()) {
    try {
      batches.push(await searchSerpApi(query, { num: options?.serpNum }));
    } catch (err) {
      logScan(
        options?.orgnr ?? "?",
        `SerpAPI feilet: ${query}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (hasGoogleCse()) {
    try {
      batches.push(await searchGoogleCse(query));
    } catch (err) {
      logScan(
        options?.orgnr ?? "?",
        `Google CSE feilet: ${query}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return dedupeHits(batches.flat());
}

async function fetchHitsForQueries(
  queries: string[],
  options?: { serpNum?: number; orgnr?: string }
): Promise<SearchHit[]> {
  const batches = await Promise.all(
    queries.map((q) =>
      fetchHitsForQuery(q, options).catch(() => [] as SearchHit[])
    )
  );
  return dedupeHits(batches.flat());
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
  }
): Promise<{ fbHits: SearchHit[]; igHits: SearchHit[] }> {
  const canSearch = hasGoogleCse() || hasSerpApi();
  if (!canSearch) return { fbHits: [], igHits: [] };

  const fbQueries = buildFacebookSearchQueries(company, context).slice(0, 1);
  const igQueries = buildInstagramSearchQueries(company, context).slice(0, 1);
  const serpOpts = { serpNum: SOCIAL_SERP_NUM, orgnr: company.orgnr };

  const tasks: Promise<SearchHit[]>[] = [];
  if (social.includeFacebook) {
    tasks.push(
      fetchHitsForQueries(fbQueries, serpOpts).catch(() => [] as SearchHit[])
    );
  }
  if (social.includeInstagram) {
    tasks.push(
      fetchHitsForQueries(igQueries, serpOpts).catch(() => [] as SearchHit[])
    );
  }

  const results = await Promise.all(tasks);
  let idx = 0;
  const fbHits = social.includeFacebook ? (results[idx++] ?? []) : [];
  const igHits = social.includeInstagram ? (results[idx] ?? []) : [];

  logScan(company.orgnr, "Sosialt søk", {
    fbQueries: fbQueries.length,
    igQueries: igQueries.length,
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
  const brregHint = websiteFromBrreg(company.website);
  const emailHint = brregHint ? null : websiteFromEmail(company.email, company.name);
  const websiteHint = brregHint ?? emailHint;

  if (options?.demo || (!hasGoogleCse() && !hasSerpApi())) {
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
  let finalPick: PickResult;
  let source: WebsiteScanSource;
  let effectiveQuery = queryLabel;

  if (websiteHint) {
    hits = [
      {
        title: company.name,
        link: websiteHint.websiteUrl,
      },
    ];
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
  } else {
    const canSearch = hasGoogleCse() || hasSerpApi();
    try {
      hits = canSearch
        ? await fetchHitsForQueries(searchQueries.slice(0, 1), { orgnr: company.orgnr })
        : [];
      finalPick = pickBestWebsite(hits, company.name, {
        municipalityName: primaryGeoPlace(company),
      });
    } catch {
      hits = [];
      finalPick = {
        hasWebsite: false,
        websiteKind: "none",
        websiteUrl: null,
        websiteDomain: null,
        bookingPlatform: null,
        topHits: [],
        confidence: "low",
      };
    }

    source = hasSerpApi()
      ? hasGoogleCse()
        ? "both"
        : "serpapi"
      : "google_cse";
  }

  let displayName: string | null = null;
  let websiteFacebookUrl: string | null = null;
  let websiteInstagramUrl: string | null = null;
  let websiteLinkedInUrl: string | null = null;
  let websiteDiscoverySource: WebsiteScanResult["websiteDiscoverySource"] =
    brregHint ? "brreg" : emailHint ? "email" : finalPick.hasWebsite ? "google" : null;

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

  const { fbHits, igHits } = await fetchSocialSerpHits(
    company,
    social,
    socialContext
  );

  const socialResult = await resolveSocial(company, hits, fbHits, igHits, {
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
    canSearch: false,
    ranGoogleSearch: true,
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

  return enrichScanContacts(company, base);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
