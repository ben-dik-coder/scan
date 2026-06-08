import {
  loadContactOverrides,
  loadDbContactPatches,
  mergeContactOverride,
} from "@/lib/company-contact-overrides";
import { computeLeadScore } from "@/lib/sales/lead-score";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchEnhet } from "@/lib/brreg/client";
import { mapBrregEnhet, type CompanyInsert } from "@/lib/brreg/map-company";
import { shouldUseBrregDb } from "@/lib/brreg/db-source";
import type { Company, CompanyWithLead, UserLead } from "@/types/database";

function toCompanyWithLead(company: Company, userLead?: UserLead | null): CompanyWithLead {
  const score = userLead?.score ?? computeLeadScore(company);
  return {
    ...company,
    user_lead:
      userLead ??
      ({
        user_id: "by-orgnr",
        orgnr: company.orgnr,
        status: "ny",
        score,
        notes: null,
        last_contacted_at: null,
        next_follow_up_at: null,
        queued_at: null,
        created_at: company.created_at,
        updated_at: company.updated_at,
      } as UserLead),
  };
}

async function loadCompaniesFromDb(orgnrs: string[]): Promise<Company[]> {
  if (orgnrs.length === 0) return [];
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("companies").select("*").in("orgnr", orgnrs);
  if (error) throw new Error(error.message);
  const byOrgnr = new Map((data ?? []).map((c) => [(c as Company).orgnr, c as Company]));
  return orgnrs.map((orgnr) => byOrgnr.get(orgnr)).filter(Boolean) as Company[];
}

async function loadCompaniesFromBrreg(orgnrs: string[]): Promise<Company[]> {
  const companies: Company[] = [];
  const now = new Date().toISOString();
  for (const orgnr of orgnrs) {
    const enhet = await fetchEnhet(orgnr);
    if (!enhet) continue;
    const row = mapBrregEnhet(enhet);
    companies.push(toCompany(row, now));
  }
  return companies;
}

function toCompany(row: CompanyInsert, now: string): Company {
  return {
    ...row,
    daglig_leder: null,
    created_at: now,
    updated_at: now,
  };
}

export async function fetchCompaniesByOrgnrs(
  orgnrs: string[],
  userId?: string
): Promise<CompanyWithLead[]> {
  const uniqueOrgnrs = Array.from(
    new Set(orgnrs.map((orgnr) => orgnr.trim()).filter(Boolean))
  );
  if (uniqueOrgnrs.length === 0) return [];

  const useDb = await shouldUseBrregDb();
  let companies = useDb
    ? await loadCompaniesFromDb(uniqueOrgnrs)
    : await loadCompaniesFromBrreg(uniqueOrgnrs);

  const [overrideMap, dbPatchMap] = await Promise.all([
    loadContactOverrides(companies.map((c) => c.orgnr)),
    loadDbContactPatches(companies.map((c) => c.orgnr)),
  ]);

  companies = companies.map((company) => {
    const brregMissingContact =
      !(company.mobile ?? "").trim() && !(company.phone ?? "").trim();
    const override =
      overrideMap.get(company.orgnr) ??
      (brregMissingContact ? dbPatchMap.get(company.orgnr) : undefined);
    return mergeContactOverride(company, override);
  });

  let leadMap = new Map<string, UserLead>();
  if (userId) {
    const supabase = createServiceClient();
    const { data: leads } = await supabase
      .from("user_leads")
      .select("*")
      .eq("user_id", userId)
      .in("orgnr", companies.map((c) => c.orgnr));
    leadMap = new Map((leads ?? []).map((lead) => [lead.orgnr, lead as UserLead]));
  }

  const byOrgnr = new Map(
    companies.map((company) => [
      company.orgnr,
      toCompanyWithLead(company, leadMap.get(company.orgnr)),
    ])
  );

  return uniqueOrgnrs
    .map((orgnr) => byOrgnr.get(orgnr))
    .filter(Boolean) as CompanyWithLead[];
}
