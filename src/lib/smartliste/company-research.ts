import { fetchEnhet } from "@/lib/brreg/client";
import { hasAnyWebsiteScanProvider } from "@/lib/website-scan/config";
import { isDemoMode } from "@/lib/demo/config";
import { fetchBrregRolePersons, type BrregRolePerson } from "@/lib/website-scan/lookup-directory-contact";
import { buildWebsiteSearchQueries } from "@/lib/website-scan/parse-results";
import type { SearchHit } from "@/lib/website-scan/parse-results";
import {
  loadCachedWebsiteScans,
  persistCachedWebsiteScans,
} from "@/lib/website-scan/saved-scans-server";
import { scanCompanyWebsite } from "@/lib/website-scan/scan-company";
import { DEFAULT_SCAN_SOCIAL_OPTIONS } from "@/lib/website-scan/scan-social-options";
import { searchSerper, searchSerperForWebsite } from "@/lib/website-scan/serper";
import type { WebsiteScanCompanyInput, WebsiteScanResult } from "@/lib/website-scan/types";
import {
  buildCompanyFacts,
  factsToPromptBlock,
  type SmartListCompanyFacts,
} from "@/lib/smartliste/company-facts";
import { resolveAnalysisPhone } from "@/lib/smartliste/resolve-analysis-phone";
import type { Company } from "@/types/database";

export type CompanyResearchBundle = {
  facts: SmartListCompanyFacts;
  roles: BrregRolePerson[];
  scan?: WebsiteScanResult;
  webHits: SearchHit[];
  brregIndustry?: string | null;
  brregRegistered?: string | null;
  brregWebsite?: string | null;
  researchLines: string[];
  sources: string[];
  liveScanRan?: boolean;
  /** Telefon funnet under analyse — skal lagres på companies. */
  phonePatch?: Partial<Pick<Company, "phone" | "mobile">> | null;
};

function toScanInput(company: Company): WebsiteScanCompanyInput {
  return {
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    municipality_name: company.municipality_name,
    city: company.city,
    website: company.website,
    industry_code: company.industry_code,
  };
}

async function resolveWebsiteScan(
  company: Company,
  userId: string,
  existingScan?: WebsiteScanResult
): Promise<{ scan?: WebsiteScanResult; liveScanRan: boolean }> {
  if (existingScan) return { scan: existingScan, liveScanRan: false };

  const cached = await loadCachedWebsiteScans([company.orgnr]).catch(
    () => [] as WebsiteScanResult[]
  );
  if (cached[0]) return { scan: cached[0], liveScanRan: false };

  const useDemo = isDemoMode() && !hasAnyWebsiteScanProvider();
  try {
    const scan = await scanCompanyWebsite(toScanInput(company), {
      demo: useDemo,
      social: DEFAULT_SCAN_SOCIAL_OPTIONS,
      userId,
    });
    if (!useDemo) {
      void persistCachedWebsiteScans([scan], userId);
    }
    return { scan, liveScanRan: true };
  } catch (err) {
    console.warn("[smartliste/research] live scan:", err);
    return { scan: undefined, liveScanRan: false };
  }
}

function pickLeader(roles: BrregRolePerson[]): string | null {
  const priority = roles.find((r) => /daglig leder/i.test(r.role));
  if (priority) return priority.name;
  const innehaver = roles.find((r) => /innehaver/i.test(r.role));
  if (innehaver) return innehaver.name;
  const leder = roles.find((r) => /styrets leder|leder/i.test(r.role));
  if (leder) return leder.name;
  return roles[0]?.name ?? null;
}

function scanResearchLines(scan: WebsiteScanResult): string[] {
  const lines: string[] = [];
  if (scan.websiteUrl) {
    lines.push(`Funnet nettside: ${scan.websiteUrl} (${scan.websiteKind}, kilde: ${scan.source})`);
  } else if (scan.hasWebsite === false) {
    lines.push("Google/Serp-sjekk: ingen tydelig egen nettside funnet");
  }
  if (scan.bookingPlatform) {
    lines.push(`Booking/katalog: ${scan.bookingPlatform}`);
  }
  if (scan.facebookUrl) {
    lines.push(`Facebook: ${scan.facebookUrl}`);
    if (scan.facebookProfile?.intro) {
      lines.push(`Facebook-intro: ${scan.facebookProfile.intro.slice(0, 280)}`);
    }
    if (scan.facebookProfile?.category) {
      lines.push(`Facebook-kategori: ${scan.facebookProfile.category}`);
    }
  }
  if (scan.instagramUrl) {
    lines.push(`Instagram: ${scan.instagramUrl}`);
    if (scan.instagramProfile?.biography) {
      lines.push(`Instagram-bio: ${scan.instagramProfile.biography.slice(0, 220)}`);
    }
  }
  if (scan.linkedinUrl) lines.push(`LinkedIn: ${scan.linkedinUrl}`);
  if (scan.enrichedPhone) {
    lines.push(`Beriket telefon fra ${scan.enrichedPhoneSource ?? "skann"}: ${scan.enrichedPhone}`);
  }
  if (scan.topHits?.length) {
    for (const hit of scan.topHits.slice(0, 3)) {
      lines.push(`Søketreff: ${hit.title} — ${hit.link}`);
    }
  }
  return lines;
}

function webHitLines(hits: SearchHit[]): string[] {
  return hits.slice(0, 6).map((hit, i) => {
    const snippet = hit.snippet?.trim();
    return snippet
      ? `Web ${i + 1}: ${hit.title} — ${snippet.slice(0, 200)} (${hit.link})`
      : `Web ${i + 1}: ${hit.title} (${hit.link})`;
  });
}

