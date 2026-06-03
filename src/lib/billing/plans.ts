export type PlanId = "nylead";

/** Eldre abonnement i databasen — samme rettigheter som NyLead */
export type LegacyPlanId = "start" | "pro" | "agency";

export type StoredPlanId = PlanId | LegacyPlanId;

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

function priceId(...envKeys: string[]): string | undefined {
  for (const key of envKeys) {
    let v = process.env[key]?.trim();
    if (!v) continue;
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1).trim();
    }
    if (v) return v;
  }
  return undefined;
}

/** Én pakke — full tilgang (tidligere Pro-nivå) */
export const NYLEAD_PLAN: PlanConfig = {
  id: "nylead",
  name: "NyLead",
  tagline: "Skann Brreg, sjekk nettside, send fra din e-post — én pris, alt med",
  priceNok: 499,
  stripePriceId: priceId("STRIPE_PRICE", "STRIPE_PRICE_NYLEAD"),
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
    "Send fra Gmail, Outlook eller SMTP",
    "Sekvenser og oppfølging",
    "Pipeline / CRM",
    "Ubegrenset maler",
    "7 dagers prøveperiode",
  ],
};

export const PLANS: PlanConfig[] = [NYLEAD_PLAN];

export const DEFAULT_PLAN_ID: PlanId = "nylead";

const LEGACY_STRIPE_PRICE_MAP: { priceId: string | undefined; storedAs: LegacyPlanId }[] = [
  { priceId: priceId("STRIPE_PRICE_START"), storedAs: "start" },
  { priceId: priceId("STRIPE_PRICE_PRO"), storedAs: "pro" },
  { priceId: priceId("STRIPE_PRICE_AGENCY"), storedAs: "agency" },
];

export function getPlan(
  id: StoredPlanId | string | null | undefined
): PlanConfig | null {
  if (!id) return null;
  if (id === "nylead" || id === "start" || id === "pro" || id === "agency") {
    return NYLEAD_PLAN;
  }
  return null;
}

export function isValidPlanId(id: string): id is PlanId {
  return id === "nylead";
}

export function isStoredPlanId(id: string): id is StoredPlanId {
  return (
    id === "nylead" || id === "start" || id === "pro" || id === "agency"
  );
}

/** Stripe price → plan lagret i profiles (nye kjøp = nylead) */
export function planFromStripePriceId(priceId: string): StoredPlanId | null {
  if (NYLEAD_PLAN.stripePriceId && NYLEAD_PLAN.stripePriceId === priceId) {
    return "nylead";
  }
  for (const legacy of LEGACY_STRIPE_PRICE_MAP) {
    if (legacy.priceId && legacy.priceId === priceId) return legacy.storedAs;
  }
  return null;
}

export function formatPlanName(planId: StoredPlanId | string): string {
  if (planId === "start") return "Start (eldre)";
  if (planId === "pro") return "Pro (eldre)";
  if (planId === "agency") return "Byrå (eldre)";
  return NYLEAD_PLAN.name;
}

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
];
