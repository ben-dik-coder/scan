import type { Company } from "@/types/database";

/** Kontaktinfo brukt på tvers av ring, SMS og kø. */
export type CompanyContact = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  dagligLeder: string | null;
  municipalityName: string | null;
  registeredAt: string | null;
};

export function companyToContact(company: Company): CompanyContact {
  return {
    orgnr: company.orgnr,
    name: company.name,
    email: company.email,
    phone: company.mobile ?? company.phone,
    dagligLeder: company.daglig_leder,
    municipalityName: company.municipality_name,
    registeredAt: company.registered_at,
  };
}
