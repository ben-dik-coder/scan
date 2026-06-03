export type SampleCompany = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string;
  websiteStatus: "none" | "yes" | "uncertain" | "pending";
  facebook: string | null;
  instagram: string | null;
  municipality: string;
  registeredAt: string;
  status: string;
  dagligLeder: string | null;
};

export const SAMPLE_COMPANIES: SampleCompany[] = [
  {
    orgnr: "923456789",
    name: "Nordisk Rør AS",
    email: "post@nordiskror.no",
    phone: "912 34 567",
    website: "Ingen nettside",
    websiteStatus: "none",
    facebook: "facebook.com/nordiskror",
    instagram: null,
    municipality: "Oslo",
    registeredAt: "6. jan. 2025",
    status: "Ny",
    dagligLeder: "Ola Nordmann",
  },
  {
    orgnr: "987654321",
    name: "Fjord & Furu Handverk",
    email: "info@fjordfuru.no",
    phone: "478 12 900",
    website: "fjordfuru.no",
    websiteStatus: "yes",
    facebook: null,
    instagram: "instagram.com/fjordfuru",
    municipality: "Bergen",
    registeredAt: "4. juni 2021",
    status: "Kontaktet",
    dagligLeder: "Kari Furu",
  },
  {
    orgnr: "912345678",
    name: "Lys & Logistikk ENK",
    email: null,
    phone: "55 11 22 33",
    website: "Usikker",
    websiteStatus: "uncertain",
    facebook: null,
    instagram: null,
    municipality: "Trondheim",
    registeredAt: "16. jan. 2025",
    status: "Ny",
    dagligLeder: null,
  },
  {
    orgnr: "934567890",
    name: "Kaffe & Kode DA",
    email: "hei@kaffekode.no",
    phone: null,
    website: "Ingen nettside",
    websiteStatus: "none",
    facebook: "facebook.com/kaffekode",
    instagram: "instagram.com/kaffekode",
    municipality: "Stavanger",
    registeredAt: "2. feb. 2025",
    status: "Ny",
    dagligLeder: "Per Kode",
  },
  {
    orgnr: "922106541",
    name: "LIVETS HUS GRAVFERD AS",
    email: "post@tangenbegravelse.no",
    phone: "908 91 480",
    website: "tangenbegravelse.no",
    websiteStatus: "yes",
    facebook: null,
    instagram: null,
    municipality: "Alta",
    registeredAt: "6. feb. 2019",
    status: "Ny",
    dagligLeder: "Anne Tangen",
  },
];

export const FILTER_CHIPS = ["Hele Norge", "Oslo", "30 dager", "Frisør og skjønnhet"];
