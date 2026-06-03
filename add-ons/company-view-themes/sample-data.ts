/** Fake companies for theme previews — mirrors CompanyTable fields. */
export type SampleCompany = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string;
  municipality: string;
  registeredAt: string;
};

export const SAMPLE_COMPANIES: SampleCompany[] = [
  {
    orgnr: "923456789",
    name: "Nordisk Rør AS",
    email: "post@nordiskror.no",
    phone: "912 34 567",
    website: "Ingen nettside",
    municipality: "Oslo",
    registeredAt: "28.05.2026",
  },
  {
    orgnr: "987654321",
    name: "Fjord & Furu Handverk",
    email: "info@fjordfuru.no",
    phone: "478 12 900",
    website: "Har nettside",
    municipality: "Bergen",
    registeredAt: "27.05.2026",
  },
  {
    orgnr: "912345678",
    name: "Lys & Logistikk ENK",
    email: null,
    phone: "55 11 22 33",
    website: "Ikke sjekket",
    municipality: "Trondheim",
    registeredAt: "26.05.2026",
  },
  {
    orgnr: "934567890",
    name: "Kaffe & Kode DA",
    email: "hei@kaffekode.no",
    phone: null,
    website: "Kun booking",
    municipality: "Stavanger",
    registeredAt: "25.05.2026",
  },
];
