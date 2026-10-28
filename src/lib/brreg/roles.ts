import type { CompanyInsert } from "./map-company";

const BRREG_ROLES_URL =
  "https://data.brreg.no/enhetsregisteret/api/enheter";

type BrregName =
  | string
  | {
      fornavn?: string;
      mellomnavn?: string;
      etternavn?: string;
    };

type BrregRolePerson = {
  navn?: BrregName;
  fornavn?: string;
  mellomnavn?: string;
  etternavn?: string;
};

type BrregRoleGroup = {
  type?: { kode?: string; beskrivelse?: string };
  roller?: Array<{
    avregistrert?: boolean;
    type?: { kode?: string; beskrivelse?: string };
    person?: BrregRolePerson;
  }>;
};

type BrregRolesResponse = {
  /** Nytt Brreg-format */
  rollegrupper?: BrregRoleGroup[];
  /** Eldre HAL-format (fallback) */
  _embedded?: { roller?: BrregRoleGroup[] };
};

const LEADER_CODES = new Set(["DAGL", "LEDE", "INNH"]);

function formatPersonName(person: BrregRolePerson): string | null {
  const navn = person.navn;
  if (typeof navn === "string" && navn.trim()) return navn.trim();
  if (navn && typeof navn === "object") {
    const parts = [navn.fornavn, navn.mellomnavn, navn.etternavn]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (parts) return parts;
  }
  const parts = [person.fornavn, person.mellomnavn, person.etternavn]
    .filter(Boolean)
    .join(" ")
    .trim();
  return parts || null;
}

function roleGroups(data: BrregRolesResponse): BrregRoleGroup[] {
  return data.rollegrupper ?? data._embedded?.roller ?? [];
}

/** Henter daglig leder / innehaver fra Brreg roller-API */
export async function fetchDagligLeder(orgnr: string): Promise<string | null> {
  const res = await fetch(`${BRREG_ROLES_URL}/${orgnr}/roller`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as BrregRolesResponse;
  const groups = roleGroups(data);

  for (const group of groups) {
    const groupCode = group.type?.kode ?? "";
    for (const role of group.roller ?? []) {
      if (role.avregistrert) continue;
      const roleCode = role.type?.kode ?? "";
      if (!LEADER_CODES.has(groupCode) && !LEADER_CODES.has(roleCode)) continue;
      if (!role.person) continue;
      const name = formatPersonName(role.person);
      if (name) return name;
    }
  }

  // Fallback: første aktive personrolle (hopper over regnskapsfører-enheter o.l.)
  for (const group of groups) {
    for (const role of group.roller ?? []) {
      if (role.avregistrert || !role.person) continue;
      const name = formatPersonName(role.person);
      if (name) return name;
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
