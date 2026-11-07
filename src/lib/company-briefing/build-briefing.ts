import { matchesIndustryGroup } from "@/lib/constants/industries";
import { naceCodeLabel } from "@/lib/constants/nace-codes";
import {
  VERTICAL_MATCH_ORDER,
  VERTICAL_PROFILES,
} from "@/lib/company-briefing/profiles";
import type {
  CompanyBriefing,
  CompanyBriefingItem,
} from "@/lib/company-briefing/types";
import type { WebsiteScanResult } from "@/lib/website-scan/types";

export type BriefingCompanyInput = {
  name: string;
  industry_code?: string | null;
  industry_description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  has_email?: boolean;
};

function resolveNaceLabel(code: string | null | undefined): string | null {
  const raw = (code ?? "").trim();
  if (!raw) return null;
  const direct = naceCodeLabel(raw);
  if (direct) return direct;

  // Prøv kortere klasser: 56.110 → 56.11 → 56.10
  const noExtra = raw.replace(/(\.\d{2})\d+$/, "$1");
  if (noExtra !== raw) {
    const hit = naceCodeLabel(noExtra);
    if (hit) return hit;
  }
  if (/^\d{2}\.\d{3}/.test(raw)) {
    const four = `${raw.slice(0, 2)}.${raw.slice(3, 5)}`;
    const hit = naceCodeLabel(four);
    if (hit) return hit;
  }
  return null;
}

export function resolveCompanyVerticalId(company: BriefingCompanyInput): string {
  const ctx = {
    name: company.name,
    industryDescription: company.industry_description,
  };
  for (const id of VERTICAL_MATCH_ORDER) {
    if (matchesIndustryGroup(company.industry_code, id, ctx)) {
      return id;
    }
  }
  return "generic";
}

function factItems(
  company: BriefingCompanyInput,
  scan?: WebsiteScanResult | null
): CompanyBriefingItem[] {
  const hasWebsiteFact =
    scan != null
      ? scan.hasWebsite && scan.websiteKind !== "none"
      : Boolean(company.website?.trim());

  const websiteUnknown = scan == null && !company.website?.trim();
  const phone =
    Boolean(company.mobile?.trim() || company.phone?.trim()) ||
    Boolean(scan?.enrichedPhone?.trim()) ||
    Boolean(scan?.facebookProfile?.phone) ||
    Boolean(scan?.platformContacts?.some((c) => c.phone));

  const email =
    Boolean(company.email?.trim()) ||
    Boolean(company.has_email) ||
    Boolean(scan?.enrichedEmail?.trim()) ||
    Boolean(scan?.facebookProfile?.email) ||
    Boolean(scan?.platformContacts?.some((c) => c.email));

  const fb =
    scan == null
      ? ("unknown" as const)
      : scan.facebookUrl
        ? ("ok" as const)
        : scan.socialScan?.includeFacebook
          ? ("missing" as const)
          : ("unknown" as const);

  const ig =
    scan == null
      ? ("unknown" as const)
      : scan.instagramUrl
        ? ("ok" as const)
        : scan.socialScan?.includeInstagram
          ? ("missing" as const)
          : ("unknown" as const);

  const gulesider =
    scan == null
      ? ("unknown" as const)
      : scan.gulesiderListed
        ? ("ok" as const)
        : scan.gulesiderListed === false
          ? ("missing" as const)
          : ("unknown" as const);

  const items: CompanyBriefingItem[] = [
    {
      id: "website",
      label: "Egen nettside",
      status: websiteUnknown ? "unknown" : hasWebsiteFact ? "ok" : "missing",
      why: hasWebsiteFact
        ? "De har noe online — sjekk om den faktisk selger."
        : "Uten nettside er det vanskelig å bli funnet og stol på.",
    },
    {
      id: "phone",
      label: "Telefonnummer",
      status: phone ? "ok" : "missing",
      why: "Uten telefon stopper mange salgssamtaler før de starter.",
    },
    {
      id: "email",
      label: "E-post",
      status: email ? "ok" : "missing",
      why: "Trengs for oppfølging, tilbud og sekvenser.",
    },
    {
      id: "facebook",
      label: "Facebook-side",
      status: fb,
      why: "Mange lokale kunder sjekker FB før de tar kontakt.",
    },
    {
      id: "instagram",
      label: "Instagram",
      status: ig,
      why: "Sterkt i visuelle bransjer (salong, mat, design).",
    },
    {
      id: "gulesider",
      label: "Gulesider",
      status: gulesider,
      why: "Ekstra lokal synlighet og tillitssignal.",
    },
  ];

  if (scan?.websiteKind === "booking_only") {
    items.unshift({
      id: "booking_only",
      label: "Kun booking-plattform (ikke egen side)",
      status: "tip",
      why: "De har timebestilling, men mangler ofte egen merkevareside.",
    });
  }

  return items;
}

function buildHeadline(
  verticalLabel: string,
  naceLabel: string | null,
  industryDescription: string | null | undefined
): string {
  const desc = (industryDescription ?? "").trim();
  if (desc) return desc;
  if (naceLabel) return naceLabel;
  return verticalLabel;
}

function buildSummary(
  verticalId: string,
  company: BriefingCompanyInput,
  naceLabel: string | null
): string {
  const profile = VERTICAL_PROFILES[verticalId] ?? VERTICAL_PROFILES.generic!;
  const placeHint = ""; // hold kort — sted vises allerede i UI
  const naceBit = naceLabel ? ` Brreg sier: «${naceLabel}».` : "";
  const desc = (company.industry_description ?? "").trim();
  if (desc && desc.toLowerCase() !== naceLabel?.toLowerCase()) {
    return `${profile.does}${placeHint} Næringsbeskrivelse: ${desc}.`;
  }
  return `${profile.does}${naceBit}`;
}

/**
 * Bygger «hva driver de med» + sjekkliste for ett firma.
 * Bruker Brreg-bransje + (valgfritt) skann-fakta — ingen LLM.
 */
export function buildCompanyBriefing(
  company: BriefingCompanyInput,
  scan?: WebsiteScanResult | null
): CompanyBriefing {
  const verticalId = resolveCompanyVerticalId(company);
  const profile = VERTICAL_PROFILES[verticalId] ?? VERTICAL_PROFILES.generic!;
  const naceCode = company.industry_code?.trim() || null;
  const naceLabel =
    resolveNaceLabel(naceCode) ??
    (company.industry_description?.trim() || null);

  const facts = factItems(company, scan);
  const tips: CompanyBriefingItem[] = profile.tipNeeds.map((t) => ({
    id: `tip-${t.id}`,
    label: t.label,
    status: "tip" as const,
    why: t.why,
  }));

  // Vis mangler først, deretter ukjent, ok, så bransjetips
  const checklist = [
    ...facts.filter((f) => f.status === "missing"),
    ...facts.filter((f) => f.status === "unknown"),
    ...facts.filter((f) => f.status === "ok"),
    ...tips,
  ];

  return {
    verticalId: profile.id,
    verticalLabel: profile.label,
    headline: buildHeadline(profile.label, naceLabel, company.industry_description),
    summary: buildSummary(profile.id, company, naceLabel),
    naceCode,
    naceLabel,
    checklist,
  };
}
