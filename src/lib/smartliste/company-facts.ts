import { hasOwnWebsite, isLeadWithoutOwnSite } from "@/lib/agent/website-presence";
import { hasStoredWebsite } from "@/lib/agent/website-sales-leads";
import { hasCompanyPhone } from "@/lib/brreg/lead-quality";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import type { Company } from "@/types/database";
import { formatRegisteredDate } from "@/lib/utils";

export type SmartListCompanyFacts = {
  orgnr: string;
  name: string;
  established: string | null;
  establishedLabel: string;
  industry: string;
  industryCode: string | null;
  dagligLeder: string | null;
  municipality: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  websiteStatus: string;
  hasPhone: boolean;
  hasEmail: boolean;
};

function resolveIndustry(company: Company): string {
  if (company.industry_description?.trim()) return company.industry_description.trim();
  if (company.industry_code?.trim()) return company.industry_code.trim();
  return "Ukjent bransje";
}

function resolveDagligLeder(company: Company): string | null {
  const fromCompany = company.daglig_leder?.trim();
  if (fromCompany) return fromCompany;
  const fromOverride = company.contact_override?.owner_name?.trim();
  if (fromOverride) return fromOverride;
  return null;
}

function resolveWebsiteStatus(company: Company, scan?: WebsiteScanResult): string {
  if (scan && hasOwnWebsite(scan)) return "Har egen nettside";
  if (scan && isLeadWithoutOwnSite(scan)) return "Ingen egen nettside (Google-sjekk)";
  if (hasStoredWebsite(company.website)) return "Har nettside registrert i Brreg";
  if (company.website?.trim()) return "Har nettside registrert i Brreg";
  if (!scan) return "Web-status ukjent (ikke skannet)";
  return "Ukjent web-status";
}

export function buildCompanyFacts(
  company: Company,
  scan?: WebsiteScanResult
): SmartListCompanyFacts {
  const phone = (company.mobile ?? company.phone)?.trim() || null;
  return {
    orgnr: company.orgnr,
    name: company.name,
    established: company.registered_at,
    establishedLabel: company.registered_at
      ? formatRegisteredDate(company.registered_at)
      : "Ukjent",
    industry: resolveIndustry(company),
    industryCode: company.industry_code,
    dagligLeder: resolveDagligLeder(company),
    municipality: company.municipality_name ?? company.city,
    phone,
    email: company.email,
    website: company.website,
    websiteStatus: resolveWebsiteStatus(company, scan),
    hasPhone: hasCompanyPhone(company),
    hasEmail: Boolean(company.email?.trim()),
  };
}

export function factsToPromptBlock(facts: SmartListCompanyFacts): string {
  return [
    `Firma: ${facts.name} (${facts.orgnr})`,
    `Etablert: ${facts.establishedLabel}`,
    `Bransje: ${facts.industry}`,
    `Daglig leder: ${facts.dagligLeder ?? "Ikke funnet"}`,
    `Sted: ${facts.municipality ?? "—"}`,
    `Telefon: ${facts.phone ?? "Mangler"}`,
    `E-post: ${facts.email ?? "Mangler"}`,
    `Nettside: ${facts.websiteStatus}`,
  ].join("\n");
}
