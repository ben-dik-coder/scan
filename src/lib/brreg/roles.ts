import type { CompanyInsert } from "./map-company";

const BRREG_ROLES_URL =
  "https://data.brreg.no/enhetsregisteret/api/enheter";

type BrregRolePerson = {
  navn?: string;
  fornavn?: string;
  mellomnavn?: string;
  etternavn?: string;
};

type BrregRoleGroup = {
  type?: { kode?: string; beskrivelse?: string };
  roller?: Array<{
    type?: { kode?: string; beskrivelse?: string };
    person?: BrregRolePerson;
    enhet?: { organisasjonsnummer?: string; navn?: string };
  }>;
};

type BrregRolesResponse = {
  _embedded?: { roller?: BrregRoleGroup[] };
};

function formatPersonName(person: BrregRolePerson): string | null {
  if (person.navn?.trim()) return person.navn.trim();
  const parts = [person.fornavn, person.mellomnavn, person.etternavn]
    .filter(Boolean)
    .join(" ")
    .trim();
  return parts || null;
}

/** Henter daglig leder / CEO fra Brreg roller-API */
export async function fetchDagligLeder(orgnr: string): Promise<string | null> {
  const res = await fetch(`${BRREG_ROLES_URL}/${orgnr}/roller`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as BrregRolesResponse;
  const groups = data._embedded?.roller ?? [];

  for (const group of groups) {
    const groupCode = group.type?.kode ?? "";
    if (groupCode !== "DAGL" && groupCode !== "LEDE") continue;

    for (const role of group.roller ?? []) {
      const roleCode = role.type?.kode ?? "";
      if (roleCode !== "DAGL" && roleCode !== "LEDE") continue;
      if (role.person) {
        const name = formatPersonName(role.person);
        if (name) return name;
      }
    }
  }

  for (const group of groups) {
    for (const role of group.roller ?? []) {
      if (role.person) {
        const name = formatPersonName(role.person);
        if (name) return name;
      }
    }
  }

  return null;
}

const ROLES_DELAY_MS = 120;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Henter daglig leder for firma med e-post (rate-limit vennlig). */
export async function enrichWithDagligLeder(
  company: CompanyInsert,
  existing?: string | null
): Promise<CompanyInsert> {
  if (existing?.trim()) {
    return { ...company, daglig_leder: existing.trim() };
  }
  if (!company.has_email) return company;

  const name = await fetchDagligLeder(company.orgnr);
  await sleep(ROLES_DELAY_MS);
  return name ? { ...company, daglig_leder: name } : company;
}
