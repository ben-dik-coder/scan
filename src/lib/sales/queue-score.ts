import type { Company, UserLead } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { computeLeadScore } from "@/lib/sales/lead-score";
import { resolveCompanyEmail } from "@/lib/website-scan/resolve-company-email";

export type QueueItemResponse = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  municipalityName: string | null;
  registeredAt: string | null;
  status: string;
  queueScore: number;
  daysSinceRegistration: number | null;
  hasWebsite: boolean | null;
  websiteKind: string | null;
  dagligLeder: string | null;
};

export type QueueCandidate = {
  company: Company;
  lead: UserLead | null;
  scan: WebsiteScanResult | null;
  queueScore: number;
  daysSinceRegistration: number | null;
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const registered = new Date(dateStr);
  if (Number.isNaN(registered.getTime())) return null;
  return Math.floor((Date.now() - registered.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeQueueScore(
  company: Company,
  lead: UserLead | null,
  scan: WebsiteScanResult | null
): number {
  let score = lead?.score ?? computeLeadScore(company);

  const days = daysSince(company.registered_at);
  if (days != null) {
    if (days <= 3) score += 20;
    else if (days <= 7) score += 15;
    else if (days <= 14) score += 8;
    else if (days <= 30) score += 3;
  }

  if (company.phone || company.mobile) score += 12;

  if (scan) {
    if (!scan.hasWebsite && scan.websiteKind === "none") score += 18;
    else if (!scan.hasWebsite) score += 10;
    if (scan.gulesiderListed && !scan.hasWebsite) score += 6;
    if (scan.facebookUrl) score += 4;
    if (!scan.facebookUrl && scan.socialScan?.includeFacebook) score += 2;
    if (scan.linkedinUrl && !scan.hasWebsite && scan.websiteKind === "none") {
      score += 6;
      if (scan.facebookUrl) score += 3;
    }
    if (scan.linkedinFromWebsite) score += 2;
  } else if (company.has_email) {
    score += 5;
  }

  const status = lead?.status ?? "ny";
  if (status === "ny") score += 10;
  if (!lead?.last_contacted_at) score += 8;

  return Math.min(150, Math.round(score));
}

export function buildQueueCandidates(
  companies: Company[],
  leadsByOrgnr: Map<string, UserLead>,
  scansByOrgnr: Map<string, WebsiteScanResult>
): QueueCandidate[] {
  return companies
    .map((company) => {
      const lead = leadsByOrgnr.get(company.orgnr) ?? null;
      const scan = scansByOrgnr.get(company.orgnr) ?? null;
      return {
        company,
        lead,
        scan,
        queueScore: computeQueueScore(company, lead, scan),
        daysSinceRegistration: daysSince(company.registered_at),
      };
    })
    .filter((c) => {
      if (!c.lead?.queued_at) return false;
      const status = c.lead.status;
      return status === "ny" || status === "kontaktet";
    })
    .sort((a, b) => b.queueScore - a.queueScore);
}

export function mapQueueCandidatesToItems(
  candidates: QueueCandidate[]
): QueueItemResponse[] {
  return candidates.map((item) => {
    const resolved = resolveCompanyEmail(item.company, item.scan);
    return {
      orgnr: item.company.orgnr,
      name: item.company.name,
      email: resolved?.email ?? item.company.email,
      phone: item.company.phone ?? item.company.mobile,
      municipalityName: item.company.municipality_name,
      registeredAt: item.company.registered_at,
      status: item.lead?.status ?? "ny",
      queueScore: item.queueScore,
      daysSinceRegistration: item.daysSinceRegistration,
      hasWebsite: item.scan?.hasWebsite ?? null,
      websiteKind: item.scan?.websiteKind ?? null,
      dagligLeder: item.company.daglig_leder,
    };
  });
}
