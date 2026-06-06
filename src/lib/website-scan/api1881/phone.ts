import { primaryGeoPlace } from "@/lib/brreg/geo-place";
import {
  companyMatchesProfileName,
  companyMatchesResult,
  stripCompanySuffix,
} from "@/lib/website-scan/parse-results";
import {
  phoneCoreDigits,
  phonePlausibleForCompany,
  pickPlausiblePhone,
} from "@/lib/website-scan/phone-plausible";
import { api1881Get } from "./client";
import { hasApi1881 } from "./config";

export type Api1881ContactPoint = {
  type?: string;
  value?: string;
};

export type Api1881Contact = {
  type?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  organizationNumber?: string;
  contactPoints?: Api1881ContactPoint[];
};

function normalizeOrgnr(orgnr: string): string {
  return orgnr.replace(/\D/g, "");
}

export function extractPhonesFromApi1881Contact(
  contact: Api1881Contact
): string[] {
  const phones: string[] = [];
  for (const point of contact.contactPoints ?? []) {
    const type = point.type?.toLowerCase() ?? "";
    if (!/phone|mobil|telefon|fax/i.test(type)) continue;
    if (point.value?.trim()) phones.push(point.value.trim());
  }
  return phones;
}

export function api1881ContactMatchesCompany(
  contact: Api1881Contact,
  companyName: string,
  orgnr: string
): boolean {
  const targetOrgnr = normalizeOrgnr(orgnr);
  const contactOrgnr = contact.organizationNumber
    ? normalizeOrgnr(contact.organizationNumber)
    : "";

  if (contact.type === "Company") {
    if (contactOrgnr && contactOrgnr === targetOrgnr) return true;
    if (contact.name && companyMatchesProfileName(contact.name, companyName)) {
      return true;
    }
    return companyMatchesResult(contact.name ?? "", "", companyName);
  }

  const personName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.name?.trim() ||
    "";

  if (!personName) return false;
  return (
    companyMatchesProfileName(personName, companyName) ||
    companyMatchesResult(personName, "", companyName)
  );
}

function parseContacts(payload: Record<string, unknown> | null): Api1881Contact[] {
  if (!payload) return [];
  const raw = payload.contacts ?? payload.results ?? payload.items;
  if (!Array.isArray(raw)) return [];
  return raw as Api1881Contact[];
}

export async function lookupApi1881PhoneContacts(
  phone: string
): Promise<Api1881Contact[]> {
  const core = phoneCoreDigits(phone);
  if (!core) return [];

  const payload = await api1881Get(`lookup/phonenumber/${encodeURIComponent(core)}`);
  return parseContacts(payload);
}

export async function searchApi1881CompanyContacts(
  company: {
    name: string;
    municipality_name?: string | null;
    city?: string | null;
  },
  options?: { limit?: number }
): Promise<Api1881Contact[]> {
  const place = primaryGeoPlace(company) ?? company.municipality_name ?? company.city ?? "";
  const name = stripCompanySuffix(company.name).trim();
  const query = place ? `"${name}" ${place}` : name;
  const limit = options?.limit ?? 5;

  const payload = await api1881Get(
    `search/company?query=${encodeURIComponent(query)}&page=0&limit=${limit}`
  );
  return parseContacts(payload);
}

export async function verifyPhoneWithApi1881(
  phone: string,
  company: { name: string; orgnr: string }
): Promise<boolean> {
  if (!hasApi1881()) return true;

  const contacts = await lookupApi1881PhoneContacts(phone);
  if (contacts.length === 0) return false;

  return contacts.some((contact) =>
    api1881ContactMatchesCompany(contact, company.name, company.orgnr)
  );
}

export async function discoverPhoneWithApi1881(company: {
  name: string;
  orgnr: string;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<string | null> {
  if (!hasApi1881()) return null;

  const contacts = await searchApi1881CompanyContacts(company);
  for (const contact of contacts) {
    if (!api1881ContactMatchesCompany(contact, company.name, company.orgnr)) {
      continue;
    }
    const phone = pickPlausiblePhone(
      extractPhonesFromApi1881Contact(contact),
      company.orgnr
    );
    if (phone) return phone;
  }

  return null;
}

export async function resolvePhoneWithApi1881(company: {
  name: string;
  orgnr: string;
  municipality_name?: string | null;
  city?: string | null;
}): Promise<{ phone: string; verified: boolean } | null> {
  const discovered = await discoverPhoneWithApi1881(company);
  if (!discovered) return null;
  return { phone: discovered, verified: true };
}

export async function finalizePhoneWithApi1881(
  company: {
    name: string;
    orgnr: string;
    municipality_name?: string | null;
    city?: string | null;
  },
  candidate: { phone: string; source: string } | null
): Promise<{ phone: string | null; source: string | null; from1881: boolean }> {
  if (!hasApi1881()) {
    return {
      phone: candidate?.phone ?? null,
      source: candidate?.source ?? null,
      from1881: candidate?.source === "1881",
    };
  }

  if (candidate?.phone && candidate.source !== "1881") {
    const plausible = phonePlausibleForCompany(candidate.phone, company.orgnr);
    if (!plausible) {
      return { phone: null, source: null, from1881: false };
    }

    const verified = await verifyPhoneWithApi1881(candidate.phone, company);
    if (verified) {
      return {
        phone: candidate.phone,
        source: candidate.source,
        from1881: false,
      };
    }
  } else if (candidate?.phone && candidate.source === "1881") {
    return {
      phone: candidate.phone,
      source: "1881",
      from1881: true,
    };
  }

  const discovered = await discoverPhoneWithApi1881(company);
  if (discovered) {
    return { phone: discovered, source: "1881", from1881: true };
  }

  return { phone: null, source: null, from1881: false };
}
