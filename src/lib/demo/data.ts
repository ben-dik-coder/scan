import type {
  CompanyWithLead,
  EmailCampaign,
  EmailTemplate,
  LeadStatus,
  UserLead,
} from "@/types/database";
import { computeLeadScore } from "@/lib/sales/lead-score";

const today = new Date();

function daysAgo(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type RawCompany = Omit<CompanyWithLead, "user_lead" | "city" | "website"> & {
  status?: LeadStatus;
  notes?: string;
  city?: string | null;
  website?: string | null;
};

const RAW: RawCompany[] = [
  {
    orgnr: "923456789",
    name: "Nordlys Consulting AS",
    email: "post@nordlysconsulting.no",
    phone: "76901234",
    mobile: null,
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "70.220",
    registered_at: daysAgo(3),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    status: "ny",
  },
  {
    orgnr: "923456790",
    name: "Fjell & Fjord Transport AS",
    email: "info@fjellfjord.no",
    phone: null,
    mobile: "91234567",
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "49.410",
    registered_at: daysAgo(5),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    status: "kontaktet",
  },
  {
    orgnr: "923456791",
    name: "Arctic Tech Solutions AS",
    email: "kontakt@arctictech.no",
    phone: "76905678",
    mobile: null,
    municipality_code: "5401",
    municipality_name: "Tromsø",
    industry_code: "62.010",
    registered_at: daysAgo(8),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(8),
    updated_at: daysAgo(8),
    status: "svarte",
  },
  {
    orgnr: "923456792",
    name: "Håkon Berg Elektro ENK",
    email: "hakon.berg@elektro.no",
    phone: null,
    mobile: "98765432",
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "43.210",
    registered_at: daysAgo(12),
    has_email: true,
    email_is_generic: false,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(12),
    updated_at: daysAgo(12),
    status: "ny",
  },
  {
    orgnr: "923456793",
    name: "Midnattsol Digitalbyrå AS",
    email: "post@midnattsolmedia.no",
    phone: "76907890",
    mobile: null,
    municipality_code: "1806",
    municipality_name: "Nordkapp",
    industry_code: "73.110",
    registered_at: daysAgo(15),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
    status: "moete_booket",
  },
  {
    orgnr: "923456794",
    name: "Grønn Vekst AS",
    email: null,
    phone: "76901122",
    mobile: "90112233",
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "01.110",
    registered_at: daysAgo(18),
    has_email: false,
    email_is_generic: false,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(18),
    updated_at: daysAgo(18),
    status: "ny",
  },
  {
    orgnr: "923456795",
    name: "Lumen Webdesign AS",
    email: "info@studiolumen.no",
    phone: null,
    mobile: null,
    municipality_code: "0301",
    municipality_name: "Oslo",
    industry_code: "74.110",
    registered_at: daysAgo(22),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(22),
    updated_at: daysAgo(22),
    status: "kontaktet",
  },
  {
    orgnr: "923456796",
    name: "Borealis Bygg AS",
    email: "post@borealisbygg.no",
    phone: "22334455",
    mobile: null,
    municipality_code: "0301",
    municipality_name: "Oslo",
    industry_code: "41.200",
    registered_at: daysAgo(25),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(25),
    updated_at: daysAgo(25),
    status: "ny",
  },
  {
    orgnr: "923456797",
    name: "Kysten Kaffe AS",
    email: "bestilling@kystenkaffe.no",
    phone: "76903344",
    mobile: null,
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "56.101",
    registered_at: daysAgo(28),
    has_email: true,
    email_is_generic: false,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(28),
    updated_at: daysAgo(28),
    status: "ikke_interessert",
  },
  {
    orgnr: "923456798",
    name: "Polar Print AS",
    email: "info@polarprint.no",
    phone: null,
    mobile: "93456789",
    municipality_code: "5401",
    municipality_name: "Tromsø",
    industry_code: "18.120",
    registered_at: daysAgo(35),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(35),
    updated_at: daysAgo(35),
    status: "vunnet",
  },
  {
    orgnr: "923456799",
    name: "Vinterlys Eiendom AS",
    email: "post@vinterlys.no",
    phone: "76909988",
    mobile: null,
    municipality_code: "1804",
    municipality_name: "Narvik",
    industry_code: "68.100",
    registered_at: daysAgo(40),
    has_email: true,
    email_is_generic: true,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(40),
    updated_at: daysAgo(40),
    status: "tapt",
  },
  {
    orgnr: "923456800",
    name: "Nordkapp Digital ENK",
    email: null,
    phone: null,
    mobile: "97788990",
    municipality_code: "1806",
    municipality_name: "Nordkapp",
    industry_code: "62.020",
    registered_at: daysAgo(45),
    has_email: false,
    email_is_generic: false,
    brreg_updated_at: null,
    daglig_leder: null,
    created_at: daysAgo(45),
    updated_at: daysAgo(45),
    status: "ny",
  },
];

function toUserLead(c: RawCompany): UserLead {
  return {
    user_id: "demo-user",
    orgnr: c.orgnr,
    status: c.status ?? "ny",
    score: computeLeadScore({ ...c, city: c.city ?? null, website: c.website ?? null }),
    notes: c.notes ?? null,
    last_contacted_at: c.status === "kontaktet" ? daysAgo(2) : null,
    next_follow_up_at: c.status === "svarte" ? daysAgo(-2) : null,
    queued_at: null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export function buildDemoCompanies(): CompanyWithLead[] {
  return RAW.map(({ status, notes, city, website, ...company }) => ({
    ...company,
    city: city ?? null,
    website: website ?? null,
    user_lead: toUserLead({ ...company, status, notes, city, website } as RawCompany),
  }));
}

export const DEMO_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-1",
    user_id: "demo-user",
    name: "Tilbud nettside — nyoppstart",
    subject: "Gratulerer med oppstart, {firmanavn}!",
    body: `Hei {firmanavn},

Gratulerer med nyregistrering!

Jeg lager nettsider for nye bedrifter i området. Mange starter uten nettside — jeg hjelper med en enkel, profesjonell side til en fornuftig pris.

Har dere tenkt på nettside ennå? Jeg tar gjerne en uforpliktende prat.

Med vennlig hilsen`,
    is_default: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  },
  {
    id: "tpl-2",
    user_id: "demo-user",
    name: "Kort intro — webdesign",
    subject: "Kort spørsmål til {firmanavn}",
    body: `Hei {firmanavn},

Vi så at dere nettopp har registrert firma. Jeg er webdesigner og lager nettsider for nye bedrifter — er det noe dere vurderer?

Med vennlig hilsen`,
    is_default: false,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  },
  {
    id: "tpl-3",
    user_id: "demo-user",
    name: "Oppfølging — dag 3",
    subject: "Re: tilbud til {firmanavn}",
    body: "Hei {firmanavn},\n\nJeg sendte en mail for noen dager siden. Er det fortsatt aktuelt?\n\nMed vennlig hilsen",
    is_default: false,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  },
];

export const DEMO_SEQUENCES = [
  {
    id: "seq-1",
    user_id: "demo-user",
    name: "Standard 3-stegs oppfølging",
    active: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
    steps: [
      {
        id: "step-1",
        sequence_id: "seq-1",
        step_order: 0,
        delay_days: 0,
        subject: "Gratulerer med oppstart, {firmanavn}!",
        body: DEMO_TEMPLATES[1].body,
        created_at: daysAgo(30),
      },
      {
        id: "step-2",
        sequence_id: "seq-1",
        step_order: 1,
        delay_days: 3,
        subject: "Re: kort spørsmål til {firmanavn}",
        body: DEMO_TEMPLATES[2].body,
        created_at: daysAgo(30),
      },
      {
        id: "step-3",
        sequence_id: "seq-1",
        step_order: 2,
        delay_days: 7,
        subject: "Siste forsøk — {firmanavn}",
        body: "Hei {firmanavn},\n\nDette er siste gang jeg tar kontakt. Lykke til videre!\n\nMed vennlig hilsen",
        created_at: daysAgo(30),
      },
    ],
  },
];

export const DEMO_CAMPAIGNS: EmailCampaign[] = [
  {
    id: "camp-1",
    user_id: "demo-user",
    subject: "Gratulerer med oppstart!",
    subject_b: null,
    body: "...",
    sent_count: 24,
    failed_count: 1,
    created_at: daysAgo(2),
  },
  {
    id: "camp-2",
    user_id: "demo-user",
    subject: "Tilbud til nye bedrifter i Narvik",
    subject_b: null,
    body: "...",
    sent_count: 18,
    failed_count: 0,
    created_at: daysAgo(7),
  },
];

export const DEMO_MUNICIPALITIES = [
  { code: "1804", name: "Narvik", count: 5 },
  { code: "5401", name: "Tromsø", count: 2 },
  { code: "0301", name: "Oslo", count: 2 },
  { code: "1806", name: "Nordkapp", count: 2 },
];

export const DEMO_ADMIN_STATS = {
  totalCompanies: 1247,
  withEmail: 412,
  syncState: {
    last_sync: new Date(Date.now() - 3600000).toISOString(),
    metadata: { mode: "bootstrap", upserted: 1247, processed: 1247 },
  },
  topKommuner: [
    { code: "0301", name: "Oslo", count: 312 },
    { code: "4601", name: "Bergen", count: 98 },
    { code: "1804", name: "Narvik", count: 45 },
    { code: "5401", name: "Tromsø", count: 38 },
  ],
};

export const DEMO_SAVED_LISTS = [
  {
    id: "list-1",
    user_id: "demo-user",
    name: "Narvik — siste 30 dager med e-post",
    filters: { municipalityCode: "1804", days: 30, hasEmail: true },
    created_at: daysAgo(5),
  },
];