function roleLines(roles: BrregRolePerson[]): string[] {
  if (roles.length === 0) return ["Brreg roller: ingen roller funnet"];
  return roles.slice(0, 6).map((r) => `${r.role}: ${r.name}`);
}

export async function researchCompanyForSummary(
  company: Company,
  userId: string,
  existingScan?: WebsiteScanResult
): Promise<CompanyResearchBundle> {
  const sources: string[] = [];
  const researchLines: string[] = [];

  const [enhet, roles, scanResult] = await Promise.all([
    fetchEnhet(company.orgnr).catch(() => null),
    fetchBrregRolePersons(company.orgnr).catch(() => [] as BrregRolePerson[]),
    resolveWebsiteScan(company, userId, existingScan),
  ]);

  const scan = scanResult.scan;
  const liveScanRan = scanResult.liveScanRan;
  if (liveScanRan) sources.push("Live web-skanning");
  if (enhet) {
    sources.push("Brreg enhetsregisteret");
    if (enhet.naeringskode1?.beskrivelse) {
      researchLines.push(`Brreg bransje: ${enhet.naeringskode1.beskrivelse} (${enhet.naeringskode1.kode ?? ""})`);
    }
    if (enhet.registreringsdatoEnhetsregisteret) {
      researchLines.push(`Brreg registrert: ${enhet.registreringsdatoEnhetsregisteret}`);
    }
    if (enhet.hjemmeside) {
      researchLines.push(`Brreg hjemmeside: ${enhet.hjemmeside}`);
    }
  }

  if (roles.length > 0) {
    sources.push("Brreg roller");
    researchLines.push(...roleLines(roles));
  }

  if (scan) {
    sources.push("Web-skanning (cache)");
    researchLines.push(...scanResearchLines(scan));
  }

  const phoneResult = await resolveAnalysisPhone(company, { enhet, scan });
  if (phoneResult.researchLine) {
    researchLines.push(phoneResult.researchLine);
    sources.push("Telefon-oppslag (1881/Gulesider/nett)");
  }

  const enrichedCompany: Company = {
    ...phoneResult.company,
    industry_description:
      enhet?.naeringskode1?.beskrivelse ??
      company.industry_description ??
      null,
    registered_at: enhet?.registreringsdatoEnhetsregisteret ?? company.registered_at,
    website: enhet?.hjemmeside ?? company.website,
    daglig_leder: pickLeader(roles) ?? company.daglig_leder,
  };

  const facts = buildCompanyFacts(enrichedCompany, scan);

  let webHits: SearchHit[] = scan?.topHits?.length ? [...scan.topHits] : [];
  const place = company.municipality_name ?? company.city ?? "";
  const scanInput = toScanInput(company);

  try {
    const websiteSearch = await searchSerperForWebsite(scanInput, {
      userId,
      maxQueries: 2,
    });
    if (websiteSearch.hits.length > 0) {
      webHits = [...webHits, ...websiteSearch.hits];
      sources.push("Google nettside-søk");
    }
  } catch (err) {
    console.warn("[smartliste/research] serper website:", err);
  }

  const extraQueries = [
    `"${company.name}" ${place}`.trim(),
    `${company.name} ${facts.industry}`.trim(),
    buildWebsiteSearchQueries(scanInput)[0],
    scan?.facebookUrl ? `site:facebook.com "${company.name}"` : null,
  ].filter((q): q is string => Boolean(q && q.length > 3));

  const seenQueries = new Set<string>();
  for (const query of extraQueries) {
    const key = query.toLowerCase();
    if (seenQueries.has(key)) continue;
    seenQueries.add(key);
    try {
      const hits = await searchSerper(query, { num: 5, userId });
      if (hits.length > 0) {
        webHits = [...webHits, ...hits];
        sources.push(`Google-søk`);
      }
    } catch (err) {
      console.warn("[smartliste/research] serper:", err);
    }
    if (webHits.length >= 10) break;
  }

  const dedupedHits = new Map<string, SearchHit>();
  for (const hit of webHits) {
    if (!dedupedHits.has(hit.link)) dedupedHits.set(hit.link, hit);
  }
  webHits = [...dedupedHits.values()].slice(0, 10);

  if (webHits.length > 0) {
    researchLines.push(...webHitLines(webHits));
  }

  return {
    facts,
    roles,
    scan,
    webHits,
    brregIndustry: enhet?.naeringskode1?.beskrivelse ?? null,
    brregRegistered: enhet?.registreringsdatoEnhetsregisteret ?? null,
    brregWebsite: enhet?.hjemmeside ?? null,
    researchLines,
    sources: [...new Set(sources)],
    liveScanRan,
    phonePatch: phoneResult.patch,
  };
}

export function researchToPromptBlock(bundle: CompanyResearchBundle): string {
  const parts = [
    "=== GRUNNDATA ===",
    factsToPromptBlock(bundle.facts),
    "",
    "=== RESEARCH (bruk dette aktivt — ikke finn på) ===",
  ];

  if (bundle.researchLines.length === 0) {
    parts.push("Begrenset research tilgjengelig.");
  } else {
    parts.push(...bundle.researchLines.map((l) => `- ${l}`));
  }

  parts.push("", `Kilder brukt: ${bundle.sources.join(", ") || "kun Brreg/database"}`);
  return parts.join("\n");
}
