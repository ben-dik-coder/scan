import type { BrregEnhet } from "@/lib/brreg/client";
import { hasCompanyPhone } from "@/lib/brreg/lead-quality";
import { mapBrregEnhet } from "@/lib/brreg/map-company";
import { lookupFreeContact } from "@/lib/website-scan/lookup-directory-contact";
import { phoneCoreDigits } from "@/lib/website-scan/phone-plausible";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import type { Company } from "@/types/database";

function storePhone(value: string): Partial<Pick<Company, "phone" | "mobile">> {
  const core = phoneCoreDigits(value);
  if (!core || core.length !== 8) return {};
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  if (core.startsWith("7") || core.startsWith("2") || core.startsWith("3")) {
    return { phone: core };
  }
  return { mobile: core };
}

function diffPhonePatch(
  before: Company,
  after: Company
): Partial<Pick<Company, "phone" | "mobile">> | null {
  if (hasCompanyPhone(before)) return null;
  if (!hasCompanyPhone(after)) return null;
  const patch: Partial<Pick<Company, "phone" | "mobile">> = {};
  if ((after.mobile ?? "").trim() && !(before.mobile ?? "").trim()) {
    patch.mobile = after.mobile;
  }
  if ((after.phone ?? "").trim() && !(before.phone ?? "").trim()) {
    patch.phone = after.phone;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export type AnalysisPhoneResult = {
  company: Company;
  patch: Partial<Pick<Company, "phone" | "mobile">> | null;
  /** Ekstra research-linje (kun for nye oppslag utenom web-skanning). */
  researchLine: string | null;
};

/** Prøv Brreg, web-skanning og gratis kataloger — uten Serper. */
export async function resolveAnalysisPhone(
  company: Company,
  options?: {
    enhet?: BrregEnhet | null;
    scan?: WebsiteScanResult;
  }
): Promise<AnalysisPhoneResult> {
  let working: Company = { ...company };

  if (options?.enhet && !hasCompanyPhone(working)) {
    const mapped = mapBrregEnhet(options.enhet);
    if ((mapped.mobile ?? "").trim()) {
      working = { ...working, mobile: mapped.mobile };
    } else if ((mapped.phone ?? "").trim()) {
      working = { ...working, phone: mapped.phone };
    }
  }

  if (hasCompanyPhone(working)) {
    return {
      company: working,
      patch: diffPhonePatch(company, working),
      researchLine: null,
    };
  }

  const scan = options?.scan;
  if (scan?.enrichedPhone) {
    const stored = storePhone(scan.enrichedPhone);
    if (stored.mobile || stored.phone) {
      working = { ...working, ...stored };
      return {
        company: working,
        patch: diffPhonePatch(company, working),
        researchLine: null,
      };
    }
  }

  const hit = await lookupFreeContact({
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    website: company.website ?? options?.enhet?.hjemmeside ?? null,
    municipality_name: company.municipality_name,
    city: company.city,
    industry_code: company.industry_code,
  }).catch(() => null);

  if (hit?.phone) {
    const stored = storePhone(hit.phone);
    if (stored.mobile || stored.phone) {
      working = { ...working, ...stored };
      return {
        company: working,
        patch: diffPhonePatch(company, working),
        researchLine: `Beriket telefon fra ${hit.source}: ${hit.phone}`,
      };
    }
  }

  return { company: working, patch: null, researchLine: null };
}
