export type PlanId = "start" | "pro" | "agency";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid";

export type PlanConfig = {
  id: PlanId;
  name: string;
  tagline: string;
  priceNok: number;
  stripePriceId: string | undefined;
  popular?: boolean;
  maxRecipientsPerSend: number;
  maxEmailsPerMonth: number;
  /** Unike firma med tlf og/eller e-post fra Brreg per måned */
  maxCompaniesWithContactPerMonth: number;
  maxTemplates: number | null;
  emailIntegration: boolean;
  sequences: boolean;
  pipeline: boolean;
  features: string[];
};

function priceId(envKey: string): string | undefined {
  const v = process.env[envKey]?.trim();
  return v || undefined;
}

export const PLANS: PlanConfig[] = [
  {
    id: "start",
    name: "Start",
    tagline: "For deg som kommer i gang",
    priceNok: 399,
    stripePriceId: priceId("STRIPE_PRICE_START"),
    maxRecipientsPerSend: 0,
    maxEmailsPerMonth: 0,
    maxCompaniesWithContactPerMonth: 150,
    maxTemplates: 0,
    emailIntegration: false,
    sequences: false,
    pipeline: false,
    features: [
      "Opptil 150 bedrifter med tlf og e-post per måned",
      "Brreg-skanning i ditt område",
      "Google nettside-sjekk (10 om gangen)",
      "Filtrer og eksporter leads",
      "Uten Gmail/Outlook — oppgrader til Pro for utsendelse",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For aktiv salg",
    priceNok: 644,
    stripePriceId: priceId("STRIPE_PRICE_PRO"),
    popular: true,
    maxRecipientsPerSend: 75,
    maxEmailsPerMonth: 500,
    maxCompaniesWithContactPerMonth: 250,
    maxTemplates: null,
    emailIntegration: true,
    sequences: true,
    pipeline: true,
    features: [
      "Opptil 250 bedrifter med tlf og e-post per måned",
      "Brreg-skanning og Google nettside-sjekk",
      "Send fra Gmail eller Outlook",
      "Sekvenser og oppfølging",
      "Pipeline / CRM",
      "Ubegrenset maler",
      "7 dagers prøveperiode",
    ],
  },
  {
    id: "agency",
    name: "Byrå",
    tagline: "For høyt volum",
    priceNok: 1294,
    stripePriceId: priceId("STRIPE_PRICE_AGENCY"),
    maxRecipientsPerSend: 100,
    maxEmailsPerMonth: 1000,
    maxCompaniesWithContactPerMonth: 500,
    maxTemplates: null,
    emailIntegration: true,
    sequences: true,
    pipeline: true,
    features: [
      "Opptil 500 bedrifter med tlf og e-post per måned",
      "Alt i Pro (sending, sekvenser, pipeline)",
      "Opptil 100 mottakere per utsendelse",
      "1 000 e-poster per måned",
      "Prioritert support",
    ],
  },
];

export function getPlan(id: PlanId | string | null | undefined): PlanConfig | null {
  if (!id) return null;
  return PLANS.find((p) => p.id === id) ?? null;
}

export function isValidPlanId(id: string): id is PlanId {
  return id === "start" || id === "pro" || id === "agency";
}

export function planFromStripePriceId(priceId: string): PlanId | null {
  for (const plan of PLANS) {
    if (plan.stripePriceId && plan.stripePriceId === priceId) return plan.id;
  }
  return null;
}

export function formatPlanName(planId: PlanId | string): string {
  return PLANS.find((p) => p.id === planId)?.name ?? String(planId);
}

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
];
