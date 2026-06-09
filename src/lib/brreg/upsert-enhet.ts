import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrregEnhet } from "./client";
import { isGenericEmail, mapBrregEnhet, type CompanyInsert } from "./map-company";

export type ExistingContact = Pick<
  CompanyInsert,
  "email" | "phone" | "mobile" | "has_email" | "email_is_generic"
>;

function nonEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Keep DB email/phone/mobile when Brreg returns empty on refresh. */
export function preserveExistingContactFields(
  mapped: CompanyInsert,
  existing: Partial<ExistingContact> | null | undefined
): CompanyInsert {
  if (!existing) return mapped;

  const brregEmail = nonEmpty(mapped.email);
  const existingEmail = nonEmpty(existing.email);
  const email = brregEmail || existingEmail || null;

  const brregPhone = nonEmpty(mapped.phone);
  const existingPhone = nonEmpty(existing.phone);
  const phone = brregPhone || existingPhone || null;

  const brregMobile = nonEmpty(mapped.mobile);
  const existingMobile = nonEmpty(existing.mobile);
  const mobile = brregMobile || existingMobile || null;

  const usedExistingEmail = !brregEmail && Boolean(existingEmail);

  return {
    ...mapped,
    email,
    phone,
    mobile,
    has_email: usedExistingEmail
      ? Boolean(existing.has_email ?? true)
      : mapped.has_email,
    email_is_generic: usedExistingEmail
      ? Boolean(
          existing.email_is_generic ?? (email ? isGenericEmail(email) : false)
        )
      : mapped.email_is_generic,
  };
}

export async function upsertBrregEnhet(
  enhet: BrregEnhet,
  supabase: SupabaseClient
): Promise<void> {
  const mapped = mapBrregEnhet(enhet);
  const { data: existing } = await supabase
    .from("companies")
    .select("email, phone, mobile, has_email, email_is_generic")
    .eq("orgnr", mapped.orgnr)
    .maybeSingle();

  const merged = preserveExistingContactFields(mapped, existing ?? undefined);
  const { industry_description, ...row } = merged;
  void industry_description;
  const { error } = await supabase
    .from("companies")
    .upsert(row, { onConflict: "orgnr" });
  if (error) throw new Error(`Brreg upsert ${mapped.orgnr}: ${error.message}`);
}
