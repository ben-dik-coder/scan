import { createServiceClient } from "@/lib/supabase/service";

export type CompanyContactOverride = {
  orgnr: string;
  mobile: string | null;
  phone: string | null;
  owner_name: string | null;
  source: string | null;
  notes: string | null;
  updated_at: string;
};

export type CompanyContactOverrideInput = {
  orgnr: string;
  mobile?: string | null;
  phone?: string | null;
  owner_name?: string | null;
  source?: string | null;
  notes?: string | null;
};

export async function loadContactOverrides(
  orgnrs: string[]
): Promise<Map<string, CompanyContactOverride>> {
  const map = new Map<string, CompanyContactOverride>();
  if (orgnrs.length === 0) return map;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("company_contact_overrides")
    .select("*")
    .in("orgnr", orgnrs);

  if (error) {
    if (/company_contact_overrides/i.test(error.message)) return map;
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    map.set(row.orgnr, row as CompanyContactOverride);
  }
  return map;
}

/** DB-rader med manuelt oppdatert telefon/eier (når live Brreg mangler felt). */
export async function loadDbContactPatches(
  orgnrs: string[]
): Promise<Map<string, CompanyContactOverride>> {
  const map = new Map<string, CompanyContactOverride>();
  if (orgnrs.length === 0) return map;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("orgnr,mobile,phone,daglig_leder,updated_at")
    .in("orgnr", orgnrs);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const mobile = row.mobile?.trim() || null;
    const phone = row.phone?.trim() || null;
    const owner = row.daglig_leder?.trim() || null;
    if (!mobile && !phone && !owner) continue;
    map.set(row.orgnr, {
      orgnr: row.orgnr,
      mobile,
      phone,
      owner_name: owner,
      source: "manual",
      notes: null,
      updated_at: row.updated_at,
    });
  }
  return map;
}

export async function upsertContactOverride(
  input: CompanyContactOverrideInput
): Promise<CompanyContactOverride> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("company_contact_overrides")
    .upsert(
      {
        orgnr: input.orgnr,
        mobile: input.mobile ?? null,
        phone: input.phone ?? null,
        owner_name: input.owner_name ?? null,
        source: input.source ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "orgnr" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as CompanyContactOverride;
}

export function mergeContactOverride<
  T extends {
    orgnr: string;
    phone?: string | null;
    mobile?: string | null;
    daglig_leder?: string | null;
  },
>(
  company: T,
  override?: CompanyContactOverride | null
): T & {
  contact_override?: CompanyContactOverride | null;
} {
  if (!override) return { ...company, contact_override: null };
  return {
    ...company,
    mobile: (company.mobile ?? "").trim() ? company.mobile : override.mobile ?? company.mobile,
    phone: (company.phone ?? "").trim() ? company.phone : override.phone ?? company.phone,
    daglig_leder: company.daglig_leder ?? override.owner_name ?? null,
    contact_override: override,
  };
}

/** Lagrer telefon funnet under analyse — krever service role (RLS tillater ikke bruker-update). */
export async function persistCompanyPhonePatch(
  orgnr: string,
  patch: Partial<Pick<CompanyContactOverride, "phone" | "mobile">>
): Promise<void> {
  if (!(patch.phone ?? "").trim() && !(patch.mobile ?? "").trim()) return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("companies")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("orgnr", orgnr);

  if (error) throw new Error(error.message);
}
