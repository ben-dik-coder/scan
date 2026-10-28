import {
  getPlausibleCompanyPhone,
  hasCompanyPhone,
  isSoleProprietorOrPerson,
  isWeakWebsiteSalesLead,
} from "@/lib/brreg/lead-quality";
import { fetchDagligLeder } from "@/lib/brreg/roles";
import { normalizeSmsPhone } from "@/lib/sms/normalize-phone";
import { resolveAnalysisPhone } from "@/lib/smartliste/resolve-analysis-phone";
import type { Company } from "@/types/database";

export type ResolvedAiCallTarget = {
  company: Company;
  phoneRaw: string;
  phoneE164: string;
  contactName: string | null;
  skippedReason: string | null;
};

export async function resolveAiCallTarget(
  company: Company,
  options?: { allowEnk?: boolean }
): Promise<ResolvedAiCallTarget> {
  let working: Company = { ...company };

  if (isWeakWebsiteSalesLead(working) && !hasCompanyPhone(working)) {
    return {
      company: working,
      phoneRaw: "",
      phoneE164: "",
      contactName: working.daglig_leder,
      skippedReason: "Lead er filtrert bort (svak / uten telefon)",
    };
  }

  if (!options?.allowEnk && isSoleProprietorOrPerson(working)) {
    return {
      company: working,
      phoneRaw: "",
      phoneE164: "",
      contactName: working.daglig_leder,
      skippedReason: "MVP ringer bare AS/selskap (ikke ENK/person)",
    };
  }

  if (!hasCompanyPhone(working)) {
    const enriched = await resolveAnalysisPhone(working);
    working = enriched.company;
  }

  if (!(working.daglig_leder ?? "").trim()) {
    const leder = await fetchDagligLeder(working.orgnr).catch(() => null);
    if (leder) working = { ...working, daglig_leder: leder };
  }

  const phoneRaw = getPlausibleCompanyPhone(working);
  if (!phoneRaw) {
    return {
      company: working,
      phoneRaw: "",
      phoneE164: "",
      contactName: working.daglig_leder,
      skippedReason: "Fant ikke gyldig telefonnummer",
    };
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizeSmsPhone(phoneRaw);
  } catch {
    return {
      company: working,
      phoneRaw,
      phoneE164: "",
      contactName: working.daglig_leder,
      skippedReason: "Ugyldig telefonnummer",
    };
  }

  return {
    company: working,
    phoneRaw,
    phoneE164,
    contactName: working.daglig_leder,
    skippedReason: null,
  };
}
